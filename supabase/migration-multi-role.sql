-- ============================================================================
-- SUGUBA — MIGRATION MULTI-RÔLE
-- ============================================================================
--
-- Problème résolu : `profiles.role` ne contient qu'une seule valeur et
-- `profiles.phone` est UNIQUE. Un fournisseur qui veut aussi livrer devait
-- donc créer un second compte avec une seconde carte SIM.
--
-- Principe : `profile_roles` devient la source de vérité des rôles détenus.
-- Les colonnes existantes ne sont PAS supprimées — elles prennent un sens
-- distinct, sans doublon :
--
--   profiles.role        -> rôle par défaut à la connexion (« rôle principal »)
--   profiles.status      -> statut du COMPTE (un compte suspendu l'est en entier)
--   profile_roles.status -> statut de CHAQUE rôle, validé séparément
--
-- Cette séparation est ce qui évite l'incident classique : sans elle, valider
-- la candidature « livreur » de quelqu'un remettrait à zéro son statut de
-- revendeur actif, ou l'inverse.
--
-- Idempotent : réexécutable sans dommage.
-- ============================================================================

-- 1. LA TABLE DES RÔLES DÉTENUS ---------------------------------------------

CREATE TABLE IF NOT EXISTS public.profile_roles (
  profile_id  TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('reseller', 'supplier', 'driver', 'admin', 'customer', 'diaspora')),
  status      TEXT NOT NULL DEFAULT 'pending_approval'
              CHECK (status IN ('pending_approval', 'active', 'suspended', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  PRIMARY KEY (profile_id, role)
);

CREATE INDEX IF NOT EXISTS idx_profile_roles_profile ON public.profile_roles(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_roles_pending
  ON public.profile_roles(status) WHERE status = 'pending_approval';

COMMENT ON TABLE public.profile_roles IS
  'Rôles détenus par un compte. Source de vérité du multi-rôle : profiles.role ne conserve que le rôle par défaut à la connexion.';
COMMENT ON COLUMN public.profile_roles.status IS
  'Statut de CE rôle uniquement. Distinct de profiles.status, qui vaut pour le compte entier.';

-- 2. REPRISE DE L'EXISTANT ---------------------------------------------------
-- Chaque compte conserve exactement ce qu'il avait : son rôle actuel, avec son
-- statut actuel. Aucun droit n'est accordé ni retiré par cette migration.

INSERT INTO public.profile_roles (profile_id, role, status, approved_at)
SELECT
  p.id,
  p.role,
  p.status,
  CASE WHEN p.status = 'active' THEN COALESCE(p.updated_at, p.created_at, NOW()) END
FROM public.profiles p
ON CONFLICT (profile_id, role) DO NOTHING;

-- 3. SÉCURITÉ ----------------------------------------------------------------
-- Même politique que `profiles` : aucune ouverture publique. Les rôles
-- décident des accès, les exposer à la clé anon reviendrait à publier la
-- cartographie des permissions de la plateforme.

ALTER TABLE public.profile_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profile_roles access" ON public.profile_roles;
DROP POLICY IF EXISTS "profile_roles service only" ON public.profile_roles;

-- Aucune policy n'est créée : seule la clé service_role (qui contourne RLS)
-- peut lire et écrire, exactement comme pour `profiles` et `payouts`.

-- 4. ATTRIBUER UN RÔLE — fonction utilitaire ---------------------------------
-- Empêche deux dérives : qu'un compte s'attribue le rôle admin, et qu'une
-- nouvelle demande de rôle écrase un rôle déjà validé.

CREATE OR REPLACE FUNCTION public.demander_role(
  p_profile_id TEXT,
  p_role       TEXT
) RETURNS public.profile_roles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ligne public.profile_roles;
BEGIN
  IF p_role = 'admin' THEN
    RAISE EXCEPTION 'Le rôle admin ne peut pas être demandé, il se pose en base par un opérateur de confiance.';
  END IF;

  INSERT INTO public.profile_roles (profile_id, role, status)
  VALUES (p_profile_id, p_role, 'pending_approval')
  -- Un rôle déjà présent garde son statut : redemander « livreur » quand on
  -- l'est déjà ne doit pas repasser le compte en attente de validation.
  ON CONFLICT (profile_id, role) DO UPDATE SET role = EXCLUDED.role
  RETURNING * INTO v_ligne;

  RETURN v_ligne;
END;
$$;

-- 5. VÉRIFICATION ------------------------------------------------------------
-- À exécuter après la migration : chaque compte doit avoir au moins un rôle,
-- et le total doit correspondre au nombre de profils.
--
--   SELECT (SELECT COUNT(*) FROM public.profiles)      AS comptes,
--          (SELECT COUNT(DISTINCT profile_id)
--             FROM public.profile_roles)               AS comptes_avec_role;
--
-- Les deux chiffres doivent être identiques.
