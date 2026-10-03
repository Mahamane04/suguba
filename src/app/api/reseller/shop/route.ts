import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { BOUTIQUE_ILLISIBLE, ajouterArticle, cibleArticles, ordonnerArticles, retirerArticle } from '@/lib/reseau/articles-boutique';

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
 *
 * Lot 7 (2026-10-03), boutiques Pro au même niveau : les trois actions sont
 * écrites dans la couche commune src/lib/reseau/articles-boutique.ts, qui vise
 * reseller_shop_items (boutique principale, comme avant) ou store_products
 * (boutique supplémentaire). `boutique: <id>` dans le corps désigne une boutique
 * Pro : elle doit appartenir à la session (lireBoutiqueDuCompte), sinon 404 et rien
 * n'est écrit. Sans ce champ, rien ne change : la boutique principale.
 *
 * Relecture du lot 7 (2026-10-03) : base en panne pendant cette vérification →
 * 503 « illisible pour le moment », rien n'est écrit ; plus « Boutique
 * introuvable » (404) pour le vrai propriétaire.
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
  const estOrdre = action === 'ordonner';

  if (!estOrdre && (!productId || typeof productId !== 'string' || !['ajouter', 'retirer'].includes(action))) {
    return NextResponse.json({ error: 'productId et action (ajouter | retirer | ordonner) requis.' }, { status: 400 });
  }

  // Boutique visée : la principale de la session, ou une boutique Pro qui lui
  // appartient (`boutique`). Celle d'un autre compte est « introuvable ».
  const cible = await cibleArticles(session.uid, corps?.boutique);
  if (cible === BOUTIQUE_ILLISIBLE) return NextResponse.json({ error: 'Votre boutique est illisible pour le moment. Réessayez.' }, { status: 503 });
  if (!cible) return NextResponse.json({ error: 'Boutique introuvable.' }, { status: 404 });

  const reponse = estOrdre ? await ordonnerArticles(admin, cible, corps?.ordre, corps?.coupsDeCoeur ?? [])
    : action === 'retirer' ? await retirerArticle(admin, cible, productId)
      : await ajouterArticle(admin, cible, productId);
  return NextResponse.json(reponse.corps, { status: reponse.statut });
}
