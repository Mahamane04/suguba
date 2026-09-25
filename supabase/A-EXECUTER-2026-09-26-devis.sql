-- ═══════════════════════════════════════════════════════════════════════════
-- Devis enregistrés (2026-09-26, lot 1b « Offres & réalisation »)
--
-- Une offre peut se commander « sur devis » (kit solaire à dimensionner,
-- installation, véhicule…) :
--   1. le client décrit son besoin → demande enregistrée (quote_requests) ;
--   2. le fournisseur propose SON prix et la part du revendeur ; le serveur
--      calcule le prix client avec le moteur de prix, puis le FIGE dans la
--      proposition (une modification ultérieure du produit ou des réglages
--      ne change pas un devis déjà proposé) ;
--   3. le client accepte depuis son téléphone → une commande normale est
--      créée (create_order_with_commission, inchangée), avec le prix du
--      devis ; ou il refuse.
--
-- L'accès du client passe par une clé secrète gardée sur son téléphone (seul
-- son hash est stocké), comme pour le reçu de commande.
--
-- À exécuter une fois dans le SQL Editor de Supabase. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mode_commande TEXT NOT NULL DEFAULT 'achat';
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_mode_commande_check;
ALTER TABLE public.products ADD CONSTRAINT products_mode_commande_check CHECK (mode_commande IN ('achat', 'devis'));

CREATE TABLE IF NOT EXISTS public.quote_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number      TEXT NOT NULL UNIQUE,
  access_key_hash   TEXT NOT NULL UNIQUE,
  product_id        TEXT NOT NULL REFERENCES public.products(id),
  supplier_id       TEXT,
  reseller_id       TEXT,
  reseller_code     TEXT,
  reseller_name     TEXT,
  customer_name     TEXT NOT NULL,
  customer_phone    TEXT NOT NULL,
  city              TEXT NOT NULL DEFAULT 'Bamako',
  neighborhood      TEXT,
  landmark          TEXT,
  quantite          INTEGER NOT NULL DEFAULT 1 CHECK (quantite BETWEEN 1 AND 50),
  besoin            TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'demande'
                    CHECK (status IN ('demande', 'proposee', 'acceptee', 'refusee_client', 'refusee_fournisseur')),
  prix_fournisseur  NUMERIC CHECK (prix_fournisseur IS NULL OR prix_fournisseur > 0),
  part_revendeur    NUMERIC CHECK (part_revendeur IS NULL OR part_revendeur >= 0),
  conditions        TEXT,
  valable_jusqu     TIMESTAMPTZ,
  proposition       JSONB,          -- devis calculé et figé (prix client, commission, livraison…)
  motif_refus       TEXT,
  order_id          TEXT,
  order_number      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  proposed_at       TIMESTAMPTZ,
  decided_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS quote_requests_supplier_idx ON public.quote_requests (supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quote_requests_phone_idx ON public.quote_requests (customer_phone, status);

-- Aucune policy : lecture et écriture par le serveur uniquement (service_role).
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
