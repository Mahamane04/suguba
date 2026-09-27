-- ═══════════════════════════════════════════════════════════════════════════
-- Admin A4 (2026-09-27) : vues enregistrées des listes professionnelles.
--
-- Chaque membre enregistre ses propres vues (filtres, tri, colonnes) par
-- page : « Produits sans photo », « Sans unité »… Une vue ne change JAMAIS
-- les droits : masquer une colonne est un confort, pas une restriction.
-- Lecture et écriture par le serveur uniquement (aucune policy).
--
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.vues_admin (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  page      TEXT NOT NULL CHECK (page ~ '^[a-z-]{2,40}$'),
  nom       TEXT NOT NULL CHECK (length(trim(nom)) BETWEEN 1 AND 60),
  config    JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (length(config::text) <= 4000),
  cree_le   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (membre_id, page, nom)
);
CREATE INDEX IF NOT EXISTS vues_admin_membre_idx ON public.vues_admin (membre_id, page);
ALTER TABLE public.vues_admin ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
