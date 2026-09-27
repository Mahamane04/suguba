-- ═══════════════════════════════════════════════════════════════════════════
-- Poste de travail admin — A1 (2026-09-27) : responsable de chaque dossier.
--
-- La file « À traiter » montre qui s'occupe de quoi : un membre « prend » un
-- dossier, le transfère à un collègue ou le libère. Clé du dossier :
-- « type:id » (ex. « commande_a_confirmer:<id de commande> »).
-- Lecture et écriture par le serveur uniquement (aucune policy).
--
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.admin_affectations (
  dossier    TEXT PRIMARY KEY CHECK (dossier ~ '^[a-z_]+:[A-Za-z0-9_.:-]{1,120}$'),
  membre_id  TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  par_id     TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_affectations_membre_idx ON public.admin_affectations (membre_id);
ALTER TABLE public.admin_affectations ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
