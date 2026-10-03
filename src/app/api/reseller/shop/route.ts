import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ARTICLES_MAX, controlerEnsemble, positionAjout, positionsAEcrire, positionsPourOrdre } from '@/lib/boutique-ordre';

/**
 * Sélection d'articles de la boutique d'un revendeur (/boutique/<adresse>, et
 * l'ancienne /r/<code>).
 *
 * L'identité du revendeur vient TOUJOURS de la session signée, jamais du corps
 * de la requête : un revendeur ne peut composer que sa propre vitrine.
 *
 * Lot 3 du chantier boutique (2026-10-03) :
 *  - 'ajouter' n'écrit rien si l'article est déjà là (l'ancien upsert remettait
 *    sa position à zéro), et prend la position qui suit la dernière
 *    (positionAjout) au lieu du nombre d'articles, qui donnait deux fois la
 *    même position après un retrait ;
 *  - 'ordonner' {ordre, coupsDeCoeur} range la vitrine et choisit les coups de
 *    cœur. UNIQUEMENT des UPDATE de position, ligne par ligne : la table a un
 *    effet commercial (offre sur la fiche produit, blocage de l'achat direct au
 *    prix de gros), une suppression suivie d'une réinsertion recréerait une
 *    offre retirée entre-temps. L'ordre doit contenir exactement la sélection
 *    de la session, sinon 409 : la boutique a changé ailleurs.
 */

const MAX_ARTICLES = ARTICLES_MAX;

async function revendeurConnecte(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
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

  const corps = await req.json().catch(() => ({}));
  const { productId, action } = corps || {};

  if (action === 'ordonner') return ordonner(admin, session.uid, corps);

  if (!productId || !['ajouter', 'retirer'].includes(action)) {
    return NextResponse.json({ error: 'productId et action (ajouter | retirer | ordonner) requis.' }, { status: 400 });
  }

  if (action === 'retirer') {
    // Relecture du lot 3 (2026-10-03) : l'erreur était ignorée. « Mes articles »
    // et le catalogue annonçaient « retiré » alors que la ligne restait, avec
    // l'offre du revendeur toujours visible sur la fiche produit.
    const { error: retrait } = await admin.from('reseller_shop_items').delete().eq('reseller_id', session.uid).eq('product_id', productId);
    if (retrait) return NextResponse.json({ error: 'Retrait impossible. Réessayez.' }, { status: 503 });
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

  const { data: lignes, error: lecture } = await admin
    .from('reseller_shop_items')
    .select('product_id, position')
    .eq('reseller_id', session.uid);
  if (lecture || !Array.isArray(lignes)) {
    return NextResponse.json({ error: 'Votre boutique est illisible pour le moment. Réessayez.' }, { status: 503 });
  }
  // Déjà dans la boutique : rien à écrire (sa place et son coup de cœur sont gardés).
  if (lignes.some((l: any) => l.product_id === productId)) return NextResponse.json({ success: true, deja: true });
  if (lignes.length >= MAX_ARTICLES) {
    return NextResponse.json({ error: `Votre boutique contient déjà ${MAX_ARTICLES} articles.` }, { status: 409 });
  }

  const { error } = await admin
    .from('reseller_shop_items')
    .insert({ reseller_id: session.uid, product_id: productId, position: positionAjout(lignes.map((l: any) => l.position)) });
  // Ajouté entre-temps (double appui, autre onglet) : il est bien dans la boutique.
  if (error && error.code === '23505') return NextResponse.json({ success: true, deja: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

/** Range la vitrine et choisit les coups de cœur : UPDATE de position seulement. */
async function ordonner(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, uid: string, corps: any) {
  const ordre = corps?.ordre;
  const coups = corps?.coupsDeCoeur ?? [];
  const calcul = positionsPourOrdre(ordre, coups);
  if (calcul.erreur !== undefined) return NextResponse.json({ error: calcul.erreur }, { status: 400 });

  const { data: lignes, error: lecture } = await admin
    .from('reseller_shop_items')
    .select('product_id, position')
    .eq('reseller_id', uid);
  if (lecture || !Array.isArray(lignes)) {
    return NextResponse.json({ error: 'Votre boutique est illisible pour le moment. Réessayez.' }, { status: 503 });
  }
  if (!controlerEnsemble(lignes.map((l: any) => l.product_id), ordre)) {
    return NextResponse.json({ error: 'Votre boutique a changé, rechargez.' }, { status: 409 });
  }

  // Seules les lignes dont la place change sont écrites (60 au plus), d'abord
  // celles qui deviennent ≥ 0 : une écriture interrompue ne laisse jamais plus de
  // 6 coups de cœur (relecture du lot 3, voir positionsAEcrire).
  const actuelles = new Map<string, number>(lignes.map((l: any) => [l.product_id, Number(l.position)]));
  const aEcrire = positionsAEcrire(calcul.positions, actuelles).slice(0, MAX_ARTICLES);
  for (const p of aEcrire) {
    const { error } = await admin
      .from('reseller_shop_items')
      .update({ position: p.position })
      .eq('reseller_id', uid)
      .eq('product_id', p.id);
    if (error) {
      return NextResponse.json({ error: 'Rangement interrompu : réessayez pour terminer.' }, { status: 503 });
    }
  }
  return NextResponse.json({ success: true, modifies: aEcrire.length });
}
