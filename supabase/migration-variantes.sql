-- ============================================================================
-- SUGUBA — VARIANTES DE PRODUIT (§ H : « TCL Smart TV 43 / 55 / 65 pouces »)
-- ============================================================================
-- Additif et rejouable.
--
-- Une variante est un PRODUIT à part entière (son prix, son stock, sa
-- commission), relié à ses sœurs par `variant_group`. Ce choix évite de
-- toucher au moteur de prix, aux commandes et aux commissions, qui
-- fonctionnent tous produit par produit — et une TV 65 pouces n'a ni le prix
-- ni le stock d'une 43 pouces.
-- ============================================================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variant_group TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variant_label TEXT;
CREATE INDEX IF NOT EXISTS idx_products_variant_group ON public.products (variant_group) WHERE variant_group IS NOT NULL;
