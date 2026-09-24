-- ════════════════════════════════════════════════════════════════════════
-- SUGUBA — mise à jour du 2026-09-24
-- À exécuter UNE fois dans Supabase › SQL Editor (projet SUGUBA).
--
-- Non destructif : uniquement des ADD COLUMN / CREATE TABLE IF NOT EXISTS,
-- et des index. Peut être relancé sans risque.
--
--   1. Code de ramassage chez le fournisseur
--   2. Livraison calculée au GPS (position du dépôt fournisseur)
--   3. Prix de gros et prix libre du revendeur
--   4. Plusieurs boutiques par compte (formules Pro)
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. CODE DE RAMASSAGE ────────────────────────────────────────────────
-- Le fournisseur voit ce code ; le livreur le saisit en récupérant le
-- colis. Sans lui, rien ne prouvait que le colis avait quitté le dépôt.
-- Valeur par défaut : chaque nouvelle commande reçoit son code
-- automatiquement, y compris via create_order_with_commission (qui ne
-- liste pas cette colonne et laisse donc s'appliquer le défaut).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pickup_code TEXT
  DEFAULT lpad((floor(random() * 10000))::int::text, 4, '0');
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS failed_pickup_attempts INTEGER NOT NULL DEFAULT 0;

UPDATE public.orders
   SET pickup_code = lpad((floor(random() * 10000))::int::text, 4, '0')
 WHERE pickup_code IS NULL;

-- Les commandes déjà livrées avant la mise à jour ont forcément été récupérées.
UPDATE public.orders
   SET picked_up_at = COALESCE(delivered_at, created_at)
 WHERE picked_up_at IS NULL AND status IN ('delivered', 'returned');

COMMENT ON COLUMN public.orders.pickup_code IS
  'Code à 4 chiffres montré au fournisseur, saisi par le livreur au ramassage (/api/driver/verify-pickup).';

-- ── 2. LIVRAISON AU GPS ─────────────────────────────────────────────────
-- Position exacte du dépôt, enregistrée par le fournisseur sur place
-- (« Utiliser ma position actuelle »). Point de départ du calcul de
-- livraison à la distance et de l'itinéraire du livreur. La position du
-- client, elle, est gardée dans orders.pricing_snapshot.livraison.
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS warehouse_lat DOUBLE PRECISION;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS warehouse_lng DOUBLE PRECISION;

-- ── 3. PRIX DE GROS ET PRIX LIBRE DU REVENDEUR ─────────────────────────
-- mode_prix = 'gros' : supplier_price est le PRIX DE GROS, public_price le
-- prix conseillé (vente sans revendeur). Le revendeur fixe son propre prix
-- (reseller_prices) ou le négocie à chaque vente dans « + Vente ».
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mode_prix TEXT NOT NULL DEFAULT 'fixe';
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_mode_prix_check;
ALTER TABLE public.products ADD CONSTRAINT products_mode_prix_check CHECK (mode_prix IN ('fixe', 'gros'));
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS prix_conseille NUMERIC;

CREATE TABLE IF NOT EXISTS public.reseller_prices (
  reseller_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price       NUMERIC NOT NULL CHECK (price > 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (reseller_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_reseller_prices_product ON public.reseller_prices (product_id);
ALTER TABLE public.reseller_prices ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.reseller_prices IS
  'Prix de vente choisi par un revendeur pour un article au prix de gros (boutique et liens partagés).';

-- ── 4. PLUSIEURS BOUTIQUES PAR COMPTE (FORMULES PRO) ────────────────────
-- Jusqu'ici une seule boutique par compte (index unique stores_owner_key).
-- Désormais : une boutique PRINCIPALE (toutes les boutiques existantes le
-- deviennent) et des boutiques supplémentaires selon la formule.
DROP INDEX IF EXISTS public.stores_owner_key;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS principale BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_stores_owner ON public.stores (owner_type, owner_id);
-- Une seule boutique principale par compte.
CREATE UNIQUE INDEX IF NOT EXISTS stores_principale_key
  ON public.stores (owner_type, owner_id) WHERE principale AND owner_id IS NOT NULL;

-- Articles d'une boutique SUPPLÉMENTAIRE (la principale garde son
-- fonctionnement : sélection revendeur ou catalogue du fournisseur).
CREATE TABLE IF NOT EXISTS public.store_products (
  store_id   TEXT NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL DEFAULT 0,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_store_products_store ON public.store_products (store_id, position);
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

-- Formules d'abonnement : demandées par le revendeur ou le fournisseur,
-- activées par l'admin après paiement (Mobile Money), pour une durée donnée.
CREATE TABLE IF NOT EXISTS public.store_plans (
  id            TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  profile_id    TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_type    TEXT NOT NULL CHECK (owner_type IN ('reseller', 'supplier')),
  formule_id    TEXT NOT NULL,
  formule_nom   TEXT NOT NULL,
  boutiques_max INTEGER NOT NULL CHECK (boutiques_max >= 1),
  prix_mensuel  INTEGER NOT NULL DEFAULT 0,
  statut        TEXT NOT NULL DEFAULT 'demande' CHECK (statut IN ('demande', 'active', 'refusee', 'expiree')),
  reference     TEXT NOT NULL,
  demande_le    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active_le     TIMESTAMPTZ,
  expire_le     TIMESTAMPTZ,
  decide_par    TEXT
);
CREATE INDEX IF NOT EXISTS idx_store_plans_profile ON public.store_plans (profile_id, owner_type, statut);
ALTER TABLE public.store_plans ENABLE ROW LEVEL SECURITY;

COMMIT;

NOTIFY pgrst, 'reload schema';
