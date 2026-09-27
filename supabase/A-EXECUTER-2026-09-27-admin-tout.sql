-- ═══════════════════════════════════════════════════════════════════════════
-- Admin A1 à A4 (2026-09-27) — les 4 scripts réunis, dans l'ordre.
-- À coller en entier dans le SQL Editor de Supabase, puis « Run ».
-- Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

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

