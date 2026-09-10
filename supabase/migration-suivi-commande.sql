-- ============================================================================
-- SUGUBA — SUIVI DE COMMANDE MULTI-APPAREILS
-- ============================================================================
--
-- Jusqu'ici /track/[numéro] lisait le store local du navigateur : le suivi ne
-- marchait que sur l'appareil ayant passé la commande. Client qui change de
-- téléphone, vide son cache ou commande depuis un cybercafé : code perdu.
-- C'est le trou que le SMS venait boucher, à 16-35 FCFA le message.
--
-- La fonction track_order(numéro, téléphone) existait déjà dans schema.sql,
-- accordée à `anon`, mais n'était appelée par AUCUN code. Elle ne renvoie pas
-- le code de livraison — son auteur l'a jugé trop sensible.
--
-- ── Ce que cette migration ajoute ────────────────────────────────────────
-- Une table de limitation des tentatives, pour pouvoir exposer le code de
-- livraison sans ouvrir la porte à l'énumération.
--
-- Pourquoi c'est acceptable maintenant, et ne l'était pas avant : les numéros
-- de commande faisaient 5 chiffres (90 000 valeurs, énumérables en quelques
-- minutes). Ils font désormais 8 caractères sur 30 symboles, soit 6,5 × 10¹¹
-- combinaisons — voir src/lib/order-number.ts. Le numéro est devenu le
-- facteur FORT ; le téléphone, à 8 chiffres, est le facteur faible, et c'est
-- lui que cette limitation protège.
--
-- Idempotent : réexécutable sans dommage.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.track_attempts (
  id           BIGSERIAL PRIMARY KEY,
  order_number TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- La lecture ne filtre que sur ces deux colonnes, dans cet ordre.
CREATE INDEX IF NOT EXISTS idx_track_attempts_lookup
  ON public.track_attempts (order_number, attempted_at DESC);

-- Aucune politique : service_role uniquement. La route /api/orders/track
-- vérifie elle-même, personne ne doit pouvoir lire ni écrire cette table
-- depuis un navigateur.
ALTER TABLE public.track_attempts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.track_attempts IS
  'Tentatives de suivi INFRUCTUEUSES, pour limiter le forçage du téléphone sur un numéro de commande connu. Purgée au fil de l''eau par /api/orders/track.';

-- ============================================================================
-- track_order : le code de livraison rejoint le résultat
-- ============================================================================
--
-- Décision assumée. Le code est ce dont le client a besoin devant sa porte,
-- et le lui refuser ici oblige à le lui envoyer par SMS payant — ou à le
-- perdre. Trois raisons de considérer que c'est sûr :
--   1. deux facteurs sont exigés, dont un à 6,5 × 10¹¹ combinaisons ;
--   2. les tentatives infructueuses sont limitées (voir la route) ;
--   3. le code seul ne suffit pas : il faut aussi être physiquement présent
--      au bon endroit, au bon moment, et recevoir le colis des mains du
--      livreur — qui voit le nom et le quartier du destinataire.
--
-- Le code n'est plus renvoyé une fois la commande livrée : il n'a alors plus
-- aucun usage, et le conserver accessible serait une exposition gratuite.
CREATE OR REPLACE FUNCTION public.track_order(p_order_number TEXT, p_customer_phone TEXT)
RETURNS TABLE (
  order_number TEXT,
  product_name TEXT,
  status TEXT,
  city TEXT,
  neighborhood TEXT,
  landmark TEXT,
  total_amount NUMERIC,
  payment_collected BOOLEAN,
  delivery_otp TEXT,
  created_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.order_number, o.product_name, o.status, o.city, o.neighborhood,
         o.landmark, o.total_amount, o.payment_collected,
         CASE WHEN o.status = 'delivered' THEN NULL ELSE o.delivery_otp END,
         o.created_at, o.delivered_at
  FROM public.orders o
  WHERE o.order_number = p_order_number
    AND o.customer_phone = p_customer_phone;
$$;

-- L'exécution reste refusée au public : la route serveur l'appelle en
-- service_role, après avoir appliqué sa limitation de tentatives. L'accorder
-- à `anon` laisserait n'importe qui la marteler depuis un navigateur, sans
-- aucun compteur.
REVOKE ALL ON FUNCTION public.track_order(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_order(TEXT, TEXT) FROM anon, authenticated;
