import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerReglages } from '@/lib/platform-settings';
import { calculerTarifGros, prixMinimalGros } from '@/lib/pricing';

/**
 * Prix du revendeur pour les articles au prix de gros (2026-09-24).
 *
 * GET  : ses prix enregistrés, avec pour chaque article au prix de gros le
 *        prix de gros, le minimal, le conseillé et le gain à son prix.
 * POST : { productId, prix } enregistre son prix (boutique + liens partagés),
 *        refusé sous le prix minimal ; { productId, prix: null } revient au
 *        prix conseillé.
 */

async function revendeurConnecte(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  return session && session.role === 'reseller' ? session : null;
}

export async function GET(req: NextRequest) {
  const session = await revendeurConnecte(req);
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ articles: [] });

  const { data: produits, error } = await admin.from('products')
    .select('*').eq('status', 'approved').eq('mode_prix', 'gros').limit(500);
  // Colonne absente : pas encore d'article au prix de gros.
  if (error) return NextResponse.json({ articles: [], disponible: false });

  const { data: prix } = await admin.from('reseller_prices')
    .select('product_id, price').eq('reseller_id', session.uid);
  const mesPrix = new Map((prix || []).map((l: any) => [l.product_id, Number(l.price)]));
  const { reglages } = await chargerReglages();

  const articles = (produits || []).map((p: any) => {
    const gros = Number(p.supplier_price) || 0;
    const conseille = Number(p.public_price) || 0;
    const monPrix = mesPrix.get(p.id) ?? null;
    const t = calculerTarifGros(gros, monPrix ?? conseille, reglages);
    return {
      id: p.id, nom: p.name, slug: p.slug, image: Array.isArray(p.images) ? p.images[0] || null : null,
      prixGros: gros, prixMinimal: prixMinimalGros(gros, reglages), prixConseille: conseille,
      monPrix, gain: t.commission,
    };
  });
  return NextResponse.json({ articles, disponible: true });
}

export async function POST(req: NextRequest) {
  const session = await revendeurConnecte(req);
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });

  const { productId, prix } = await req.json().catch(() => ({}));
  if (typeof productId !== 'string') return NextResponse.json({ error: 'Article manquant.' }, { status: 400 });

  if (prix === null) {
    await admin.from('reseller_prices').delete().eq('reseller_id', session.uid).eq('product_id', productId);
    return NextResponse.json({ success: true, monPrix: null });
  }
  if (!Number.isInteger(prix) || prix <= 0 || prix > 100_000_000) {
    return NextResponse.json({ error: 'Saisissez un prix en francs, sans virgule.' }, { status: 400 });
  }

  const { data: p } = await admin.from('products').select('*').eq('id', productId).maybeSingle();
  if (!p || p.status !== 'approved' || p.mode_prix !== 'gros') {
    return NextResponse.json({ error: 'Cet article n’est pas vendu au prix de gros.' }, { status: 400 });
  }
  const { reglages } = await chargerReglages();
  const minimal = prixMinimalGros(Number(p.supplier_price), reglages);
  if (prix < minimal) {
    return NextResponse.json({ error: `Prix trop bas : minimum ${minimal.toLocaleString('fr-FR')} F.`, prixMinimal: minimal }, { status: 400 });
  }

  const { error } = await admin.from('reseller_prices').upsert(
    { reseller_id: session.uid, product_id: productId, price: prix, updated_at: new Date().toISOString() },
    { onConflict: 'reseller_id,product_id' },
  );
  if (error) {
    return NextResponse.json({ error: 'Enregistrement impossible (mise à jour de la base à faire ?).' }, { status: 503 });
  }
  const t = calculerTarifGros(Number(p.supplier_price), prix, reglages);
  return NextResponse.json({ success: true, monPrix: prix, gain: t.commission });
}
