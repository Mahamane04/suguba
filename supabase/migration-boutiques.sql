-- ============================================================================
-- SUGUBA — BOUTIQUES FOURNISSEUR ET REVENDEUR
-- ============================================================================
--
-- Deux vitrines publiques, partageables sur WhatsApp, Facebook et TikTok :
--   /s/<adresse>   la boutique d'un fournisseur : ses produits approuvés ;
--   /r/<code>      la boutique d'un revendeur : SA sélection dans le catalogue,
--                  chaque lien portant son code pour lui attribuer la vente.
--
-- Idempotent : réexécutable sans dommage.
-- ============================================================================

-- ── 1. Adresse publique de la boutique fournisseur ─────────────────────────
-- Jusqu'ici l'adresse était recalculée à chaque affichage à partir du nom de
-- l'entreprise. Renommer l'entreprise aurait donc cassé tous les liens déjà
-- partagés. Elle est désormais attribuée UNE fois et conservée.
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_slug_key
  ON public.suppliers (slug)
  WHERE slug IS NOT NULL;

COMMENT ON COLUMN public.suppliers.slug IS
  'Adresse publique de la boutique (/s/<slug>). Attribuée une fois, jamais modifiée : elle figure dans des liens déjà partagés.';

-- ── 2. Sélection du revendeur ──────────────────────────────────────────────
-- Le revendeur n'a pas de stock : il CHOISIT des articles du catalogue
-- approuvé pour composer sa vitrine. Ce n'est qu'une liste de préférences —
-- prix, commission et disponibilité restent ceux du produit.
CREATE TABLE IF NOT EXISTS public.reseller_shop_items (
  reseller_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (reseller_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_reseller_shop_items_reseller
  ON public.reseller_shop_items (reseller_id, position);

-- Aucune politique : service_role uniquement. La vitrine publique est servie
-- par le serveur, qui ne renvoie que des champs sûrs (jamais le prix
-- fournisseur ni la commission).
ALTER TABLE public.reseller_shop_items ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.reseller_shop_items IS
  'Articles choisis par un revendeur pour sa boutique /r/<code>. Géré par /api/reseller/shop.';
