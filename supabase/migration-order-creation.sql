-- REQ-013 / TASK-017 / TEST-013 : confirmation après écriture atomique.
-- À appliquer AVANT le déploiement de /api/orders/create. Réexécutable.
-- Ne modifie aucune commande ou commission existante.
BEGIN;

CREATE TABLE IF NOT EXISTS public.order_creation_requests (
  key_hash TEXT PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  order_id TEXT NOT NULL UNIQUE REFERENCES public.orders(id),
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_creation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_creation_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.order_creation_requests TO service_role;

-- Ferme aussi l'ancien contournement de la tarification par INSERT direct.
DROP POLICY IF EXISTS "Public insert orders" ON public.orders;

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
  SELECT * INTO product FROM public.products WHERE id = p_order->>'product_id' FOR SHARE;
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
NOTIFY pgrst, 'reload schema';
COMMIT;
