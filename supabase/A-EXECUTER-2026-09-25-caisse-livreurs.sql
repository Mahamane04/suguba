-- ═══════════════════════════════════════════════════════════════════════════
-- Caisse livreurs (2026-09-25)
--
-- Le livreur encaisse en espèces les commandes « paiement à la livraison ».
-- Jusqu'ici rien n'enregistrait qu'il avait remis cet argent à Suguba.
--
-- Un VERSEMENT = l'argent qu'un livreur apporte à la caisse, pour un lot de
-- commandes livrées. Il garde (ou non, selon le réglage admin) sa
-- rémunération par course. L'écart entre ce qui était dû et ce qui a été
-- reçu reste inscrit sur le versement : un manque se régularise par un
-- versement suivant.
--
-- À exécuter une fois dans le SQL Editor de Supabase. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.driver_remittances (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remittance_number      TEXT NOT NULL UNIQUE,
  driver_id              TEXT NOT NULL,          -- = orders.assigned_driver_id (profil du livreur)
  orders_count           INTEGER NOT NULL DEFAULT 0,
  cash_total             NUMERIC NOT NULL DEFAULT 0,  -- espèces encaissées sur ces commandes
  remuneration_retained  NUMERIC NOT NULL DEFAULT 0,  -- gardé par le livreur (sa rémunération)
  amount_due             NUMERIC NOT NULL DEFAULT 0,  -- cash_total − remuneration_retained
  amount_received        NUMERIC NOT NULL DEFAULT 0,  -- réellement reçu à la caisse
  difference             NUMERIC NOT NULL DEFAULT 0,  -- reçu − dû (négatif = manque)
  received_by            TEXT NOT NULL,          -- profil de l'admin qui a reçu l'argent
  received_by_name       TEXT,
  note                   TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS driver_remittances_driver_idx ON public.driver_remittances (driver_id, created_at DESC);

-- Aucune policy : lecture et écriture par le serveur uniquement (service_role).
ALTER TABLE public.driver_remittances ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cash_remittance_id UUID REFERENCES public.driver_remittances(id);
CREATE INDEX IF NOT EXISTS orders_cash_a_verser_idx ON public.orders (assigned_driver_id)
  WHERE status = 'delivered' AND cash_remittance_id IS NULL;

-- Enregistre un versement de façon atomique : les commandes sont verrouillées,
-- vérifiées une à une (bon livreur, livrée, payée en espèces, pas déjà
-- versée), puis rattachées au versement. Une commande déjà versée par un
-- autre guichet au même instant fait échouer l'ensemble.
--
-- p_order_ids vide = versement de régularisation (rattrape un manque).
CREATE OR REPLACE FUNCTION public.record_driver_remittance(
  p_driver_id TEXT,
  p_order_ids TEXT[],
  p_remuneration_par_course NUMERIC,
  p_amount_received NUMERIC,
  p_received_by TEXT,
  p_received_by_name TEXT,
  p_note TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  ids TEXT[] := ARRAY(SELECT DISTINCT unnest(coalesce(p_order_ids, ARRAY[]::TEXT[])));
  n INTEGER;
  valides INTEGER;
  especes NUMERIC;
  garde NUMERIC;
  du NUMERIC;
  v public.driver_remittances%ROWTYPE;
BEGIN
  IF p_amount_received IS NULL OR p_amount_received < 0 THEN
    RETURN jsonb_build_object('error', 'Montant reçu invalide.', 'http', 400);
  END IF;
  n := coalesce(array_length(ids, 1), 0);
  IF n = 0 AND p_amount_received = 0 THEN
    RETURN jsonb_build_object('error', 'Rien à enregistrer.', 'http', 400);
  END IF;

  PERFORM 1 FROM public.orders WHERE id = ANY(ids) FOR UPDATE;
  SELECT count(*), coalesce(sum(total_amount), 0) INTO valides, especes
    FROM public.orders
   WHERE id = ANY(ids)
     AND assigned_driver_id = p_driver_id
     AND status = 'delivered'
     AND coalesce(payment_method, 'cash_on_delivery') <> 'mobile_money'
     AND cash_remittance_id IS NULL;
  IF valides <> n THEN
    RETURN jsonb_build_object('error', 'Une des commandes est déjà versée ou ne correspond pas à ce livreur. Rechargez la page.', 'http', 409);
  END IF;

  garde := least(especes, greatest(0, coalesce(p_remuneration_par_course, 0)) * n);
  du := especes - garde;

  INSERT INTO public.driver_remittances (
    remittance_number, driver_id, orders_count, cash_total, remuneration_retained,
    amount_due, amount_received, difference, received_by, received_by_name, note
  ) VALUES (
    'VS-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)), p_driver_id, n, especes, garde,
    du, p_amount_received, p_amount_received - du, p_received_by, p_received_by_name, nullif(trim(coalesce(p_note, '')), '')
  ) RETURNING * INTO v;

  UPDATE public.orders SET cash_remittance_id = v.id WHERE id = ANY(ids);

  RETURN jsonb_build_object('success', true, 'id', v.id, 'remittanceNumber', v.remittance_number);
END; $$;

REVOKE ALL ON FUNCTION public.record_driver_remittance(TEXT, TEXT[], NUMERIC, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_driver_remittance(TEXT, TEXT[], NUMERIC, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
