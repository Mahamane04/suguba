-- ============================================================================
-- SUGUBA — MIGRATION PAIEMENT SASPAY
-- Remplace LigdiCash (payin) et CinetPay/momo-gateway (payout).
-- ============================================================================
--
-- Pourquoi une colonne d'id de transaction plutôt qu'un jeton de facture :
--
-- Le webhook SasPay ne transporte PAS nos `metadata`. Son `data` contient
-- uniquement l'id de transaction SasPay, sa référence interne, le statut et
-- les montants — aucun numéro de commande Suguba. L'ancien mécanisme
-- LigdiCash (`custom_data.reference` = notre order_number) est donc
-- irreproductible.
--
-- La seule façon fiable de rattacher un webhook à une ligne est de stocker
-- l'id renvoyé par SasPay AU MOMENT DE L'INITIATION, puis de retrouver la
-- ligne par cet id. D'où `payment_transaction_id`, et l'index UNIQUE qui
-- garantit qu'un même paiement ne pourra jamais confirmer deux commandes.
--
-- Idempotent : réexécutable sans dommage.
-- ============================================================================

-- ── Encaissements ───────────────────────────────────────────────────────────
ALTER TABLE public.orders  ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT;
ALTER TABLE public.orders  ADD COLUMN IF NOT EXISTS payment_network        TEXT;

-- ── Versements ──────────────────────────────────────────────────────────────
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT;
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS payment_network        TEXT;

-- Index UNIQUE partiels : le webhook cherche par cet id, et deux lignes ne
-- doivent jamais se réclamer de la même transaction SasPay. `WHERE ... IS
-- NOT NULL` laisse cohabiter autant de lignes non payées qu'on veut.
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_transaction_id_key
  ON public.orders (payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payouts_payment_transaction_id_key
  ON public.payouts (payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL;

COMMENT ON COLUMN public.orders.payment_transaction_id IS
  'Id de transaction SasPay, stocké à l''initiation. Seule clé de rattachement du webhook — voir src/lib/saspay.ts.';
COMMENT ON COLUMN public.orders.payment_network IS
  'Code réseau SasPay utilisé : orange_ml, moov_ml ou mobi_cash_ml.';
COMMENT ON COLUMN public.payouts.payment_transaction_id IS
  'Id de transaction SasPay du versement, stocké à l''initiation.';

-- ============================================================================
-- NETTOYAGE OPTIONNEL — à n'exécuter qu'après vérification
-- ============================================================================
-- `payment_invoice_token` servait au seul LigdiCash, dont les clés n'ont
-- jamais été reçues : la colonne devrait être vide partout. Vérifier d'abord,
-- supprimer ensuite — jamais l'inverse.
--
--   SELECT count(*) FROM public.orders  WHERE payment_invoice_token IS NOT NULL;
--   SELECT count(*) FROM public.payouts WHERE payment_invoice_token IS NOT NULL;
--
-- Si les deux renvoient 0 :
--
--   ALTER TABLE public.orders  DROP COLUMN IF EXISTS payment_invoice_token;
--   ALTER TABLE public.payouts DROP COLUMN IF EXISTS payment_invoice_token;

-- ============================================================================
-- MOYENS DE VERSEMENT ALIGNÉS SUR CE QUE SASPAY SAIT PAYER AU MALI
-- ============================================================================
--
-- SasPay ne couvre pas Wave au Mali (réseaux : orange_ml, moov_ml,
-- mobi_cash_ml). Un retrait demandé en `wave` ne peut donc plus être viré
-- automatiquement — l'option a été retirée de l'écran revendeur, et
-- /api/payouts/initiate refuse ces lignes avec un message explicite.
--
-- 'wave' RESTE dans la contrainte : des retraits historiques peuvent déjà
-- porter cette valeur, et une contrainte qui les invaliderait ferait échouer
-- cette migration. On ajoute seulement 'mobi_cash', qui manquait.
ALTER TABLE public.payouts DROP CONSTRAINT IF EXISTS payouts_payment_method_check;
ALTER TABLE public.payouts ADD  CONSTRAINT payouts_payment_method_check
  CHECK (payment_method IN ('wave', 'orange_money', 'moov', 'mobi_cash', 'cash'));
