-- ============================================================================
-- SUGUBA — RÉSEAU V2 : récompenses versées, notifications, calendrier,
--                       réglages du réseau
-- ============================================================================
-- À exécuter APRÈS migration-reseau-v1.sql. Additif et rejouable.
-- ============================================================================

-- ── 1. RÉCOMPENSES DANS LE GRAND-LIVRE DES COMMISSIONS ─────────────────────
-- Une récompense de mission ou de parrainage n'est pas un « bonus à part » :
-- elle entre dans le MÊME grand-livre que les commissions de vente. Le solde,
-- les retraits et leurs garde-fous (réservation atomique, délai de sécurité)
-- s'appliquent donc sans une ligne de code en plus — et le revendeur voit un
-- seul solde, pas deux.
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'vente';
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS source_ref TEXT;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS label TEXT;

-- Une mission validée ou un parrainage ne peut être payé QU'UNE fois, même si
-- deux admins cliquent en même temps : c'est la base qui l'interdit.
CREATE UNIQUE INDEX IF NOT EXISTS commissions_recompense_unique
  ON public.commissions (source, source_ref)
  WHERE source <> 'vente' AND source_ref IS NOT NULL;

CREATE OR REPLACE FUNCTION public.verser_recompense(
  p_source TEXT,
  p_source_ref TEXT,
  p_reseller_id TEXT,
  p_montant NUMERIC,
  p_label TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_source NOT IN ('mission', 'parrainage') THEN
    RAISE EXCEPTION 'SOURCE_INCONNUE';
  END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.commissions (reseller_id, amount, status, source, source_ref, label, available_at)
  VALUES (p_reseller_id, p_montant, 'available', p_source, p_source_ref, p_label, NOW())
  ON CONFLICT DO NOTHING;

  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.verser_recompense(TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verser_recompense(TEXT, TEXT, TEXT, NUMERIC, TEXT) TO service_role;

-- ── 2. NOTIFICATIONS DANS L'APPLICATION (§ W) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          BIGSERIAL PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'info',
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_profile ON public.notifications (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_non_lues ON public.notifications (profile_id) WHERE read_at IS NULL;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ── 3. CALENDRIER DE PUBLICATION (§ 14) ────────────────────────────────────
-- Suguba ne publie RIEN à la place du revendeur : pas d'API WhatsApp
-- personnelle, et un envoi automatique depuis son numéro le ferait bannir.
-- Le calendrier planifie, rappelle, et prépare le partage en un geste.
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  reseller_id  TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  planned_for  DATE NOT NULL,
  channel      TEXT NOT NULL DEFAULT 'whatsapp',
  product_slug TEXT,
  title        TEXT NOT NULL,
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'published', 'skipped')),
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_reseller ON public.scheduled_posts (reseller_id, planned_for);
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

-- ── 4. RÉGLAGES DU RÉSEAU ──────────────────────────────────────────────────
-- Séparés de platform_settings : ceux-là pilotent les prix et sont validés
-- par le moteur de tarification ; mélanger les deux ferait passer un montant
-- de parrainage dans la validation des marges.
CREATE TABLE IF NOT EXISTS public.reseau_reglages (
  id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  valeurs    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.reseau_reglages ENABLE ROW LEVEL SECURITY;
INSERT INTO public.reseau_reglages (id, valeurs)
VALUES (1, '{"primeParrainageClient": 500, "primeParrainageRevendeur": 2000}'::jsonb)
ON CONFLICT (id) DO NOTHING;
