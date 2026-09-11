import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Stock d'un produit du fournisseur connecté — et rien d'autre (2026-09-11).
 *
 * L'inventaire fournisseur affichait les produits d'un fournisseur de
 * démonstration et ne modifiait que la mémoire du téléphone. Cette route ne
 * touche qu'au stock, et seulement sur un produit qui appartient au
 * fournisseur connecté.
 */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'supplier') {
    return NextResponse.json({ error: 'Session fournisseur requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const { productId, stock } = await req.json().catch(() => ({}));
  const quantite = Number(stock);
  if (!productId || !Number.isInteger(quantite) || quantite < 0 || quantite > 100000) {
    return NextResponse.json({ error: 'Produit et quantité (0 à 100 000) requis.' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('products')
    .update({ stock: quantite })
    .eq('id', productId)
    .eq('supplier_id', session.uid)
    .select('id, stock')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Produit introuvable ou qui ne vous appartient pas.' }, { status: 404 });

  return NextResponse.json({ success: true, stock: Number(data.stock) || 0 });
}
