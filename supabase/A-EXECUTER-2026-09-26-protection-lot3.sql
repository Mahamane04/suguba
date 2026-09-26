-- ═══════════════════════════════════════════════════════════════════════════
-- Protection Suguba — lot 3 (2026-09-26)
--
-- 1. Part Suguba : toute baisse (marge, taux, part revendeur relevée, code
--    promo, prix de gros sans gain…) exige un droit dédié et un MOTIF ; elle
--    est journalisée (journal_part_suguba), jamais effacée.
-- 2. Suspension d'un partenaire : motif obligatoire, visible par lui, qui
--    peut la CONTESTER ; ses engagements en cours et ses gains ne
--    disparaissent pas.
-- 3. Comptes liés : un revendeur ne peut pas participer à la campagne d'un
--    fournisseur auquel il est lié (même compte, membre de son équipe, même
--    numéro de téléphone). Garde-fou en base.
-- 4. Messagerie interne rattachée à un dossier (offre, devis) : un message
--    qui contient un numéro, un lien ou une invitation à traiter hors Suguba
--    attend la vérification de l'équipe avant d'être remis.
--
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Journal des baisses de la part Suguba ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.journal_part_suguba (
  id          BIGSERIAL PRIMARY KEY,
  admin_id    TEXT NOT NULL,
  motif       TEXT NOT NULL CHECK (length(trim(motif)) >= 5),
  changements JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.journal_part_suguba ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.journal_immuable()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'JOURNAL_IMMUABLE' USING ERRCODE = 'P0001';
END $$;
DROP TRIGGER IF EXISTS journal_part_suguba_immuable ON public.journal_part_suguba;
CREATE TRIGGER journal_part_suguba_immuable
  BEFORE UPDATE OR DELETE ON public.journal_part_suguba
  FOR EACH ROW EXECUTE FUNCTION public.journal_immuable();

-- ── 2. Suspensions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.suspensions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       TEXT NOT NULL,
  role             TEXT NOT NULL,
  motif            TEXT NOT NULL CHECK (length(trim(motif)) >= 5),
  suspendu_par     TEXT NOT NULL,
  suspendu_le      TIMESTAMPTZ NOT NULL DEFAULT now(),
  contestation     TEXT,
  contestee_le     TIMESTAMPTZ,
  levee_le         TIMESTAMPTZ,
  levee_par        TEXT,
  decision         TEXT
);
CREATE INDEX IF NOT EXISTS suspensions_profil_idx ON public.suspensions (profile_id, suspendu_le DESC);
-- Une seule suspension en cours par rôle.
CREATE UNIQUE INDEX IF NOT EXISTS suspensions_en_cours_unique
  ON public.suspensions (profile_id, role) WHERE levee_le IS NULL;
ALTER TABLE public.suspensions ENABLE ROW LEVEL SECURITY;

-- ── 3. Comptes liés ─────────────────────────────────────────────────────────
-- L'équipe fournisseur (supplier_members) n'existe que si son SQL a été
-- exécuté : la fonction la consulte seulement si la table est là.
CREATE OR REPLACE FUNCTION public.comptes_lies(p_a TEXT, p_b TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_equipe BOOLEAN := false;
BEGIN
  IF p_a IS NULL OR p_b IS NULL THEN RETURN false; END IF;
  IF p_a = p_b THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles x, public.profiles y
              WHERE x.id = p_a AND y.id = p_b
                AND length(regexp_replace(COALESCE(x.phone, ''), '\D', '', 'g')) >= 8
                AND right(regexp_replace(COALESCE(x.phone, ''), '\D', '', 'g'), 8) = right(regexp_replace(COALESCE(y.phone, ''), '\D', '', 'g'), 8)) THEN
    RETURN true;
  END IF;
  IF to_regclass('public.supplier_members') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.supplier_members m
               WHERE m.status IN (''accepted'', ''active'')
                 AND ((m.supplier_id = $1 AND m.member_id = $2) OR (m.supplier_id = $2 AND m.member_id = $1)))'
      INTO v_equipe USING p_a, p_b;
  END IF;
  RETURN COALESCE(v_equipe, false);
END $$;
REVOKE ALL ON FUNCTION public.comptes_lies(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.refuser_participation_liee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fournisseur TEXT;
BEGIN
  SELECT supplier_id INTO v_fournisseur FROM public.missions WHERE id = NEW.mission_id;
  IF public.comptes_lies(v_fournisseur, NEW.reseller_id) THEN
    RAISE EXCEPTION 'COMPTE_LIE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mission_participants_comptes_lies ON public.mission_participants;
CREATE TRIGGER mission_participants_comptes_lies
  BEFORE INSERT ON public.mission_participants
  FOR EACH ROW EXECUTE FUNCTION public.refuser_participation_liee();

-- ── 4. Messagerie interne ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sujet_type         TEXT NOT NULL CHECK (sujet_type IN ('offre', 'devis')),
  sujet_id           TEXT NOT NULL,
  fournisseur_id     TEXT NOT NULL,
  revendeur_id       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  dernier_message_le TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS conversations_sujet_unique
  ON public.conversations (sujet_type, sujet_id, COALESCE(revendeur_id, ''));
CREATE INDEX IF NOT EXISTS conversations_fournisseur_idx ON public.conversations (fournisseur_id, dernier_message_le DESC);
CREATE INDEX IF NOT EXISTS conversations_revendeur_idx ON public.conversations (revendeur_id, dernier_message_le DESC);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  auteur_type     TEXT NOT NULL CHECK (auteur_type IN ('revendeur', 'fournisseur', 'client', 'suguba')),
  auteur_id       TEXT,
  texte           TEXT NOT NULL CHECK (length(trim(texte)) BETWEEN 1 AND 1000),
  statut          TEXT NOT NULL DEFAULT 'publie' CHECK (statut IN ('publie', 'en_attente', 'refuse')),
  motifs          TEXT[] NOT NULL DEFAULT '{}',
  motif_refus     TEXT,
  modere_par      TEXT,
  modere_le       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_attente_idx ON public.messages (statut, created_at) WHERE statut = 'en_attente';
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
