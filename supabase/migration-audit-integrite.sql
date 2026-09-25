-- REQ-009/010/011/012/013 — TASK-AUD-M1/S2/M3.
-- Préparée et testée localement seulement. Appliquer AVANT le code associé.
-- Pré-requis : schema, multi-role, reseau-v1, saspay, frais-retrait,
-- commission-safety-window, ramassage, order-creation et panier.
-- Aucun retrait historique n'est réécrit ; les réservations incohérentes
-- échouent explicitement et exigent un rapprochement avant tout versement.
BEGIN;
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS request_key TEXT;
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS montant_demande NUMERIC;
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS frais_retrait NUMERIC;
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS detail_frais JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS payouts_owner_request ON public.payouts(reseller_id, request_key) WHERE request_key IS NOT NULL;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS split_from TEXT REFERENCES public.commissions(id);

CREATE OR REPLACE FUNCTION public.reserve_commissions_for_withdrawal(p_reseller_id TEXT, p_amount NUMERIC, p_withdrawal_id TEXT)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.commissions%ROWTYPE; total NUMERIC:=0; prise NUMERIC; restant NUMERIC;
BEGIN
  IF p_amount <= 0 OR p_amount <> trunc(p_amount) THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  -- L'identité du retrait est créée côté serveur, avant la réserve, dans la même transaction.
  PERFORM 1 FROM public.payouts WHERE id=p_withdrawal_id AND reseller_id=p_reseller_id AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WITHDRAWAL_OWNER_MISMATCH'; END IF;
  SELECT coalesce(sum(amount),0) INTO total FROM public.commissions
    WHERE reserved_for_withdrawal=p_withdrawal_id AND reseller_id=p_reseller_id AND status='reserved';
  IF total>0 THEN
    IF total<>p_amount THEN RAISE EXCEPTION 'LEDGER_RECONCILIATION_REQUIRED'; END IF;
    RETURN total;
  END IF;
  FOR c IN SELECT * FROM public.commissions WHERE reseller_id=p_reseller_id AND status='available' ORDER BY created_at,id FOR UPDATE LOOP
    EXIT WHEN total >= p_amount;
    prise:=least(c.amount,p_amount-total); restant:=c.amount-prise;
    UPDATE public.commissions SET amount=prise,status='reserved',reserved_for_withdrawal=p_withdrawal_id WHERE id=c.id;
    IF restant>0 THEN
      INSERT INTO public.commissions(order_id,order_number,reseller_id,amount,status,created_at,available_at,unlock_at,split_from)
      VALUES(c.order_id,c.order_number,c.reseller_id,restant,'available',c.created_at,c.available_at,c.unlock_at,coalesce(c.split_from,c.id));
    END IF;
    total:=total+prise;
  END LOOP;
  -- Exception = rollback de toutes les écritures, jamais libération par référence globale.
  IF total<p_amount THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  RETURN total;
END; $$;

