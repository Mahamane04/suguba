-- ============================================================================
-- Frais de retrait payés par le revendeur (2026-09-24)
-- ============================================================================
-- À exécuter UNE fois dans Supabase › SQL Editor. Sans danger si relancé :
-- n'ajoute que des colonnes, ne modifie ni ne supprime aucune donnée.
--
-- Depuis cette mise à jour, un retrait se décompose ainsi :
--   montant_demande : ce qui est retiré du solde du revendeur ;
--   frais_retrait   : SasPay + opérateur + Suguba (Mobile Money),
--                     ou Suguba seul (espèces au guichet) ;
--   amount          : ce qui part réellement (virement ou espèces),
--                     soit montant_demande − frais_retrait.
-- Tant que ce fichier n'est pas exécuté, les retraits fonctionnent déjà avec
-- les frais déduits ; seul le détail n'est pas conservé.

BEGIN;

ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS montant_demande NUMERIC(12, 2);
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS frais_retrait   NUMERIC(12, 2);
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS detail_frais    JSONB;

COMMENT ON COLUMN public.payouts.montant_demande IS
  'Montant retiré du solde du revendeur. amount = ce qui lui est réellement versé.';
COMMENT ON COLUMN public.payouts.frais_retrait IS
  'Frais payés par le revendeur : SasPay + opérateur + Suguba, ou Suguba seul en espèces.';
COMMENT ON COLUMN public.payouts.detail_frais IS
  'Détail des frais en FCFA : {"saspay": …, "operateur": …, "suguba": …}.';

COMMIT;

NOTIFY pgrst, 'reload schema';
