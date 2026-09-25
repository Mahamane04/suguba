-- REQ-AUD-REMise : quota partagé pour l’envoi au destinataire. Non appliqué en production.
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sms_requested_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sms_request_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sms_window_started_at TIMESTAMPTZ;
CREATE OR REPLACE FUNCTION public.claim_order_sms(p_order_number TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.orders%ROWTYPE; group_key TEXT; new_code TEXT;
BEGIN
 SELECT * INTO o FROM public.orders WHERE order_number=p_order_number;
 IF NOT FOUND THEN RETURN false; END IF;
 group_key := COALESCE(o.cart_id||':'||(o.pricing_snapshot->'panier'->>'groupeLivraison'),o.id);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sms:'||group_key,0));
 SELECT * INTO o FROM public.orders WHERE order_number=p_order_number FOR UPDATE;
 IF o.status NOT IN ('pending_call','confirmed','dispatched','in_transit') THEN RETURN false; END IF;
 IF o.sms_requested_at >= now()-interval '60 seconds' THEN RETURN false; END IF;
 IF o.sms_request_count>=3 AND COALESCE(o.sms_window_started_at,o.sms_requested_at)>=now()-interval '30 minutes' THEN RETURN false; END IF;
 new_code := o.delivery_otp;
 -- Les codes des anciens reçus ne deviennent jamais une preuve de remise.
 IF o.delivery_code_version<1 THEN
   LOOP
     new_code := ((('x'||substr(gen_random_uuid()::text,1,8))::bit(32)::bigint % 9000)+1000)::text;
     EXIT WHEN new_code IS DISTINCT FROM o.delivery_otp;
   END LOOP;
 END IF;
 UPDATE public.orders SET
   delivery_otp=new_code, delivery_code_version=1,
   delivery_code_sent_at=CASE WHEN delivery_code_version<1 THEN NULL ELSE delivery_code_sent_at END,
   sms_request_count=CASE WHEN COALESCE(o.sms_window_started_at,o.sms_requested_at)<now()-interval '30 minutes' OR o.sms_requested_at IS NULL THEN 1 ELSE o.sms_request_count+1 END,
   sms_window_started_at=CASE WHEN COALESCE(o.sms_window_started_at,o.sms_requested_at)<now()-interval '30 minutes' OR o.sms_requested_at IS NULL THEN now() ELSE COALESCE(o.sms_window_started_at,o.sms_requested_at) END,
   sms_requested_at=now()
 WHERE COALESCE(cart_id||':'||(pricing_snapshot->'panier'->>'groupeLivraison'),id)=group_key
   AND status IN ('pending_call','confirmed','dispatched','in_transit');
 RETURN true;
END; $$;
CREATE OR REPLACE FUNCTION public.confirm_delivery_sms(p_order_number TEXT,p_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE group_key TEXT;
BEGIN
 SELECT COALESCE(cart_id||':'||(pricing_snapshot->'panier'->>'groupeLivraison'),id) INTO group_key
 FROM public.orders WHERE order_number=p_order_number;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sms:'||group_key,0));
 UPDATE public.orders SET delivery_code_sent_at=now()
 WHERE COALESCE(cart_id||':'||(pricing_snapshot->'panier'->>'groupeLivraison'),id)=group_key
 AND delivery_code_version=1 AND delivery_otp=p_code
 AND status IN ('pending_call','confirmed','dispatched','in_transit');
 RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.confirm_delivery_sms(TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_delivery_sms(TEXT,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.claim_order_sms(TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_sms(TEXT) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
