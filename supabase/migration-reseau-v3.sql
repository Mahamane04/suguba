-- ============================================================================
-- SUGUBA — RÉSEAU V3 : compteurs de sponsorisation
-- ============================================================================
-- À exécuter après migration-reseau-v1.sql. Additif et rejouable.
--
-- Incrément atomique des vues et des clics d'une sponsorisation : deux
-- visiteurs simultanés ne doivent pas s'écraser (lecture + écriture côté
-- application le permettrait). Seules les sponsorisations ACTIVES comptent.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.compter_sponsorisation(p_ids TEXT[], p_evenement TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_ids IS NULL OR pg_catalog.array_length(p_ids, 1) IS NULL OR pg_catalog.array_length(p_ids, 1) > 30 THEN
    RETURN;
  END IF;
  IF p_evenement = 'vue' THEN
    UPDATE public.sponsorships SET impressions = impressions + 1
     WHERE id = ANY(p_ids) AND status = 'active';
  ELSIF p_evenement = 'clic' THEN
    UPDATE public.sponsorships SET clicks = clicks + 1
     WHERE id = ANY(p_ids) AND status = 'active';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.compter_sponsorisation(TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compter_sponsorisation(TEXT[], TEXT) TO service_role;

-- ── Conversion : ne faire avancer que les missions du BON produit ──────────
-- La première version faisait progresser toutes les missions « vente » du
-- revendeur, y compris une campagne fournisseur portant sur un autre produit.
CREATE OR REPLACE FUNCTION public.enregistrer_conversion_produit(
  p_link_code TEXT,
  p_customer_phone TEXT,
  p_reseller_id TEXT,
  p_amount NUMERIC,
  p_product_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_link_code IS NOT NULL THEN
    UPDATE public.tracking_links
       SET orders_count = orders_count + 1, revenue = revenue + COALESCE(p_amount, 0)
     WHERE code = p_link_code;
  END IF;

  IF p_customer_phone IS NOT NULL THEN
    UPDATE public.customer_attributions
       SET orders_count = orders_count + 1, revenue = revenue + COALESCE(p_amount, 0), last_seen_at = NOW()
     WHERE customer_phone = p_customer_phone;
  END IF;

  IF p_reseller_id IS NOT NULL THEN
    UPDATE public.mission_participants mp
       SET progress = mp.progress + 1
      FROM public.missions m
     WHERE mp.mission_id = m.id
       AND mp.reseller_id = p_reseller_id
       AND mp.status = 'joined'
       AND m.status = 'active'
       AND m.mission_type = 'sale'
       AND (m.product_id IS NULL OR m.product_id = p_product_id)
       AND (m.ends_at IS NULL OR m.ends_at > NOW());

    UPDATE public.mission_participants mp
       SET status = 'completed', completed_at = NOW()
      FROM public.missions m
     WHERE mp.mission_id = m.id
       AND mp.reseller_id = p_reseller_id
       AND mp.status = 'joined'
       AND mp.progress >= m.objective;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.enregistrer_conversion_produit(TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enregistrer_conversion_produit(TEXT, TEXT, TEXT, NUMERIC, TEXT) TO service_role;
