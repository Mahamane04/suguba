-- ═══════════════════════════════════════════════════════════════════════════
-- Admin A2 (2026-09-27) : journal général des actions et notes internes.
--
--   • journal_admin : qui, quand, quelle action, quel dossier, motif,
--     avant / après. Écrit par le serveur à chaque action admin réussie.
--     NON MODIFIABLE : la base refuse toute modification et suppression.
--   • notes_internes : notes de l'équipe sur un dossier, jamais montrées au
--     client ; ajout seulement (pas de modification ni de suppression).
--
-- Lecture et écriture par le serveur uniquement (aucune policy).
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.journal_admin (
  id        BIGSERIAL PRIMARY KEY,
  cree_le   TIMESTAMPTZ NOT NULL DEFAULT now(),
  auteur_id TEXT NOT NULL,
  action    TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 80),
  dossier   TEXT CHECK (dossier IS NULL OR length(dossier) <= 160),
  motif     TEXT CHECK (motif IS NULL OR length(motif) <= 500),
  avant     JSONB,
  apres     JSONB
);
CREATE INDEX IF NOT EXISTS journal_admin_dossier_idx ON public.journal_admin (dossier, id DESC);
CREATE INDEX IF NOT EXISTS journal_admin_auteur_idx ON public.journal_admin (auteur_id, id DESC);
CREATE INDEX IF NOT EXISTS journal_admin_date_idx ON public.journal_admin (cree_le DESC);
ALTER TABLE public.journal_admin ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.notes_internes (
  id        BIGSERIAL PRIMARY KEY,
  cree_le   TIMESTAMPTZ NOT NULL DEFAULT now(),
  dossier   TEXT NOT NULL CHECK (length(dossier) BETWEEN 3 AND 160),
  auteur_id TEXT NOT NULL,
  texte     TEXT NOT NULL CHECK (length(trim(texte)) BETWEEN 1 AND 2000)
);
CREATE INDEX IF NOT EXISTS notes_internes_dossier_idx ON public.notes_internes (dossier, id DESC);
ALTER TABLE public.notes_internes ENABLE ROW LEVEL SECURITY;

-- Traces non modifiables : ni mise à jour ni suppression, même par le serveur.
CREATE OR REPLACE FUNCTION public.trace_non_modifiable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'TRACE_NON_MODIFIABLE' USING HINT = 'Le journal et les notes internes ne se modifient pas.';
END $$;

DROP TRIGGER IF EXISTS journal_admin_fige ON public.journal_admin;
CREATE TRIGGER journal_admin_fige BEFORE UPDATE OR DELETE ON public.journal_admin
  FOR EACH ROW EXECUTE FUNCTION public.trace_non_modifiable();
DROP TRIGGER IF EXISTS notes_internes_figees ON public.notes_internes;
CREATE TRIGGER notes_internes_figees BEFORE UPDATE OR DELETE ON public.notes_internes
  FOR EACH ROW EXECUTE FUNCTION public.trace_non_modifiable();

NOTIFY pgrst, 'reload schema';
