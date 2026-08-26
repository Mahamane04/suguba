-- ============================================================================
-- SUGUBA — TABLE FOURNISSEURS RÉELLE
-- ============================================================================
--
-- Jusqu'ici, la fiche fournisseur (entreprise, entrepôt, catégorie, RCCM/NIF)
-- n'existait que dans INITIAL_SUPPLIERS (src/lib/mock-data.ts) — des données
-- fictives locales, jamais persistées. Le vrai compte (Google/OTP) atterrit
-- bien dans `profiles` + `profile_roles`, mais les détails métier du dossier
-- fournisseur n'avaient nulle part où aller côté serveur.
--
-- `suppliers` n'a volontairement PAS sa propre colonne de statut : le statut
-- (pending_approval / active / rejected) reste porté par `profile_roles`
-- (role = 'supplier') pour ce profil — dupliquer le statut à deux endroits
-- est exactement le genre d'incohérence qui a déjà coûté cher sur ce projet
-- (voir le bug de validation qui n'avait d'effet que 7 jours plus tard).
--
-- Idempotent : réexécutable sans dommage.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.suppliers (
  profile_id             TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name           TEXT NOT NULL,
  manager_name           TEXT,
  contact_phone          TEXT,
  warehouse_address      TEXT,
  warehouse_neighborhood TEXT,
  category               TEXT,
  rccm_or_nif            TEXT,
  total_products         INTEGER NOT NULL DEFAULT 0,
  total_revenue          NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.suppliers IS
  'Détails métier du dossier fournisseur. Le statut du dossier vit dans profile_roles (role=supplier), pas ici — voir le commentaire en tête de fichier.';

-- Même politique que profiles/profile_roles : aucune ouverture publique,
-- seule la clé service_role (routes API authentifiées) lit et écrit ici.
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public suppliers access" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers service only" ON public.suppliers;

-- Vérification à exécuter après la migration :
--   SELECT * FROM public.suppliers LIMIT 5;
-- (0 ligne est normal tant qu'aucun vrai fournisseur ne s'est inscrit.)
