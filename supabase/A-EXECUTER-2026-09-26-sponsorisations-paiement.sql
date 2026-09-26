-- ═══════════════════════════════════════════════════════════════════════════
-- Sponsorisations : suivi du paiement (2026-09-26)
--
-- Les packs se payaient hors de l'application sans aucune trace, et un pack
-- pouvait être activé sans être réglé. Désormais :
--   • l'admin enregistre le montant reçu, sa référence, qui l'a noté et quand ;
--   • une sponsorisation ne s'ACTIVE qu'avec son prix réglé en entier
--     (garde-fou en base, même si l'application était contournée) ;
--   • la durée du pack démarre à la première activation (avant : à la
--     demande, donc un pack payé tard perdait des jours).
--
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.sponsorships ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.sponsorships DROP CONSTRAINT IF EXISTS sponsorships_paid_amount_check;
ALTER TABLE public.sponsorships ADD CONSTRAINT sponsorships_paid_amount_check CHECK (paid_amount >= 0 AND paid_amount <= 100000000);
ALTER TABLE public.sponsorships ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.sponsorships ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.sponsorships ADD COLUMN IF NOT EXISTS paid_by TEXT;
ALTER TABLE public.sponsorships ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- Sponsorisations déjà actives : considérées comme activées (pas de retour en arrière).
UPDATE public.sponsorships SET activated_at = starts_at WHERE status = 'active' AND activated_at IS NULL;

CREATE OR REPLACE FUNCTION public.refuser_sponsorisation_non_reglee()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active'
     AND COALESCE(NEW.paid_amount, 0) < COALESCE(NEW.budget, 0) THEN
    RAISE EXCEPTION 'SPONSORISATION_NON_REGLEE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sponsorships_paiement_avant_activation ON public.sponsorships;
CREATE TRIGGER sponsorships_paiement_avant_activation
  BEFORE UPDATE OF status ON public.sponsorships
  FOR EACH ROW EXECUTE FUNCTION public.refuser_sponsorisation_non_reglee();

NOTIFY pgrst, 'reload schema';
