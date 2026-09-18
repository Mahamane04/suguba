-- ============================================================================
-- SUGUBA — PANIER MULTI-ARTICLES
-- ============================================================================
-- À appliquer APRÈS migration-order-creation.sql. Additif et rejouable.
--
-- Principe : un panier n'est PAS un nouveau type de commande. C'est un lot de
-- commandes ordinaires (une ligne `orders` par article) reliées par
-- `cart_id`, créées par la fonction existante `create_order_with_commission`
-- — donc avec exactement les mêmes contrôles de prix, la même commission et
-- le même reçu. Tous les écrans existants (admin, livreur, suivi,
-- commissions) les traitent sans changement.
--
-- Ce qui est nouveau :
--   • l'ATOMICITÉ du lot : les articles sont créés dans UNE transaction. Si un
--     seul échoue (produit retiré, prix changé), aucun n'est créé — jamais un
--     panier à moitié commandé ;
--   • l'idempotence du lot : renvoyer le même panier après une coupure
--     réseau restitue les commandes déjà créées, sans doublon.
-- ============================================================================
BEGIN;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cart_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cart_position INTEGER;
CREATE INDEX IF NOT EXISTS idx_orders_cart ON public.orders (cart_id) WHERE cart_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cart_creation_requests (
  key_hash TEXT PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  cart_id TEXT NOT NULL UNIQUE,
  receipts JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cart_creation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cart_creation_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.cart_creation_requests TO service_role;

CREATE OR REPLACE FUNCTION public.create_cart_with_commissions(
  p_key_hash TEXT, p_fingerprint TEXT, p_cart_id TEXT, p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  previous public.cart_creation_requests%ROWTYPE;
  item JSONB;
  resultat JSONB;
  recus JSONB := '[]'::jsonb;
  position INTEGER := 0;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key_hash, 0));
  SELECT * INTO previous FROM public.cart_creation_requests WHERE key_hash = p_key_hash;
  IF FOUND THEN
    IF previous.request_fingerprint <> p_fingerprint THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('created', false, 'cart_id', previous.cart_id, 'orders', previous.receipts);
  END IF;

  IF pg_catalog.jsonb_typeof(p_items) <> 'array' OR pg_catalog.jsonb_array_length(p_items) = 0
     OR pg_catalog.jsonb_array_length(p_items) > 20 THEN
    RAISE EXCEPTION 'CART_INVALID' USING ERRCODE = 'P0001';
  END IF;

  -- Chaque article passe par la fonction éprouvée. Une exception dans l'une
  -- d'elles annule TOUTE la transaction, y compris les articles déjà créés.
  FOR item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_items) LOOP
    resultat := public.create_order_with_commission(
      item->>'key_hash', item->>'fingerprint', item->'order', item->'product'
    );
    UPDATE public.orders
       SET cart_id = p_cart_id, cart_position = position
     WHERE id = resultat->'order'->>'id';
    recus := recus || pg_catalog.jsonb_build_array(resultat->'order');
    position := position + 1;
  END LOOP;

  INSERT INTO public.cart_creation_requests (key_hash, request_fingerprint, cart_id, receipts)
  VALUES (p_key_hash, p_fingerprint, p_cart_id, recus);
  RETURN jsonb_build_object('created', true, 'cart_id', p_cart_id, 'orders', recus);
END;
$$;
REVOKE ALL ON FUNCTION public.create_cart_with_commissions(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_cart_with_commissions(TEXT, TEXT, TEXT, JSONB) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
