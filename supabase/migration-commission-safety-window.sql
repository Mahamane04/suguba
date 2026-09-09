-- ============================================================================
-- SUGUBA — DÉLAI DE SÉCURITÉ SUR LES COMMISSIONS
-- ============================================================================
--
-- Le modèle métier prévoit qu'une commission reste bloquée après la livraison
-- (14 jours pour un nouveau revendeur, 7 pour un vérifié, 3 pour un VIP) avant
-- de devenir retirable — le temps qu'un éventuel retour client se manifeste.
--
-- Ce délai n'existait QUE côté navigateur : le statut `locked` n'était même
-- pas accepté par la contrainte de cette table, et à la livraison le serveur
-- passait la commission directement en `available`. Un revendeur pouvait donc
-- retirer son argent immédiatement, et un retour survenu ensuite arrivait trop
-- tard — la commission était déjà versée.
--
-- Idempotent : réexécutable sans dommage.
-- ============================================================================

-- 1. Le statut `locked` devient valide, et la date de libération est stockée.
ALTER TABLE public.commissions DROP CONSTRAINT IF EXISTS commissions_status_check;
ALTER TABLE public.commissions ADD CONSTRAINT commissions_status_check CHECK (
  status IN ('pending', 'locked', 'available', 'reserved', 'paid', 'reversed')
);

ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS unlock_at TIMESTAMPTZ;

COMMENT ON COLUMN public.commissions.unlock_at IS
  'Date à partir de laquelle une commission `locked` devient retirable. Appliquée par liberer_commissions_echues().';

CREATE INDEX IF NOT EXISTS idx_commissions_locked
  ON public.commissions(unlock_at) WHERE status = 'locked';

-- 2. Libération des commissions arrivées à échéance.
--
-- Appelée à la lecture d'un solde et avant toute demande de retrait, plutôt
-- que par une tâche planifiée : pas de cron à maintenir, et surtout aucune
-- fenêtre pendant laquelle un solde affiché serait en retard sur la réalité.
CREATE OR REPLACE FUNCTION public.liberer_commissions_echues()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_liberees INTEGER;
BEGIN
  UPDATE public.commissions
     SET status = 'available',
         available_at = NOW()
   WHERE status = 'locked'
     AND unlock_at IS NOT NULL
     AND unlock_at <= NOW();

  GET DIAGNOSTICS v_liberees = ROW_COUNT;
  RETURN v_liberees;
END;
$$;

-- 3. Vérification après migration :
--   SELECT status, COUNT(*) FROM public.commissions GROUP BY status;
--   SELECT public.liberer_commissions_echues();
