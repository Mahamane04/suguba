-- ============================================================================
-- SUGUBA — RÉSEAU V1 : tracking, attribution, boutiques, parrainage,
--                       missions, sponsorisation, vérifications, équipe admin
-- ============================================================================
--
-- Ce fichier est la traduction en base du cahier des charges « Évolution
-- fonctionnelle de la plateforme ». Il ne touche à AUCUNE table existante en
-- destructif : uniquement des CREATE TABLE IF NOT EXISTS et des ADD COLUMN
-- IF NOT EXISTS. Rejouable autant de fois que nécessaire.
--
-- Le trio à sécuriser en premier (dixit le cahier des charges) est
-- Tracking → Attribution → Commission : tout le reste (parrainage, missions,
-- sponsorisation, analytics) s'y raccroche par le code de lien `link_code`.
--
-- ⚠️ Aucune de ces tables n'a de politique RLS permissive : elles sont lues et
-- écrites exclusivement par le serveur Next.js avec la clé service_role
-- (src/lib/supabase-admin.ts). RLS est activé comme filet, sans policy = accès
-- refusé à la clé anon.
-- ============================================================================

-- ── 1. BOUTIQUES GÉNÉRIQUES ────────────────────────────────────────────────
-- Une seule notion de boutique pour le fournisseur, le revendeur ET Suguba
-- elle-même (§ G du cahier des charges). Sans ce choix, « Suguba comme
-- vendeur » (§ 24) aurait exigé un troisième système parallèle.
CREATE TABLE IF NOT EXISTS public.stores (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  owner_type   TEXT NOT NULL CHECK (owner_type IN ('supplier', 'reseller', 'suguba')),
  owner_id     TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug         TEXT NOT NULL,
  name         TEXT NOT NULL,
  tagline      TEXT,
  description  TEXT,
  logo_url     TEXT,
  cover_url    TEXT,
  gallery      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  categories   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  whatsapp     TEXT,
  is_recruiting BOOLEAN NOT NULL DEFAULT false,
  followers_count INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'suspended')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS stores_slug_key ON public.stores (lower(slug));
CREATE UNIQUE INDEX IF NOT EXISTS stores_owner_key ON public.stores (owner_type, owner_id) WHERE owner_id IS NOT NULL;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN public.stores.slug IS
  'Adresse publique /boutique/<slug>. Attribuée une fois, jamais modifiée : elle circule dans des liens déjà partagés.';

-- Galerie et recrutement côté fournisseur (§ 7 et § 18) : les fournisseurs
-- existants gardent leur fiche `suppliers`, la boutique la complète.
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS gallery TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_recruiting BOOLEAN NOT NULL DEFAULT false;

-- ── 2. ABONNEMENTS À UNE BOUTIQUE (§ 10) ───────────────────────────────────
-- `follower_key` vaut l'id de profil pour un compte, ou le téléphone
-- normalisé pour un client pas encore inscrit : suivre une boutique ne doit
-- pas exiger de créer un compte, sinon plus personne ne suit.
CREATE TABLE IF NOT EXISTS public.store_follows (
  store_id     TEXT NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  follower_key TEXT NOT NULL,
  follower_id  TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, follower_key)
);
CREATE INDEX IF NOT EXISTS idx_store_follows_follower ON public.store_follows (follower_key);
ALTER TABLE public.store_follows ENABLE ROW LEVEL SECURITY;

