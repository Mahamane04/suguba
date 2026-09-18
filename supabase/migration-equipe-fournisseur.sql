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
