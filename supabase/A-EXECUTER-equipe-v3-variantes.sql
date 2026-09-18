-- SUGUBA — MISE À JOUR : équipe fournisseur + réseau V3 + variantes (rejouable)

-- ########## migration-equipe-fournisseur.sql ##########
-- ============================================================================
-- SUGUBA — ÉQUIPE FOURNISSEUR (§ F du cahier des charges)
-- ============================================================================
-- Un fournisseur invite des collaborateurs (commercial, stock, marketing).
-- Chacun garde SON compte et travaille sur le catalogue du fournisseur, avec
-- les seuls droits de son rôle.
--
-- Cycle : invited → accepted → active (ou revoked).
-- L'étape « accepted » existe parce que le numéro de téléphone d'un compte
-- est DÉCLARÉ, pas vérifié (aucun code SMS à la connexion) : quelqu'un
-- pourrait s'inscrire avec le numéro d'un invité. Le propriétaire voit donc
-- qui a accepté (nom, e-mail) et confirme lui-même avant d'ouvrir l'accès.
--
-- Additif et rejouable. Aucune table existante n'est modifiée.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.supplier_members (
  id            TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  supplier_id   TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_id     TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_phone TEXT NOT NULL,
  member_role   TEXT NOT NULL CHECK (member_role IN ('commercial', 'stock', 'marketing')),
  status        TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'active', 'revoked')),
  invited_by    TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at   TIMESTAMPTZ,
  UNIQUE (supplier_id, invited_phone)
);

-- Un collaborateur ne travaille que pour UN fournisseur à la fois : sinon
-- chaque écran devrait demander « pour qui agissez-vous ? », et une erreur
-- de choix modifierait le catalogue d'un autre.
CREATE UNIQUE INDEX IF NOT EXISTS supplier_members_un_seul_fournisseur
  ON public.supplier_members (member_id) WHERE status = 'active' AND member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_members_phone ON public.supplier_members (invited_phone) WHERE status = 'invited';

ALTER TABLE public.supplier_members ENABLE ROW LEVEL SECURITY;

-- ########## migration-reseau-v3.sql ##########
-- ============================================================================
-- SUGUBA — RÉSEAU V3 : compteurs de sponsorisation
-- ============================================================================
-- À exécuter après migration-reseau-v1.sql. Additif et rejouable.
--
-- Incrément atomique des vues et des clics d'une sponsorisation : deux
-- visiteurs simultanés ne doivent pas s'écraser (lecture + écriture côté
-- application le permettrait). Seules les sponsorisations ACTIVES comptent.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.compter_sponsorisation(p_ids TEXT[], p_evenement TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_ids IS NULL OR pg_catalog.array_length(p_ids, 1) IS NULL OR pg_catalog.array_length(p_ids, 1) > 30 THEN
    RETURN;
  END IF;
  IF p_evenement = 'vue' THEN
    UPDATE public.sponsorships SET impressions = impressions + 1
     WHERE id = ANY(p_ids) AND status = 'active';
  ELSIF p_evenement = 'clic' THEN
    UPDATE public.sponsorships SET clicks = clicks + 1
     WHERE id = ANY(p_ids) AND status = 'active';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.compter_sponsorisation(TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compter_sponsorisation(TEXT[], TEXT) TO service_role;

-- ── Conversion : ne faire avancer que les missions du BON produit ──────────
-- La première version faisait progresser toutes les missions « vente » du
-- revendeur, y compris une campagne fournisseur portant sur un autre produit.
CREATE OR REPLACE FUNCTION public.enregistrer_conversion_produit(
  p_link_code TEXT,
  p_customer_phone TEXT,
  p_reseller_id TEXT,
  p_amount NUMERIC,
  p_product_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_link_code IS NOT NULL THEN
    UPDATE public.tracking_links
       SET orders_count = orders_count + 1, revenue = revenue + COALESCE(p_amount, 0)
     WHERE code = p_link_code;
  END IF;

  IF p_customer_phone IS NOT NULL THEN
    UPDATE public.customer_attributions
       SET orders_count = orders_count + 1, revenue = revenue + COALESCE(p_amount, 0), last_seen_at = NOW()
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
       AND (m.product_id IS NULL OR m.product_id = p_product_id)
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
REVOKE ALL ON FUNCTION public.enregistrer_conversion_produit(TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enregistrer_conversion_produit(TEXT, TEXT, TEXT, NUMERIC, TEXT) TO service_role;

-- ########## migration-variantes.sql ##########
-- ============================================================================
-- SUGUBA — VARIANTES DE PRODUIT (§ H : « TCL Smart TV 43 / 55 / 65 pouces »)
-- ============================================================================
-- Additif et rejouable.
--
-- Une variante est un PRODUIT à part entière (son prix, son stock, sa
-- commission), relié à ses sœurs par `variant_group`. Ce choix évite de
-- toucher au moteur de prix, aux commandes et aux commissions, qui
-- fonctionnent tous produit par produit — et une TV 65 pouces n'a ni le prix
-- ni le stock d'une 43 pouces.
-- ============================================================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variant_group TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variant_label TEXT;
CREATE INDEX IF NOT EXISTS idx_products_variant_group ON public.products (variant_group) WHERE variant_group IS NOT NULL;

