-- ═══════════════════════════════════════════════════════════════════════════
-- Campagnes encadrées (2026-09-26, lot 2b)
--
-- Une campagne fournisseur (mission financée par lui) :
--   • choisit son CANAL avant de payer (statut WhatsApp, groupes, Facebook…) :
--     les preuves de publication doivent venir de ce canal ;
--   • ne peut être ACTIVÉE qu'une fois son budget reçu en entier
--     (récompense × nombre de revendeurs) — garde-fou en base, même si
--     l'application était contournée ;
--   • garde la trace du paiement (montant, date, référence, qui l'a noté).
--
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS canal TEXT NOT NULL DEFAULT 'tous';
ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_canal_check;
ALTER TABLE public.missions ADD CONSTRAINT missions_canal_check
  CHECK (canal IN ('tous', 'whatsapp_statut', 'whatsapp_groupe', 'facebook', 'instagram', 'tiktok'));

ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS budget_recu NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_budget_recu_check;
ALTER TABLE public.missions ADD CONSTRAINT missions_budget_recu_check CHECK (budget_recu >= 0 AND budget_recu <= 100000000);
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS budget_recu_le TIMESTAMPTZ;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS budget_reference TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS budget_recu_par TEXT;

-- Garde-fou : une campagne fournisseur ne s'active qu'avec son budget réglé.
CREATE OR REPLACE FUNCTION public.refuser_campagne_non_reglee()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' AND NEW.supplier_id IS NOT NULL
     AND COALESCE(NEW.budget_recu, 0) < COALESCE(NEW.reward_amount, 0) * COALESCE(NEW.max_participants, 0) THEN
    RAISE EXCEPTION 'BUDGET_NON_REGLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS missions_budget_avant_activation ON public.missions;
CREATE TRIGGER missions_budget_avant_activation
  BEFORE UPDATE OF status ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.refuser_campagne_non_reglee();

NOTIFY pgrst, 'reload schema';