-- ── 3. LIENS TRACKÉS (§ 11, § 19) ──────────────────────────────────────────
-- Le cœur du dispositif. Un QR code n'est PAS un système parallèle : c'est un
-- lien tracké rendu en image (§ L du cahier des charges).
CREATE TABLE IF NOT EXISTS public.tracking_links (
  code         TEXT PRIMARY KEY,
  owner_id     TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_role   TEXT,
  target_type  TEXT NOT NULL CHECK (target_type IN ('product', 'store', 'referral', 'campaign', 'mission', 'home')),
  target_ref   TEXT,
  channel      TEXT NOT NULL DEFAULT 'autre',
  label        TEXT,
  clicks       INTEGER NOT NULL DEFAULT 0,
  visitors     INTEGER NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  revenue      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_click_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tracking_links_owner ON public.tracking_links (owner_id, created_at DESC);
ALTER TABLE public.tracking_links ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.tracking_clicks (
  id           BIGSERIAL PRIMARY KEY,
  link_code    TEXT NOT NULL REFERENCES public.tracking_links(code) ON DELETE CASCADE,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Empreinte du visiteur, jamais son IP : suffisant pour distinguer deux
  -- visiteurs, insuffisant pour remonter à une personne.
  visitor_hash TEXT,
  referer      TEXT,
  device       TEXT
);
CREATE INDEX IF NOT EXISTS idx_tracking_clicks_link ON public.tracking_clicks (link_code, occurred_at DESC);
ALTER TABLE public.tracking_clicks ENABLE ROW LEVEL SECURITY;

-- Incrément atomique d'un clic : deux scans simultanés du même QR ne doivent
-- pas se marcher dessus (lecture + écriture côté application le permettrait).
CREATE OR REPLACE FUNCTION public.enregistrer_clic_tracking(
  p_code TEXT,
  p_visitor_hash TEXT,
  p_referer TEXT,
  p_device TEXT
)
RETURNS TABLE (target_type TEXT, target_ref TEXT, owner_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nouveau BOOLEAN;
BEGIN
  SELECT NOT EXISTS (
    SELECT 1 FROM public.tracking_clicks c
    WHERE c.link_code = p_code AND c.visitor_hash = p_visitor_hash
  ) INTO v_nouveau;

  INSERT INTO public.tracking_clicks (link_code, visitor_hash, referer, device)
  VALUES (p_code, p_visitor_hash, p_referer, p_device);

  UPDATE public.tracking_links l
     SET clicks = l.clicks + 1,
         visitors = l.visitors + (CASE WHEN v_nouveau THEN 1 ELSE 0 END),
         last_click_at = NOW()
   WHERE l.code = p_code;

  RETURN QUERY
    SELECT l.target_type, l.target_ref, l.owner_id
      FROM public.tracking_links l
     WHERE l.code = p_code;
END;
$$;
REVOKE ALL ON FUNCTION public.enregistrer_clic_tracking(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enregistrer_clic_tracking(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ── 4. ATTRIBUTION CLIENT → REVENDEUR (§ 9, § J) ───────────────────────────
-- Une ligne par client (identifié par son téléphone normalisé). Le revendeur
-- référent est celui du PREMIER contact : sans cette règle, un revendeur
-- pourrait « voler » le client d'un autre en lui renvoyant son lien juste
-- avant l'achat. `last_*` garde tout de même la trace du dernier passage,
-- utile pour les statistiques de partage sans toucher à la rémunération.
CREATE TABLE IF NOT EXISTS public.customer_attributions (
  customer_phone TEXT PRIMARY KEY,
  reseller_id    TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  source         TEXT NOT NULL DEFAULT 'lien',
  link_code      TEXT,
  first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_source    TEXT,
  last_link_code TEXT,
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  orders_count   INTEGER NOT NULL DEFAULT 0,
  revenue        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  customer_name  TEXT
);
CREATE INDEX IF NOT EXISTS idx_customer_attributions_reseller
  ON public.customer_attributions (reseller_id, last_seen_at DESC);
ALTER TABLE public.customer_attributions ENABLE ROW LEVEL SECURITY;

-- ── 5. PARRAINAGE (§ 12, § M) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referrals (
  id            TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  referrer_id   TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('customer', 'reseller', 'supplier')),
  referred_phone TEXT,
  referred_profile_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  link_code     TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'rewarded', 'rejected')),
  reward_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS referrals_unique_filleul
  ON public.referrals (referrer_id, kind, referred_phone) WHERE referred_phone IS NOT NULL;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- ── 6. MISSIONS (§ 13, § T) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.missions (
  id            TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  title         TEXT NOT NULL,
  description   TEXT,
  mission_type  TEXT NOT NULL CHECK (mission_type IN ('share', 'click', 'sale', 'referral', 'post', 'view')),
  objective     INTEGER NOT NULL DEFAULT 1,
  reward_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reward_label  TEXT,
  conditions    TEXT,
  supplier_id   TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  product_id    TEXT REFERENCES public.products(id) ON DELETE SET NULL,
  created_by    TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  starts_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at       TIMESTAMPTZ,
  max_participants INTEGER,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_missions_status ON public.missions (status, ends_at);
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.mission_participants (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  mission_id   TEXT NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  reseller_id  TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress     INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'completed', 'validated', 'rejected')),
  proof_url    TEXT,
  link_code    TEXT,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  UNIQUE (mission_id, reseller_id)
);
CREATE INDEX IF NOT EXISTS idx_mission_participants_reseller
  ON public.mission_participants (reseller_id, status);
ALTER TABLE public.mission_participants ENABLE ROW LEVEL SECURITY;

-- ── 7. SPONSORISATION ET PUBLICITÉS INTERNES (§ 16, § 17, § V) ─────────────
CREATE TABLE IF NOT EXISTS public.sponsorship_plans (
  id            TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name          TEXT NOT NULL,
  price         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  shares_target INTEGER NOT NULL DEFAULT 0,
  max_resellers INTEGER NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 7,
  slots         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  description   TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.sponsorship_plans ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.sponsorships (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  plan_id      TEXT REFERENCES public.sponsorship_plans(id) ON DELETE SET NULL,
  supplier_id  TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('product', 'store', 'promotion', 'campaign')),
  subject_ref  TEXT,
  label        TEXT,
  slot         TEXT NOT NULL DEFAULT 'home_products',
  budget       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'ended', 'rejected')),
  starts_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at      TIMESTAMPTZ,
  impressions  INTEGER NOT NULL DEFAULT 0,
  clicks       INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sponsorships_slot ON public.sponsorships (slot, status, ends_at);
