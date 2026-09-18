-- ============================================================================
-- SUGUBA — QUARTIER DES BOUTIQUES (2026-09-18)
-- ============================================================================
-- « Boutiques près de chez moi » : chaque boutique peut indiquer son quartier
-- de Bamako (nom de la liste canonique src/lib/bamako-neighborhoods.ts).
--
-- - Fournisseurs : pré-rempli avec le quartier de l'entrepôt déclaré à
--   l'inscription (modifiable dans « Ma boutique »).
-- - Revendeurs : JAMAIS pré-rempli — leur quartier de profil est souvent leur
--   domicile ; ils choisissent eux-mêmes de l'afficher.
--
-- Sans cette migration, la recherche fonctionne déjà avec les entrepôts
-- fournisseurs ; elle ajoute le choix du quartier par chaque boutique.
-- Idempotent : réexécutable sans dommage.
-- ============================================================================

ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS neighborhood TEXT;

COMMENT ON COLUMN public.stores.neighborhood IS
  'Quartier de Bamako affiché publiquement (recherche de boutiques par quartier). NULL = non affiché.';

UPDATE public.stores s
SET neighborhood = sp.warehouse_neighborhood
FROM public.suppliers sp
WHERE s.owner_type = 'supplier'
  AND s.owner_id = sp.profile_id
  AND s.neighborhood IS NULL
  AND NULLIF(trim(sp.warehouse_neighborhood), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stores_neighborhood
  ON public.stores (neighborhood) WHERE status = 'active';
