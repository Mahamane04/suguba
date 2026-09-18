import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Popularité des produits : nombre de livraisons réussies par produit, pour
 * le tri « Populaires » du catalogue revendeur (§ page 9).
 *
 * Publique, comme /api/products/livraisons qui publie déjà ce chiffre produit
 * par produit sur les fiches. Aucun client, aucun montant : un compteur.
 */
export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ livraisons: {} });
  const { data } = await admin.from('orders').select('product_id').eq('status', 'delivered').limit(20000);
  const livraisons: Record<string, number> = {};
  for (const o of data || []) if (o.product_id) livraisons[o.product_id] = (livraisons[o.product_id] || 0) + 1;
  return NextResponse.json(
    { livraisons },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  );
}