ALTER TABLE public.sponsorships ENABLE ROW LEVEL SECURITY;

-- Packs de départ, ceux du cahier des charges (§ 16). Prix entièrement
-- modifiables depuis l'administration : ce ne sont que des valeurs initiales.
INSERT INTO public.sponsorship_plans (id, name, price, shares_target, max_resellers, duration_days, slots, description, position)
VALUES
  ('plan_starter',  'Visibilité Starter',  10000, 200,  10, 7,  ARRAY['home_products', 'reseller_dashboard'], 'Votre produit remonte en tête du catalogue revendeur pendant 7 jours.', 1),
  ('plan_boost',    'Visibilité Boost',    25000, 600,  30, 14, ARRAY['home_hero', 'home_products', 'search_top'], 'Mise en avant sur l''accueil et en tête des résultats de recherche.', 2),
  ('plan_recrute',  'Recrutement revendeurs', 15000, 0, 50, 30, ARRAY['reseller_dashboard', 'category_top'], 'Votre boutique apparaît dans « Ces boutiques recherchent des revendeurs ».', 3)
ON CONFLICT (id) DO NOTHING;

-- ── 8. VÉRIFICATIONS ET BADGES (§ 5, § E) ──────────────────────────────────
-- Les badges ne sont PAS codés en dur (exigence explicite du cahier des
-- charges) : un badge est une simple chaîne, le catalogue vit dans
-- src/lib/reseau/badges.ts et peut s'étendre sans migration.
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  profile_id   TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('identity', 'selfie', 'location', 'business', 'phone', 'email')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  document_url TEXT,
  data         JSONB NOT NULL DEFAULT '{}'::jsonb,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  TEXT REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_verification_requests_file
  ON public.verification_requests (status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS verification_requests_en_cours
  ON public.verification_requests (profile_id, kind) WHERE status = 'pending';
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_badges (
  profile_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge      TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (profile_id, badge)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- ── 9. ÉQUIPE ADMINISTRATIVE (§ 23, § D) ───────────────────────────────────
-- RBAC minimal mais réel : un membre a un rôle d'équipe et une liste de
-- permissions. Le super-admin garde tout ; les autres n'ont que le nécessaire.
CREATE TABLE IF NOT EXISTS public.admin_team_members (
  profile_id  TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_role   TEXT NOT NULL DEFAULT 'support',
  permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  TEXT REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.admin_team_members ENABLE ROW LEVEL SECURITY;

-- ── 10. ÉVÉNEMENTS ANALYTIQUES (§ Y) ───────────────────────────────────────
-- Journal d'événements bruts. Les agrégats se calculent à la demande pour
-- l'instant ; quand le volume l'exigera, une table `daily_metrics` se
-- construira à partir d'ici sans changer le code qui écrit.
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id           BIGSERIAL PRIMARY KEY,
  event        TEXT NOT NULL,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id     TEXT,
  reseller_id  TEXT,
  supplier_id  TEXT,
  subject_type TEXT,
  subject_ref  TEXT,
  link_code    TEXT,
  amount       NUMERIC(12, 2),
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_reseller ON public.analytics_events (reseller_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_supplier ON public.analytics_events (supplier_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON public.analytics_events (event, occurred_at DESC);
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- ── 11. CONVERSION : RATTACHER UNE COMMANDE À SON LIEN ──────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS link_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS attribution_source TEXT;

-- Enregistre une conversion : compteurs du lien, du client attribué, et de
-- la progression des missions de type « vente » du revendeur. Le tout en une
-- transaction — une conversion à moitié comptée fausserait la rémunération.
CREATE OR REPLACE FUNCTION public.enregistrer_conversion(
  p_link_code TEXT,
  p_customer_phone TEXT,
  p_reseller_id TEXT,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_link_code IS NOT NULL THEN
    UPDATE public.tracking_links
       SET orders_count = orders_count + 1,
           revenue = revenue + COALESCE(p_amount, 0)
     WHERE code = p_link_code;
  END IF;

  IF p_customer_phone IS NOT NULL THEN
    UPDATE public.customer_attributions
       SET orders_count = orders_count + 1,
           revenue = revenue + COALESCE(p_amount, 0),
           last_seen_at = NOW()
     WHERE customer_phone = p_customer_phone;
  END IF;

  IF p_reseller_id IS NOT NULL THEN
    UPDATE public.mission_participants mp
       SET progress = mp.progress + 1
      FROM public.missions m
     WHERE mp.mission_id = m.id
       AND mp.reseller_id = p_reseller_id
       AND mp.status = 'joined'
       AND m.status = 'active'
       AND m.mission_type = 'sale'
       AND (m.ends_at IS NULL OR m.ends_at > NOW());

    UPDATE public.mission_participants mp
       SET status = 'completed', completed_at = NOW()
      FROM public.missions m
     WHERE mp.mission_id = m.id
       AND mp.reseller_id = p_reseller_id
       AND mp.status = 'joined'
       AND mp.progress >= m.objective;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.enregistrer_conversion(TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enregistrer_conversion(TEXT, TEXT, TEXT, NUMERIC) TO service_role;

-- ── 12. COMPTEUR D'ABONNÉS ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rafraichir_abonnes_boutique(p_store_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_total INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.store_follows WHERE store_id = p_store_id;
  UPDATE public.stores SET followers_count = v_total, updated_at = NOW() WHERE id = p_store_id;
  RETURN v_total;
END;
$$;
REVOKE ALL ON FUNCTION public.rafraichir_abonnes_boutique(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rafraichir_abonnes_boutique(TEXT) TO service_role;
