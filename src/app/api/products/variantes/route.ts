import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Variantes EN VENTE d'un produit, pour le sélecteur de la fiche produit.
 * Publique : uniquement libellé, adresse, prix public et disponibilité.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  const admin = getSupabaseAdmin();
  if (!slug || !admin) return NextResponse.json({ variantes: [] });

  const { data: produit, error } = await admin.from('products').select('variant_group').eq('slug', slug).maybeSingle();
  if (error || !produit?.variant_group) return NextResponse.json({ variantes: [] });

  const { data } = await admin.from('products')
    .select('slug, variant_label, public_price, stock')
    .eq('variant_group', produit.variant_group)
    .eq('status', 'approved')
    .gt('public_price', 0)
    .order('public_price', { ascending: true });

  const variantes = (data || [])
    .filter((v: any) => v.variant_label)
    .map((v: any) => ({ slug: v.slug, libelle: v.variant_label, prix: Number(v.public_price) || 0, enStock: Number(v.stock) > 0 }));
  // Une seule variante en vente : pas de sélecteur à afficher.
  return NextResponse.json(
    { variantes: variantes.length > 1 ? variantes : [] },
    { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } },
  );
}
