-- TASK-AUD-SEARCH : recherche avant pagination, paniers conservés entiers.
BEGIN;
CREATE OR REPLACE FUNCTION public.search_admin_orders(p_status TEXT DEFAULT '',p_query TEXT DEFAULT '',p_page INTEGER DEFAULT 1)
RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH groupes AS (
  SELECT coalesce(cart_id,id) AS cle,max(created_at) AS dernier
  FROM public.orders
  WHERE (p_status='' OR status=p_status)
    AND (p_query='' OR strpos(lower(concat_ws(' ',order_number,customer_name,customer_phone,product_name,reseller_code)),lower(p_query))>0)
  GROUP BY coalesce(cart_id,id)
 ), page AS (
  SELECT cle,dernier FROM groupes ORDER BY dernier DESC,cle LIMIT 50 OFFSET (greatest(1,least(p_page,100000))-1)*50
 ), compteurs AS (
  SELECT status,count(DISTINCT coalesce(cart_id,id)) AS n FROM public.orders GROUP BY status
 ) SELECT jsonb_build_object(
   'orders',coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY p.dernier DESC,p.cle,o.created_at,o.id) FROM public.orders o JOIN page p ON p.cle=coalesce(o.cart_id,o.id)),'[]'::jsonb),
   'total',(SELECT count(*) FROM groupes),
   'counts',coalesce((SELECT jsonb_object_agg(status,n) FROM compteurs),'{}'::jsonb)
 );
$$;
REVOKE ALL ON FUNCTION public.search_admin_orders(TEXT,TEXT,INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.search_admin_orders(TEXT,TEXT,INTEGER) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
