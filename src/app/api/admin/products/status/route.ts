import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const STATUTS_AUTORISES = ['rejected', 'archived'] as const;

/**
 * Retire un produit de la vente — admin seul (2026-09-11).
 *
 * Contrepartie de la publication automatique (src/lib/publication-auto.ts) :
 * les produits partent en vente sans validation préalable, l'admin doit donc
 * pouvoir en retirer un en un clic. Un produit retiré n'est jamais republié
 * automatiquement ; pour le remettre en vente, l'admin fixe son prix
 * (/api/admin/products/price).
 */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const { productId, statut } = await req.json().catch(() => ({}));
  if (!productId || !STATUTS_AUTORISES.includes(statut)) {
    return NextResponse.json({ error: 'Produit et statut (rejected ou archived) requis.' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('products')
    .update({ status: statut })
    .eq('id', productId)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 });

  return NextResponse.json({ success: true, statut });
}
