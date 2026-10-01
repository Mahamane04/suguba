-- ═══════════════════════════════════════════════════════════════════════════
-- Intégrité de l'argent (audit intégral du 2026-10-01)
-- REQ-FIN-INT-001 / TASK-FIN-INT-001..004 / TEST-FIN-INT-001..004
--
-- 1. Livraison forcée (FIN-02) : une commande passée « livrée » par l'admin
--    (/api/orders/sync) gardait delivered_at = NULL, que fonds_recus() comptait
--    comme « argent reçu » → commission et gain fournisseur libérés alors qu'un
--    livreur détenait encore les espèces. Désormais : delivered_at est toujours
--    posé à la livraison, la branche « delivered_at IS NULL » ne vaut plus
--    « reçu », et le livreur d'une commande livrée ne peut plus être changé
--    (le retirer faisait aussi passer l'argent pour reçu).
-- 2. Versement incomplet (FIN-03) : un versement de 0 F rattachait quand même
--    toutes ses commandes → gains libérés sur de l'argent jamais reçu. Les
--    commandes ne sont plus « couvertes » que dans la limite du montant reçu,
--    les plus anciennes d'abord ; un versement suivant (régularisation)
--    couvre les restantes.
-- 3. Paiement Mobile Money tardif ou incomplet (FIN-04) : confirmé sur une
--    commande annulée/retournée, ou déjà payée en espèces, ou d'un montant
--    inférieur à la demande, il ne marque plus la commande payée : la
--    tentative est gardée avec une ANOMALIE (remboursement ou contrôle).
-- 4. Double « Argent remis » (FIN-19) : deux clics simultanés réussissaient
--    tous les deux ; le second est désormais refusé (déjà traité).
--
-- Prérequis : trésorerie, caisse livreurs, offres-remise, audit sécurité,
-- retraits fournisseurs. Additif, sans perte de donnée, sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Livraison : date toujours posée, livreur figé ensuite ────────────────
CREATE OR REPLACE FUNCTION public.livraison_coherente()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'delivered' AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at := now();
  END IF;
  IF OLD.status IN ('delivered', 'returned') AND NEW.assigned_driver_id IS DISTINCT FROM OLD.assigned_driver_id THEN
    RAISE EXCEPTION 'LIVREUR_FIGE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.livraison_coherente() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS livraison_coherente ON public.orders;
CREATE TRIGGER livraison_coherente BEFORE UPDATE OF status, assigned_driver_id, delivered_at ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.livraison_coherente();

-- ── 2. Fonds couverts par un versement, commande par commande ───────────────
-- NULL = commande versée avant cette règle (le versement valait couverture).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fonds_couverts BOOLEAN;

CREATE OR REPLACE FUNCTION public.fonds_recus(p_order_id TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  -- Chaque terme est forcé à vrai/faux : une date de livraison absente ne doit
  -- jamais rendre l'ensemble NULL, que COALESCE transformerait en « reçu ».
  SELECT COALESCE((
    SELECT COALESCE(o.payment_method = 'mobile_money', false)
        OR (o.cash_remittance_id IS NOT NULL AND COALESCE(o.fonds_couverts, true))
        OR o.assigned_driver_id IS NULL
        OR COALESCE(o.delivered_at < (SELECT fonds_requis_depuis FROM public.tresorerie_reglages WHERE id = 1), false)
      FROM public.orders o WHERE o.id = p_order_id
  ), true);
$$;
REVOKE ALL ON FUNCTION public.fonds_recus(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fonds_recus(TEXT) TO service_role;

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
  par_livreur INTEGER;
  especes NUMERIC;
  garde NUMERIC;
  du NUMERIC;
  credit NUMERIC := coalesce(p_amount_received, 0);
  remuneration NUMERIC := greatest(0, coalesce(p_remuneration_par_course, 0));
  c RECORD;
  du_commande NUMERIC;
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
  SELECT count(*), coalesce(sum(total_amount), 0),
         count(*) FILTER (WHERE coalesce(pricing_snapshot->'remise'->>'mode', 'livreur') = 'livreur')
    INTO valides, especes, par_livreur
    FROM public.orders
   WHERE id = ANY(ids)
     AND assigned_driver_id = p_driver_id
     AND status = 'delivered'
     AND coalesce(payment_method, 'cash_on_delivery') <> 'mobile_money'
     AND cash_remittance_id IS NULL;
  IF valides <> n THEN
    RETURN jsonb_build_object('error', 'Une des commandes est déjà versée ou ne correspond pas à ce livreur. Rechargez la page.', 'http', 409);
  END IF;

  garde := least(especes, remuneration * par_livreur);
  du := especes - garde;

  INSERT INTO public.driver_remittances (
    remittance_number, driver_id, orders_count, cash_total, remuneration_retained,
    amount_due, amount_received, difference, received_by, received_by_name, note
  ) VALUES (
    'VS-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)), p_driver_id, n, especes, garde,
    du, p_amount_received, p_amount_received - du, p_received_by, p_received_by_name, nullif(trim(coalesce(p_note, '')), '')
  ) RETURNING * INTO v;

  -- L'argent reçu couvre d'abord les commandes restées non couvertes par un
  -- versement précédent (régularisation), puis celles de ce versement, les
  -- plus anciennes d'abord. Une commande n'est couverte qu'en entier.
  FOR c IN
    SELECT o.id, o.total_amount, coalesce(o.pricing_snapshot->'remise'->>'mode', 'livreur') AS mode, 0 AS rang, o.delivered_at
      FROM public.orders o
     WHERE o.assigned_driver_id = p_driver_id AND o.fonds_couverts = false AND o.cash_remittance_id IS NOT NULL
    UNION ALL
    SELECT o.id, o.total_amount, coalesce(o.pricing_snapshot->'remise'->>'mode', 'livreur'), 1, o.delivered_at
      FROM public.orders o WHERE o.id = ANY(ids)
    ORDER BY 4, 5, 1
  LOOP
    du_commande := greatest(0, c.total_amount - CASE WHEN c.mode = 'livreur' THEN least(c.total_amount, remuneration) ELSE 0 END);
    IF credit >= du_commande THEN
      credit := credit - du_commande;
      UPDATE public.orders SET fonds_couverts = true, cash_remittance_id = coalesce(cash_remittance_id, v.id) WHERE id = c.id;
    ELSE
      -- Rattachée au versement (la dette reste visible), mais pas couverte.
      UPDATE public.orders SET fonds_couverts = false, cash_remittance_id = coalesce(cash_remittance_id, v.id) WHERE id = c.id;
      credit := 0;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'id', v.id, 'remittanceNumber', v.remittance_number);
END; $$;
REVOKE ALL ON FUNCTION public.record_driver_remittance(TEXT, TEXT[], NUMERIC, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_driver_remittance(TEXT, TEXT[], NUMERIC, NUMERIC, TEXT, TEXT, TEXT) TO service_role;

-- ── 3. Paiement Mobile Money : état et montant vérifiés ────────────────────
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS anomalie TEXT;

DROP FUNCTION IF EXISTS public.apply_verified_payment(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.apply_verified_payment(p_order_number TEXT, p_transaction TEXT, p_status TEXT, p_montant NUMERIC DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  o public.orders%ROWTYPE;
  a public.payment_attempts%ROWTYPE;
  trouvee BOOLEAN;
  probleme TEXT;
BEGIN
  IF p_status NOT IN ('SUCCESS', 'FAILED', 'CANCELLED') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  SELECT * INTO o FROM public.orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  SELECT * INTO a FROM public.payment_attempts WHERE order_number = p_order_number AND transaction_id = p_transaction FOR UPDATE;
  trouvee := FOUND;
  IF o.payment_transaction_id IS DISTINCT FROM p_transaction AND NOT trouvee THEN RAISE EXCEPTION 'PAYMENT_CONFLICT'; END IF;
  -- Déjà traité : rejeu sans effet.
  IF trouvee AND a.status = 'SUCCESS' THEN RETURN; END IF;

  IF p_status <> 'SUCCESS' THEN
    UPDATE public.payment_attempts SET status = p_status WHERE transaction_id = p_transaction AND status <> 'SUCCESS';
    RETURN;
  END IF;

  IF o.status IN ('cancelled', 'returned') THEN
    probleme := 'remboursement_du : paiement reçu sur une commande ' || CASE WHEN o.status = 'cancelled' THEN 'annulée' ELSE 'retournée' END;
  -- Livrée et payée en main propre (le drapeau « encaissé » peut manquer sur une livraison forcée).
  ELSIF (o.payment_collected OR o.status = 'delivered') AND coalesce(o.payment_method, '') <> 'mobile_money' THEN
    probleme := 'remboursement_du : commande déjà payée en espèces';
  ELSIF trouvee AND p_montant IS NOT NULL AND a.amount_requested IS NOT NULL AND p_montant < a.amount_requested THEN
    probleme := 'montant_insuffisant : ' || p_montant || ' reçus pour ' || a.amount_requested || ' demandés';
  END IF;

  UPDATE public.payment_attempts SET status = 'SUCCESS', anomalie = probleme WHERE transaction_id = p_transaction;
  IF probleme IS NULL THEN
    UPDATE public.orders SET payment_collected = true, payment_method = 'mobile_money',
      status = CASE WHEN status = 'pending_call' THEN 'confirmed' ELSE status END WHERE id = o.id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.apply_verified_payment(TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_payment(TEXT, TEXT, TEXT, NUMERIC) TO service_role;

-- ── 4. Retrait : un « payé » simultané n'est accepté qu'une fois ───────────
CREATE OR REPLACE FUNCTION public.finalize_payout_atomic(p_id TEXT, p_status TEXT, p_reference TEXT DEFAULT NULL, p_expected_status TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE p public.payouts%ROWTYPE; reserve NUMERIC;
BEGIN
  SELECT * INTO p FROM public.payouts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WITHDRAWAL_NOT_FOUND'; END IF;
  IF p_status NOT IN ('completed', 'rejected') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  -- L'état attendu est vérifié AVANT le retour « déjà fait » : un second
  -- « Argent remis » simultané échoue au lieu de réussir une deuxième fois.
  IF p_expected_status IS NOT NULL AND p.status <> p_expected_status THEN RAISE EXCEPTION 'STATUS_CONFLICT'; END IF;
  IF p.status = p_status THEN RETURN to_jsonb(p); END IF;
  IF p.status NOT IN ('pending', 'processing') THEN RAISE EXCEPTION 'STATUS_CONFLICT'; END IF;
  IF p.beneficiaire = 'fournisseur' THEN
    SELECT coalesce(sum(amount), 0) INTO reserve FROM public.gains_fournisseurs
      WHERE supplier_id = p.reseller_id AND reserved_for_withdrawal = p.id AND status = 'reserved';
  ELSE
    SELECT coalesce(sum(amount), 0) INTO reserve FROM public.commissions
      WHERE reseller_id = p.reseller_id AND reserved_for_withdrawal = p.id AND status = 'reserved';
  END IF;
  IF reserve <> coalesce(p.montant_demande, p.amount) THEN RAISE EXCEPTION 'LEDGER_RECONCILIATION_REQUIRED'; END IF;
  IF p.beneficiaire = 'fournisseur' THEN
    UPDATE public.gains_fournisseurs
       SET status = CASE WHEN p_status = 'completed' THEN 'paid' ELSE 'available' END,
           reserved_for_withdrawal = CASE WHEN p_status = 'completed' THEN reserved_for_withdrawal END
     WHERE supplier_id = p.reseller_id AND reserved_for_withdrawal = p.id AND status = 'reserved';
  ELSIF p_status = 'completed' THEN PERFORM public.settle_commissions_for_withdrawal(p.id);
  ELSE PERFORM public.release_commissions_for_withdrawal(p.id);
  END IF;
  UPDATE public.payouts SET status = p_status, processed_at = now(), transaction_ref = coalesce(p_reference, transaction_ref)
   WHERE id = p.id RETURNING * INTO p;
  RETURN to_jsonb(p);
END $$;
REVOKE ALL ON FUNCTION public.finalize_payout_atomic(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_payout_atomic(TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Retour arrière : réappliquer les définitions précédentes depuis
-- A-EXECUTER-2026-09-26-tresorerie.sql (fonds_recus), -2026-09-26-offres-remise.sql
-- (record_driver_remittance), -2026-09-25-audit-securite.sql (apply_verified_payment
-- à 3 paramètres) et -2026-09-27-retraits-fournisseurs.sql (finalize_payout_atomic),
-- puis DROP TRIGGER livraison_coherente ON public.orders. Les colonnes ajoutées
-- (orders.fonds_couverts, payment_attempts.anomalie) peuvent rester.
