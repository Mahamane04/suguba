-- ═══════════════════════════════════════════════════════════════════════════
-- Admin A3 (2026-09-27) : sécurité de l'équipe.
--
--   • securite_equipe : double authentification obligatoire (oui / non) et
--     seuil de double validation (0 = désactivée). Une seule ligne.
--   • sessions_revocations : « Déconnecter partout » — toute session émise
--     avant cette date est refusée.
--   • validations_admin : double validation. Une personne prépare, une AUTRE
--     approuve (la base refuse qu'on approuve sa propre demande). Si le
--     dossier change (montant, bénéficiaire), l'approbation devient caduque.
--
-- Lecture et écriture par le serveur uniquement (aucune policy).
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.securite_equipe (
  id              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mfa_obligatoire BOOLEAN NOT NULL DEFAULT false,
  seuil_validation INTEGER NOT NULL DEFAULT 0 CHECK (seuil_validation BETWEEN 0 AND 100000000),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      TEXT
);
INSERT INTO public.securite_equipe (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.securite_equipe ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.sessions_revocations (
  profile_id TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  avant      TIMESTAMPTZ NOT NULL,
  par_id     TEXT
);
ALTER TABLE public.sessions_revocations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.validations_admin (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL CHECK (type IN ('retrait', 'avance_commission', 'part_suguba')),
  dossier       TEXT NOT NULL CHECK (length(dossier) BETWEEN 3 AND 160),
  montant       NUMERIC(14,2),
  resume        JSONB NOT NULL DEFAULT '{}'::jsonb,
  empreinte     TEXT NOT NULL CHECK (empreinte ~ '^[0-9a-f]{64}$'),
  demandeur_id  TEXT NOT NULL,
  statut        TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'approuvee', 'refusee', 'executee', 'caduque')),
  decideur_id   TEXT,
  motif_decision TEXT CHECK (motif_decision IS NULL OR length(motif_decision) <= 500),
  cree_le       TIMESTAMPTZ NOT NULL DEFAULT now(),
  decide_le     TIMESTAMPTZ,
  execute_le    TIMESTAMPTZ,
  CONSTRAINT validations_quatre_yeux CHECK (decideur_id IS NULL OR decideur_id <> demandeur_id),
  CONSTRAINT validations_decision CHECK (statut NOT IN ('approuvee', 'refusee') OR decideur_id IS NOT NULL)
);
-- Une seule demande ouverte (en attente ou approuvée) par dossier.
CREATE UNIQUE INDEX IF NOT EXISTS validations_admin_ouverte_idx
  ON public.validations_admin (type, dossier) WHERE statut IN ('en_attente', 'approuvee');
CREATE INDEX IF NOT EXISTS validations_admin_statut_idx ON public.validations_admin (statut, cree_le DESC);
ALTER TABLE public.validations_admin ENABLE ROW LEVEL SECURITY;

-- Une décision ne revient pas en arrière : refusée, exécutée ou caduque est définitif.
CREATE OR REPLACE FUNCTION public.validation_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.statut IN ('refusee', 'executee', 'caduque') THEN
    RAISE EXCEPTION 'VALIDATION_CLOSE';
  END IF;
  IF OLD.statut = 'approuvee' AND NEW.statut NOT IN ('approuvee', 'executee', 'caduque') THEN
    RAISE EXCEPTION 'VALIDATION_CLOSE';
  END IF;
  IF NEW.empreinte <> OLD.empreinte OR NEW.demandeur_id <> OLD.demandeur_id OR NEW.montant IS DISTINCT FROM OLD.montant THEN
    RAISE EXCEPTION 'VALIDATION_FIGEE';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validations_admin_transition ON public.validations_admin;
CREATE TRIGGER validations_admin_transition BEFORE UPDATE ON public.validations_admin
  FOR EACH ROW EXECUTE FUNCTION public.validation_transition();

NOTIFY pgrst, 'reload schema';
