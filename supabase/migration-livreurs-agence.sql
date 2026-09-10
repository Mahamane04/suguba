-- ============================================================================
-- SUGUBA — VÉRIFICATION DES LIVREURS AU GUICHET
-- ============================================================================
--
-- Le modèle change sur un point de fond : jusqu'ici, `profile_roles.status`
-- servait à LA FOIS à autoriser la connexion et à autoriser le dispatch. Un
-- livreur non approuvé était renvoyé sur /pending-approval, sans rien pouvoir
-- consulter — et un livreur approuvé devenait immédiatement éligible aux
-- courses, sur la foi d'un formulaire qu'il avait rempli lui-même.
--
-- Or l'admin ne voyait que des données déclaratives : nom, téléphone, numéro
-- de pièce d'identité saisi au clavier. Rien de vérifiable. L'approbation
-- n'apportait donc aucune sécurité, seulement du délai.
--
-- Désormais les deux notions sont séparées :
--   profile_roles.status  → le compte existe et fonctionne (actif d'emblée)
--   drivers.active_status → ce livreur peut recevoir des courses
--
-- `active_status` existait déjà dans migration-drivers.sql, avec un
-- DEFAULT false parfaitement adapté, mais n'était lu ni écrit nulle part.
-- Il devient le seul verrou du dispatch, et il ne se lève qu'après une
-- vérification PHYSIQUE au guichet Suguba de Bamako : la personne, sa moto,
-- ses papiers, vus de ses propres yeux par un agent.
--
-- Pourquoi le guichet plutôt que le téléversement de documents : Suguba a
-- déjà un point physique à Bamako (il figure comme option de retrait des
-- commissions). Voir la personne et sa moto vaut mieux qu'un scan qu'on ne
-- peut recouper avec aucun registre, coûte zéro développement, et évite de
-- stocker des pièces d'identité — des données sensibles dont la conservation
-- est une responsabilité, pas un actif.
--
-- Idempotent : réexécutable sans dommage.
-- ============================================================================

-- Traçabilité de la vérification : qui a vu qui, quand, et ce qu'il a constaté.
-- Sans ces colonnes, `active_status` serait un booléen sans mémoire — personne
-- ne pourrait dire qui a laissé entrer un livreur, ni sur quelle base.
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS verified_at   TIMESTAMPTZ;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS verified_by   TEXT;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS verified_note TEXT;

COMMENT ON COLUMN public.drivers.active_status IS
  'Ce livreur peut-il recevoir des courses ? Ne se lève qu''après vérification physique au guichet. Distinct de profile_roles.status, qui dit seulement si le compte fonctionne.';
COMMENT ON COLUMN public.drivers.verified_at IS
  'Date de la vérification au guichet.';
COMMENT ON COLUMN public.drivers.verified_by IS
  'Identifiant du profil admin ayant vu la personne et sa moto.';
COMMENT ON COLUMN public.drivers.verified_note IS
  'Ce que l''agent a constaté : pièce présentée, état de la moto, réserves.';

-- Les comptes déjà approuvés avant ce changement n'ont jamais été vus au
-- guichet : ils ne deviennent pas éligibles au dispatch par surprise.
-- `active_status` reste à false pour tout le monde, y compris eux.
