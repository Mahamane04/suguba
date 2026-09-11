-- ============================================================================
-- SUGUBA — PART REVENDEUR CHOISIE PAR LE FOURNISSEUR (2026-09-11)
-- ============================================================================
--
-- Le fournisseur indique, pour chaque produit, combien il laisse au revendeur
-- par article vendu. Le moteur de tarification (src/lib/pricing.ts) en déduit
-- le prix client selon le mode choisi par l'admin (Réglages économiques) :
--   - Suguba prend un % du PRIX DE VENTE, ou
--   - Suguba prend un % de la PART REVENDEUR,
-- avec une part minimale par vente, et jamais sous le plancher des coûts.
--
-- NULL = le fournisseur n'a rien indiqué : le moteur calcule la commission
-- lui-même (comportement d'avant).
--
-- Idempotent : réexécutable sans dommage.
-- ============================================================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commission_proposee NUMERIC(12, 2);

COMMENT ON COLUMN public.products.commission_proposee IS
  'Part revendeur par article choisie par le fournisseur. Utilisée par le moteur de tarification sauf en mode automatique. NULL = le moteur décide.';
