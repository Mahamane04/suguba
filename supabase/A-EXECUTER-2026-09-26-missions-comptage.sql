-- ═══════════════════════════════════════════════════════════════════════════
-- Missions : compteurs fiables (2026-09-26, lot 2a « Campagnes encadrées »)
--
-- Avant :
--   • un « partage » comptait dès qu'un lien était CRÉÉ — créer dix liens sans
--     rien publier faisait avancer la mission de dix ;
--   • chaque clic comptait, y compris le même visiteur qui revient, le
--     revendeur lui-même et les robots d'aperçu (WhatsApp, Facebook…).
--
-- Désormais :
--   • chaque progression est un ÉVÉNEMENT à clé unique par participation
--     (mission_events) : un même visiteur, une même preuve, un même
--     parrainage ne comptent qu'une fois ;
--   • la progression se fait dans une seule fonction atomique, qui vérifie
--     aussi que la mission est active et dans ses dates ;
--   • un partage ne compte que sur PREUVE de publication validée par
--     l'équipe (mission_proofs) ; une même capture ne peut servir qu'une fois.
--
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.mission_events (
  participant_id TEXT NOT NULL REFERENCES public.mission_participants(id) ON DELETE CASCADE,
  cle            TEXT NOT NULL CHECK (length(cle) BETWEEN 1 AND 200),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (participant_id, cle)
);
ALTER TABLE public.mission_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.mission_proofs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id       TEXT NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  participant_id   TEXT NOT NULL REFERENCES public.mission_participants(id) ON DELETE CASCADE,
  reseller_id      TEXT NOT NULL,
  canal            TEXT NOT NULL CHECK (canal IN ('whatsapp_statut', 'whatsapp_groupe', 'facebook', 'instagram', 'tiktok', 'autre')),
  lien_publication TEXT CHECK (lien_publication IS NULL OR lien_publication ~ '^https://'),
  image_hash       TEXT NOT NULL,
  note             TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected')),
  motif_rejet      TEXT,
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Une même capture d'écran ne sert qu'une fois par revendeur.
  UNIQUE (reseller_id, image_hash)
);
CREATE INDEX IF NOT EXISTS mission_proofs_status_idx ON public.mission_proofs (status, created_at);
ALTER TABLE public.mission_proofs ENABLE ROW LEVEL SECURITY;

-- Progression atomique : un événement à clé unique, une seule fois.
CREATE OR REPLACE FUNCTION public.compter_evenement_mission(p_participant_id TEXT, p_cle TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_part    public.mission_participants%ROWTYPE;
  v_mission public.missions%ROWTYPE;
  v_ajoute  INTEGER;
  v_progres INTEGER;
BEGIN
  SELECT * INTO v_part FROM public.mission_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND OR v_part.status <> 'joined' THEN
    RETURN jsonb_build_object('compte', false, 'raison', 'participation');
  END IF;
  SELECT * INTO v_mission FROM public.missions WHERE id = v_part.mission_id;
  IF v_mission.status <> 'active' OR now() < v_mission.starts_at
     OR (v_mission.ends_at IS NOT NULL AND now() > v_mission.ends_at) THEN
    RETURN jsonb_build_object('compte', false, 'raison', 'mission');
  END IF;

  INSERT INTO public.mission_events (participant_id, cle) VALUES (p_participant_id, p_cle)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_ajoute = ROW_COUNT;
  IF v_ajoute = 0 THEN
    RETURN jsonb_build_object('compte', false, 'raison', 'deja', 'progres', v_part.progress);
  END IF;

  v_progres := v_part.progress + 1;
  UPDATE public.mission_participants
     SET progress = v_progres,
         status = CASE WHEN v_progres >= GREATEST(v_mission.objective, 1) THEN 'completed' ELSE status END,
         completed_at = CASE WHEN v_progres >= GREATEST(v_mission.objective, 1) THEN now() ELSE completed_at END
   WHERE id = p_participant_id;
  RETURN jsonb_build_object('compte', true, 'progres', v_progres);
END;
$$;
REVOKE ALL ON FUNCTION public.compter_evenement_mission(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compter_evenement_mission(TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