CREATE OR REPLACE FUNCTION public.create_payout_atomic(p_owner TEXT,p_key TEXT,p_fingerprint TEXT,p_row JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE ancien public.payouts%ROWTYPE; nouveau public.payouts%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payout:'||p_owner,0));
  SELECT * INTO ancien FROM public.payouts WHERE reseller_id=p_owner AND request_key=p_key;
  IF FOUND THEN
    IF ancien.request_fingerprint<>p_fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    RETURN to_jsonb(ancien);
  END IF;
  INSERT INTO public.payouts(id,reseller_id,reseller_name,amount,payment_method,phone_number,status,montant_demande,frais_retrait,detail_frais,request_key,request_fingerprint)
  VALUES(p_row->>'id',p_owner,p_row->>'reseller_name',(p_row->>'amount')::numeric,p_row->>'payment_method',p_row->>'phone_number','pending',
    (p_row->>'montant_demande')::numeric,(p_row->>'frais_retrait')::numeric,p_row->'detail_frais',p_key,p_fingerprint) RETURNING * INTO nouveau;
  IF nouveau.amount<=0 OR nouveau.montant_demande<>nouveau.amount+nouveau.frais_retrait THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  PERFORM public.reserve_commissions_for_withdrawal(p_owner,nouveau.montant_demande,nouveau.id);
  RETURN to_jsonb(nouveau);
END; $$;

CREATE OR REPLACE FUNCTION public.release_commissions_for_withdrawal(p_withdrawal_id TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.commissions c SET status='available',reserved_for_withdrawal=NULL
 FROM public.payouts p WHERE p.id=p_withdrawal_id AND c.reserved_for_withdrawal=p.id AND c.reseller_id=p.reseller_id AND c.status='reserved';
$$;
CREATE OR REPLACE FUNCTION public.settle_commissions_for_withdrawal(p_withdrawal_id TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.commissions c SET status='paid'
 FROM public.payouts p WHERE p.id=p_withdrawal_id AND c.reserved_for_withdrawal=p.id AND c.reseller_id=p.reseller_id AND c.status='reserved';
$$;
CREATE OR REPLACE FUNCTION public.finalize_payout_atomic(p_id TEXT,p_status TEXT,p_reference TEXT DEFAULT NULL,p_expected_status TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.payouts%ROWTYPE; reserve NUMERIC;
BEGIN
  SELECT * INTO p FROM public.payouts WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WITHDRAWAL_NOT_FOUND'; END IF;
  IF p_status NOT IN ('completed','rejected') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  IF p.status=p_status THEN RETURN to_jsonb(p); END IF;
  IF p_expected_status IS NOT NULL AND p.status<>p_expected_status THEN RAISE EXCEPTION 'STATUS_CONFLICT'; END IF;
  IF p.status NOT IN ('pending','processing') THEN RAISE EXCEPTION 'STATUS_CONFLICT'; END IF;
  SELECT coalesce(sum(amount),0) INTO reserve FROM public.commissions
    WHERE reseller_id=p.reseller_id AND reserved_for_withdrawal=p.id AND status='reserved';
  IF reserve<>coalesce(p.montant_demande,p.amount) THEN RAISE EXCEPTION 'LEDGER_RECONCILIATION_REQUIRED'; END IF;
  IF p_status='completed' THEN PERFORM public.settle_commissions_for_withdrawal(p.id);
  ELSE PERFORM public.release_commissions_for_withdrawal(p.id); END IF;
  UPDATE public.payouts SET status=p_status,processed_at=now(),transaction_ref=coalesce(p_reference,transaction_ref) WHERE id=p.id RETURNING * INTO p;
  RETURN to_jsonb(p);
END; $$;

-- Réserve des unités uniquement pour les NOUVELLES commandes. L'historique
-- n'est pas décrémenté rétroactivement. Une variante est déjà un produit distinct.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_released BOOLEAN NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.audit_order_effects() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ventes INTEGER; jours INTEGER;
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.quantity<1 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
   UPDATE public.products SET stock=stock-NEW.quantity WHERE id=NEW.product_id AND status='approved' AND stock>=NEW.quantity;
   IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_UNAVAILABLE'; END IF;
   NEW.stock_reserved:=true;
 ELSE
   IF NEW.status IS DISTINCT FROM OLD.status THEN
     IF OLD.status IN ('cancelled','returned') OR (OLD.status='delivered' AND NEW.status<>'returned') THEN RAISE EXCEPTION 'STATUS_CONFLICT'; END IF;
     IF NEW.status IN ('cancelled','returned') THEN
       IF EXISTS(SELECT 1 FROM public.commissions WHERE order_id=NEW.id AND status IN ('reserved','paid')) THEN
         RAISE EXCEPTION 'LEDGER_RECONCILIATION_REQUIRED';
       END IF;
       UPDATE public.commissions SET status='reversed' WHERE order_id=NEW.id AND status IN ('pending','locked','available');
       IF OLD.stock_reserved AND NOT OLD.stock_released THEN
         UPDATE public.products SET stock=stock+OLD.quantity WHERE id=OLD.product_id;
         NEW.stock_released:=true;
       END IF;
     ELSIF NEW.status='delivered' THEN
       SELECT count(*)+1 INTO ventes FROM public.orders WHERE reseller_id=NEW.reseller_id AND status='delivered' AND id<>NEW.id;
       jours:=CASE WHEN ventes>=30 THEN 3 WHEN ventes>=10 THEN 7 ELSE 14 END;
       UPDATE public.commissions SET status='locked',unlock_at=now()+pg_catalog.make_interval(days=>jours) WHERE order_id=NEW.id AND status='pending';
     END IF;
   END IF;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS audit_order_effects ON public.orders;
CREATE TRIGGER audit_order_effects BEFORE INSERT OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.audit_order_effects();

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_code_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_code_sent_at TIMESTAMPTZ;
CREATE OR REPLACE FUNCTION public.verify_delivery_atomic(p_order_id TEXT,p_driver_id TEXT,p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.orders%ROWTYPE;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','Commande introuvable.','http',404); END IF;
 IF o.assigned_driver_id IS DISTINCT FROM p_driver_id THEN RETURN jsonb_build_object('error','Cette commande ne vous est pas assignée.','http',403); END IF;
 IF o.status='delivered' AND o.delivery_otp=trim(p_code) THEN RETURN jsonb_build_object('success',true,'orderNumber',o.order_number); END IF;
 IF o.status<>'in_transit' OR o.picked_up_at IS NULL THEN RETURN jsonb_build_object('error','Confirmez le ramassage avant la livraison.','http',409); END IF;
 IF o.delivery_code_version<1 OR o.delivery_code_sent_at IS NULL THEN RETURN jsonb_build_object('error','Le code doit être transmis au destinataire par Suguba avant la remise.','http',409); END IF;
 IF coalesce(o.failed_otp_attempts,0)>=3 THEN RETURN jsonb_build_object('error','Commande bloquée après trois essais. Contactez Suguba.','http',423); END IF;
 IF o.delivery_otp IS DISTINCT FROM trim(p_code) THEN
   UPDATE public.orders SET failed_otp_attempts=coalesce(failed_otp_attempts,0)+1 WHERE id=o.id;
   RETURN jsonb_build_object('error','Code incorrect.','http',400);
 END IF;
 UPDATE public.orders SET status='delivered',payment_collected=true,failed_otp_attempts=0,delivered_at=now() WHERE id=o.id;
 RETURN jsonb_build_object('success',true,'orderNumber',o.order_number);
END; $$;

REVOKE ALL ON FUNCTION public.create_payout_atomic(TEXT,TEXT,TEXT,JSONB),public.finalize_payout_atomic(TEXT,TEXT,TEXT,TEXT),public.verify_delivery_atomic(TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_payout_atomic(TEXT,TEXT,TEXT,JSONB),public.finalize_payout_atomic(TEXT,TEXT,TEXT,TEXT),public.verify_delivery_atomic(TEXT,TEXT,TEXT) TO service_role;
-- Fonctions historiques restent inaccessibles aux clients directs.
REVOKE ALL ON FUNCTION public.reserve_commissions_for_withdrawal(TEXT,NUMERIC,TEXT),public.release_commissions_for_withdrawal(TEXT),public.settle_commissions_for_withdrawal(TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_commissions_for_withdrawal(TEXT,NUMERIC,TEXT),public.release_commissions_for_withdrawal(TEXT),public.settle_commissions_for_withdrawal(TEXT) TO service_role;
CREATE OR REPLACE FUNCTION public.create_order_with_commission(
  p_key_hash TEXT, p_fingerprint TEXT, p_order JSONB, p_product JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  previous public.order_creation_requests%ROWTYPE;
  product public.products%ROWTYPE;
  inserted public.orders%ROWTYPE;
BEGIN
  -- Deux appels concurrents avec la même clé attendent la même transaction.
  -- Une collision du hash ne fait que sérialiser deux demandes indépendantes.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key_hash, 0));
  SELECT * INTO previous FROM public.order_creation_requests WHERE key_hash = p_key_hash;
  IF FOUND THEN
    IF previous.request_fingerprint <> p_fingerprint THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('created', false, 'order', previous.receipt);
  END IF;

  -- Vérifie sous verrou que le prix calculé par le serveur concerne toujours
  -- le produit en vente. Empêche un retrait/retarif concurrent de passer inaperçu.
  SELECT * INTO product FROM public.products WHERE id = p_order->>'product_id' FOR UPDATE;
  IF NOT FOUND OR product.status <> 'approved' OR product.public_price <= 0
     OR jsonb_build_object('supplier_price', product.supplier_price,
                          'public_price', product.public_price,
                          'commission_proposee', product.commission_proposee) IS DISTINCT FROM p_product THEN
    RAISE EXCEPTION 'PRODUCT_CHANGED' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.orders (
    id, order_number, product_id, product_name, product_image,
    reseller_id, reseller_name, reseller_code, reseller_commission,
    quantity, unit_price, total_product_amount, delivery_fee, total_amount,
    platform_margin, pricing_snapshot, customer_name, customer_phone,
    city, neighborhood, landmark, delivery_notes, status, delivery_otp,
    payment_method, payment_collected, created_at
  ) SELECT
    r.id, r.order_number, r.product_id, r.product_name, r.product_image,
    r.reseller_id, r.reseller_name, r.reseller_code, r.reseller_commission,
    r.quantity, r.unit_price, r.total_product_amount, r.delivery_fee, r.total_amount,
    r.platform_margin, r.pricing_snapshot, r.customer_name, r.customer_phone,
    r.city, r.neighborhood, r.landmark, r.delivery_notes, 'pending_call', r.delivery_otp,
    'cash_on_delivery', false, now()
  FROM jsonb_populate_record(NULL::public.orders, p_order) r
  RETURNING * INTO inserted;

  IF inserted.reseller_id IS NOT NULL AND inserted.reseller_commission > 0 THEN
    INSERT INTO public.commissions (order_id, order_number, reseller_id, amount, status)
    VALUES (inserted.id, inserted.order_number, inserted.reseller_id, inserted.reseller_commission, 'pending');
  END IF;

  -- Si une insertion échoue, PostgreSQL annule TOUT, y compris la commande.
  INSERT INTO public.order_creation_requests (key_hash, request_fingerprint, order_id, receipt)
  VALUES (p_key_hash, p_fingerprint, inserted.id, to_jsonb(inserted));
  RETURN jsonb_build_object('created', true, 'order', to_jsonb(inserted));
END;
$$;
REVOKE ALL ON FUNCTION public.create_order_with_commission(TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_commission(TEXT, TEXT, JSONB, JSONB) TO service_role;


-- Prise en charge d’un virement : la réserve doit être exacte AVANT le prestataire.
CREATE OR REPLACE FUNCTION public.begin_payout_transfer(p_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.payouts%ROWTYPE; reserved NUMERIC;
BEGIN
 SELECT * INTO p FROM public.payouts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR p.status NOT IN ('pending','processing') OR p.payment_method='cash' THEN RAISE EXCEPTION 'STATUS_CONFLICT'; END IF;
 SELECT coalesce(sum(amount),0) INTO reserved FROM public.commissions WHERE reseller_id=p.reseller_id AND reserved_for_withdrawal=p.id AND status='reserved';
 IF reserved<>coalesce(p.montant_demande,p.amount) THEN RAISE EXCEPTION 'LEDGER_RECONCILIATION_REQUIRED'; END IF;
 UPDATE public.payouts SET status='processing' WHERE id=p.id RETURNING * INTO p;
 RETURN to_jsonb(p);
END; $$;
REVOKE ALL ON FUNCTION public.begin_payout_transfer(TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_payout_transfer(TEXT) TO service_role;


CREATE OR REPLACE FUNCTION public.verify_pickup_atomic(p_order_id TEXT,p_driver_id TEXT,p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.orders%ROWTYPE; instant TIMESTAMPTZ:=now();
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','Commande introuvable.','http',404); END IF;
 IF o.assigned_driver_id IS DISTINCT FROM p_driver_id THEN RETURN jsonb_build_object('error','Cette commande ne vous est pas assignée.','http',403); END IF;
 IF o.picked_up_at IS NOT NULL AND o.status IN ('in_transit','delivered') THEN RETURN jsonb_build_object('success',true,'dejaFait',true,'pickedUpAt',o.picked_up_at); END IF;
 IF o.status<>'dispatched' THEN RETURN jsonb_build_object('error','Commande non disponible au ramassage.','http',409); END IF;
 IF coalesce(o.failed_pickup_attempts,0)>=5 THEN RETURN jsonb_build_object('error','Commande bloquée après cinq essais. Contactez Suguba.','http',423); END IF;
 IF o.pickup_code IS DISTINCT FROM trim(p_code) THEN
  UPDATE public.orders SET failed_pickup_attempts=coalesce(failed_pickup_attempts,0)+1 WHERE id=o.id;
  RETURN jsonb_build_object('error','Code incorrect. Demandez-le au fournisseur.','http',400);
 END IF;
 UPDATE public.orders SET status='in_transit',picked_up_at=instant,failed_pickup_attempts=0 WHERE id=o.id;
 RETURN jsonb_build_object('success',true,'pickedUpAt',instant,'orderNumber',o.order_number);
END; $$;
REVOKE ALL ON FUNCTION public.verify_pickup_atomic(TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pickup_atomic(TEXT,TEXT,TEXT) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
