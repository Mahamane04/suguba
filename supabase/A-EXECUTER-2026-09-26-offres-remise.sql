-- ═══════════════════════════════════════════════════════════════════════════
-- Offres & remise par le fournisseur (2026-09-26, lot 1a)
--
-- 1. Une offre dit sa NATURE (produit, service, produit + service) et QUI la
--    remet au client (livreur Suguba, fournisseur, retrait chez lui).
-- 2. « Organiser la remise » : le fournisseur prend en charge une commande
--    confirmée ; elle lui est assignée à la place d'un livreur, et il la
--    remet ensuite contre le QR / code du client (verify_delivery_atomic,
--    inchangée : elle vérifie seulement que la commande est assignée à
--    celui qui valide).
-- 3. Caisse : un fournisseur qui a encaissé des espèces les remet à Suguba ;
--    il ne garde PAS de rémunération de livreur (il n'en a pas).
--
-- Le mode de remise d'une commande est lu dans pricing_snapshot->'remise'
-- (écrit à la création) : aucune fonction de création de commande à modifier.
--
-- À exécuter une fois dans le SQL Editor de Supabase. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS type_offre TEXT NOT NULL DEFAULT 'produit';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mode_remise TEXT NOT NULL DEFAULT 'livreur';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS frais_remise NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS offre_inclus TEXT;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_type_offre_check;
ALTER TABLE public.products ADD CONSTRAINT products_type_offre_check CHECK (type_offre IN ('produit', 'service', 'produit_service'));
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_mode_remise_check;
ALTER TABLE public.products ADD CONSTRAINT products_mode_remise_check CHECK (mode_remise IN ('livreur', 'fournisseur', 'retrait'));
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_frais_remise_check;
ALTER TABLE public.products ADD CONSTRAINT products_frais_remise_check CHECK (frais_remise >= 0 AND frais_remise <= 10000000);

-- « Organiser la remise » : toutes les commandes confirmées de la même
-- livraison (même panier, même groupe) de ce fournisseur lui sont assignées,
-- et passent « en cours de remise ». Idempotent.
CREATE OR REPLACE FUNCTION public.prendre_en_charge_remise(p_order_id TEXT, p_supplier_id TEXT, p_supplier_name TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  o public.orders%ROWTYPE;
  proprietaire TEXT;
  mode TEXT;
  cle TEXT;
  n INTEGER := 0;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Commande introuvable.', 'http', 404); END IF;
  SELECT supplier_id INTO proprietaire FROM public.products WHERE id = o.product_id;
  IF proprietaire IS DISTINCT FROM p_supplier_id THEN
    RETURN jsonb_build_object('error', 'Cette commande ne concerne pas vos offres.', 'http', 403);
  END IF;
  mode := coalesce(o.pricing_snapshot->'remise'->>'mode', 'livreur');
  IF mode = 'livreur' THEN
    RETURN jsonb_build_object('error', 'Cette commande est livrée par un livreur Suguba.', 'http', 409);
  END IF;
  IF o.status = 'in_transit' AND o.assigned_driver_id = p_supplier_id THEN
    RETURN jsonb_build_object('success', true, 'orderNumber', o.order_number);
  END IF;
  IF o.status <> 'confirmed' THEN
    RETURN jsonb_build_object('error', 'La commande doit d’abord être confirmée par Suguba (appel au client).', 'http', 409);
  END IF;

  cle := coalesce(o.cart_id || ':' || (o.pricing_snapshot->'panier'->>'groupeLivraison'), o.id);
  UPDATE public.orders x
     SET assigned_driver_id = p_supplier_id,
         assigned_driver_name = p_supplier_name,
         status = 'in_transit',
         picked_up_at = now()
   WHERE coalesce(x.cart_id || ':' || (x.pricing_snapshot->'panier'->>'groupeLivraison'), x.id) = cle
     AND x.status = 'confirmed'
     AND coalesce(x.pricing_snapshot->'remise'->>'mode', 'livreur') <> 'livreur'
     AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = x.product_id AND p.supplier_id = p_supplier_id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'orderNumber', o.order_number, 'commandes', n);
END; $$;

REVOKE ALL ON FUNCTION public.prendre_en_charge_remise(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prendre_en_charge_remise(TEXT, TEXT, TEXT) TO service_role;

-- Caisse : seule une commande livrée par un livreur Suguba lui laisse garder
-- sa rémunération. Reprend record_driver_remittance (2026-09-25) à l'identique,
-- sauf le calcul de la part gardée.
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

  garde := least(especes, greatest(0, coalesce(p_remuneration_par_course, 0)) * par_livreur);
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

NOTIFY pgrst, 'reload schema';
