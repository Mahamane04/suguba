import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Sélection d'articles de la boutique d'un revendeur (/r/<code>).
 *
 * L'identité du revendeur vient TOUJOURS de la session signée, jamais du corps
 * de la requête : un revendeur ne peut composer que sa propre vitrine.
 */

const MAX_ARTICLES = 60;

async function revendeurConnecte(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  return session && session.role === 'reseller' ? session : null;
}

export async function GET(req: NextRequest) {
  const session = await revendeurConnecte(req);
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ articles: [] });

  const { data } = await admin
    .from('reseller_shop_items')
    .select('product_id, position')
    .eq('reseller_id', session.uid)
    .order('position', { ascending: true });

  return NextResponse.json({ articles: (data || []).map((a) => a.product_id) });
}

export async function POST(req: NextRequest) {
  const session = await revendeurConnecte(req);
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const { productId, action } = await req.json().catch(() => ({}));
  if (!productId || !['ajouter', 'retirer'].includes(action)) {
    return NextResponse.json({ error: 'productId et action (ajouter | retirer) requis.' }, { status: 400 });
  }

  if (action === 'retirer') {
    await admin.from('reseller_shop_items').delete().eq('reseller_id', session.uid).eq('product_id', productId);
    return NextResponse.json({ success: true });
  }

  const { data: produit } = await admin
    .from('products')
    .select('id, status, reseller_commission, pricing_status')
    .eq('id', productId)
    .maybeSingle();

  // Seuls les produits qui rapportent quelque chose au revendeur peuvent entrer
  // dans sa boutique : un article sous le plancher ou à commission nulle
  // n'y aurait aucun sens.
  const partageable = produit
    && produit.status === 'approved'
    && Number(produit.reseller_commission) > 0
    && (!produit.pricing_status || produit.pricing_status === 'ok');
  if (!partageable) {
    return NextResponse.json({ error: 'Ce produit ne peut pas être ajouté à votre boutique.' }, { status: 400 });
  }

  const { count } = await admin
    .from('reseller_shop_items')
    .select('product_id', { count: 'exact', head: true })
    .eq('reseller_id', session.uid);
  if ((count ?? 0) >= MAX_ARTICLES) {
    return NextResponse.json({ error: `Votre boutique contient déjà ${MAX_ARTICLES} articles.` }, { status: 409 });
  }

  const { error } = await admin
    .from('reseller_shop_items')
    .upsert({ reseller_id: session.uid, product_id: productId, position: count ?? 0 }, { onConflict: 'reseller_id,product_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
