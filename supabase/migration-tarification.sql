-- ============================================================================
-- SUGUBA — TARIFICATION AUTOMATIQUE
-- ============================================================================
--
-- Jusqu'ici la commission revendeur était saisie à la main, et la seule règle
-- appliquée était « marge Suguba non négative » — sans tenir compte d'aucun
-- coût de la plateforme. Cette migration pose les fondations du calcul
-- automatique (voir src/lib/pricing.ts).
--
-- Idempotent : réexécutable sans dommage.
-- ============================================================================

-- ── 1. Réglages de la plateforme ────────────────────────────────────────────
-- Une seule ligne (id = 1), contenant tous les réglages en JSON : coûts
-- variables et fixes, volume de référence, part revendeur, marge minimale,
-- frais de livraison, rémunération livreur, retrait minimum.
--
-- Pourquoi du JSON plutôt qu'une colonne par réglage : le moteur complète les
-- valeurs manquantes avec ses défauts (completerReglages). Ajouter un réglage
-- plus tard ne demandera donc aucune migration.
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  valeurs     JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Faux tant que l'admin n'a jamais enregistré ses propres chiffres : les
  -- coûts fixes par défaut sont une estimation provisoire, pas la réalité.
  confirme    BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  TEXT
);

-- Aucune politique : service_role uniquement. La structure de coûts de Suguba
-- n'a pas à être lisible depuis un navigateur. Les rares valeurs publiques
-- (frais de livraison, retrait minimum) passent par /api/settings/public.
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.platform_settings IS
  'Réglages économiques de la plateforme (ligne unique). Lus par src/lib/platform-settings.ts, calculs dans src/lib/pricing.ts.';

-- ── 2. Verdict de tarification sur chaque produit ──────────────────────────
-- Seul le VERDICT est stocké (ok / sous_plancher / commission_faible), pas le
-- plancher ni la marge Suguba en francs.
--
-- Raison : la table `products` est lisible publiquement pour les articles
-- approuvés. Y stocker la marge Suguba et le coût plateforme reviendrait à
-- publier la structure de coûts de l'entreprise. Ces montants sont calculés à
-- la volée, côté admin, à partir des réglages.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pricing_status      TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pricing_computed_at TIMESTAMPTZ;

-- ── 3. Montants figés sur chaque commande ──────────────────────────────────
-- Au moment où la commande est passée, le serveur calcule et fige : prix,
-- commission, marge Suguba, et la décomposition complète avec les réglages
-- en vigueur. Modifier les coûts ensuite ne touche jamais les commandes
-- passées : la comptabilité reste juste.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS platform_margin  NUMERIC(12, 2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB;

COMMENT ON COLUMN public.orders.platform_margin IS
  'Marge brute Suguba de la commande (prix − fournisseur − commission), figée à la création.';
COMMENT ON COLUMN public.orders.pricing_snapshot IS
  'Décomposition complète du tarif et réglages en vigueur au moment de la commande.';
