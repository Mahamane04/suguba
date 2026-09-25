-- REQ-012/013 / TASK-AUD-M2 — journal des intentions et reprise après réponse perdue.
-- Locale seulement, à appliquer avant le code. Prérequis : migration-saspay.sql.
BEGIN;
CREATE TABLE IF NOT EXISTS public.payment_attempts (
 id TEXT PRIMARY KEY, order_number TEXT NOT NULL REFERENCES public.orders(order_number),
 network TEXT NOT NULL, phone TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SUCCESS','FAILED','CANCELLED')),
 transaction_id TEXT UNIQUE, checkout_url TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_attempts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.payment_attempts TO service_role;
CREATE INDEX IF NOT EXISTS payment_attempts_order ON public.payment_attempts(order_number,created_at DESC);
CREATE OR REPLACE FUNCTION public.begin_order_payment(p_order_number TEXT,p_network TEXT,p_phone TEXT,p_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.orders%ROWTYPE; a public.payment_attempts%ROWTYPE;
BEGIN
 SELECT * INTO o FROM public.orders WHERE order_number=p_order_number FOR UPDATE;
 IF NOT FOUND OR o.payment_collected OR o.status IN ('cancelled','returned') THEN RAISE EXCEPTION 'ORDER_NOT_PAYABLE'; END IF;
 SELECT * INTO a FROM public.payment_attempts WHERE order_number=o.order_number AND status='PENDING' ORDER BY created_at DESC LIMIT 1;
 IF FOUND THEN
   IF a.network<>p_network THEN RAISE EXCEPTION 'PAYMENT_ALREADY_PENDING'; END IF;
   RETURN to_jsonb(a);
 END IF;
 -- Conserver les anciennes transactions, ne jamais les écraser sans vérification.
 IF o.payment_transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.payment_attempts WHERE transaction_id=o.payment_transaction_id) THEN
   RAISE EXCEPTION 'LEGACY_PAYMENT_RECONCILIATION_REQUIRED';
 END IF;
 INSERT INTO public.payment_attempts(id,order_number,network,phone) VALUES(p_id,o.order_number,p_network,p_phone) RETURNING * INTO a;
 RETURN to_jsonb(a);
END; $$;
CREATE OR REPLACE FUNCTION public.record_order_payment(p_id TEXT,p_transaction TEXT,p_checkout TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.payment_attempts%ROWTYPE;
BEGIN
 SELECT * INTO a FROM public.payment_attempts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR (a.transaction_id IS NOT NULL AND a.transaction_id<>p_transaction) THEN RAISE EXCEPTION 'PAYMENT_CONFLICT'; END IF;
 UPDATE public.payment_attempts SET transaction_id=p_transaction,checkout_url=p_checkout WHERE id=p_id RETURNING * INTO a;
 UPDATE public.orders SET payment_transaction_id=p_transaction,payment_network=a.network WHERE order_number=a.order_number;
 RETURN to_jsonb(a);
END; $$;
CREATE OR REPLACE FUNCTION public.apply_verified_payment(p_order_number TEXT,p_transaction TEXT,p_status TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.orders%ROWTYPE;
BEGIN
 IF p_status NOT IN ('SUCCESS','FAILED','CANCELLED') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
 SELECT * INTO o FROM public.orders WHERE order_number=p_order_number FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 IF o.payment_transaction_id IS DISTINCT FROM p_transaction AND NOT EXISTS(
   SELECT 1 FROM public.payment_attempts WHERE order_number=p_order_number AND transaction_id=p_transaction
 ) THEN RAISE EXCEPTION 'PAYMENT_CONFLICT'; END IF;
 UPDATE public.payment_attempts SET status=p_status WHERE transaction_id=p_transaction AND status<>'SUCCESS';
 IF p_status='SUCCESS' THEN
   UPDATE public.orders SET payment_collected=true,payment_method='mobile_money',
     status=CASE WHEN status='pending_call' THEN 'confirmed' ELSE status END WHERE id=o.id;
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.begin_order_payment(TEXT,TEXT,TEXT,TEXT),public.record_order_payment(TEXT,TEXT,TEXT),public.apply_verified_payment(TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_order_payment(TEXT,TEXT,TEXT,TEXT),public.record_order_payment(TEXT,TEXT,TEXT),public.apply_verified_payment(TEXT,TEXT,TEXT) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
