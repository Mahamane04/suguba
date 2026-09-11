import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Nombre de livraisons RÉUSSIES d'un produit — public, rien d'autre
 * (2026-09-11). Sert de preuve sociale honnête sur la page produit : un chiffre
 * réel, tiré des commandes livrées, affiché seulement s'il est supérieur à zéro.
 * Aucune note, aucun avis, aucun compteur inventé.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'Produit requis.' }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ livraisons: 0 });

  const { data: produit } = await admin
    .from('products')
    .select('id, status')
    .eq('slug', slug)
    .maybeSingle();
  if (!produit || produit.status !== 'approved') return NextResponse.json({ livraisons: 0 });

  const { count } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', produit.id)
    .eq('status', 'delivered');

  return NextResponse.json(
    { livraisons: count ?? 0 },
    // Le chiffre bouge lentement : 5 minutes de cache côté Vercel suffisent.
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  );
}
