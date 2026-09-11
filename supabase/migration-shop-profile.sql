-- ============================================================================
-- SUGUBA — PROFIL DE BOUTIQUE FOURNISSEUR
-- ============================================================================
--
-- Demande du 2026-09-11 : « Ma boutique et mes revendeurs » n'offrait aucune
-- personnalisation — ni nom de boutique distinct de la raison sociale, ni
-- logo, ni description, ni e-mail de contact. Un fournisseur ne pouvait rien
-- ajuster de ce que ses clients ou ses revendeurs voient.
--
-- `shop_display_name` reste SÉPARÉ de `company_name` : `company_name` sert
-- de base au `slug` (/s/<slug>, attribué une fois, jamais recalculé — voir
-- migration-boutiques.sql) et à la raison sociale légale ; le nom de boutique
-- affiché doit pouvoir changer librement (campagne, image de marque) sans
-- jamais casser un lien déjà partagé.
--
-- Idempotent : réexécutable sans dommage.
-- ============================================================================

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS shop_display_name TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS shop_description TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_email TEXT;

COMMENT ON COLUMN public.suppliers.shop_display_name IS
  'Nom de boutique affiché publiquement (/s/<slug> et fiches produit). Distinct de company_name : modifiable librement, ne touche jamais au slug déjà partagé.';
COMMENT ON COLUMN public.suppliers.logo_url IS
  'Logo de la boutique (Cloudinary, via /api/products/upload-image). NULL = avatar par défaut (initiale du nom).';
COMMENT ON COLUMN public.suppliers.shop_description IS
  'Courte présentation affichée en haut de la boutique publique.';
COMMENT ON COLUMN public.suppliers.contact_email IS
  'E-mail de contact du fournisseur, saisi depuis "Réglages de ma boutique". Usage interne (support, notifications) — jamais publié sur la boutique.';

-- Vérification à exécuter après la migration :
--   SELECT profile_id, company_name, shop_display_name, logo_url FROM public.suppliers LIMIT 5;
