import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerReglages } from '@/lib/platform-settings';
import { calculerTarifGros, prixMinimalGros } from '@/lib/pricing';
import { prixEnregistres } from '@/lib/prix-revendeur';
import { ARTICLES_MAX, COUPS_DE_COEUR_MAX, estCoupDeCoeur, trierSelection, type ArticleBoutique, type EtatArticle, type LigneSelection } from '@/lib/boutique-ordre';

/**
 * « Mes articles » (lot 3 du chantier boutique, 2026-10-03) — ROUTE PRIVÉE.
 *
 * Les articles de la boutique du revendeur connecté, dans l'ordre de sa vitrine,
 * avec ce que chacun lui rapporte. Le gain, le prix minimal et l'état ne sont
 * JAMAIS dans le HTML public de la vitrine : seule cette route, qui exige une
 * session revendeur, les renvoie. L'identité vient de la session, jamais de
 * la requête.
 *
 * Pour chaque article :
 *  - prixVitrine : le prix affiché dans la boutique (son prix enregistré pour un
 *    article au prix de gros, sinon le prix public) ;
 *  - gain : calculerTarifGros(...).commission au prix de gros, reseller_commission
 *    sinon ; null si l'article n'est plus en vente ;
 *  - état : 'affiche', 'epuise' (affiché, en fin de rayon), 'retire' (plus en
 *    vente : refusé, retiré, supprimé) ou 'sans_gain' (plus de commission ou
 *    prix sous le plancher) — ces deux derniers ne s'affichent plus.
 *
 * Boutique principale seulement (reseller_shop_items) ; les boutiques Pro
 * (?boutique=<id>) viendront au lot 7.
 */

async function revendeurConnecte(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  return session && session.role === 'reseller' ? session : null;
}

export async function GET(req: NextRequest) {
  const session = await revendeurConnecte(req);
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Vos articles sont indisponibles. Réessayez.' }, { status: 503 });

  const limites = { max: ARTICLES_MAX, coupsDeCoeurMax: COUPS_DE_COEUR_MAX };
  const { data: selection, error } = await admin
    .from('reseller_shop_items')
    .select('product_id, position, added_at')
    .eq('reseller_id', session.uid)
    .order('position', { ascending: true });
  if (error || !Array.isArray(selection)) {
    return NextResponse.json({ error: 'Vos articles sont indisponibles. Réessayez.' }, { status: 503 });
  }
  const lignes = trierSelection(selection as LigneSelection[]);
  if (lignes.length === 0) return NextResponse.json({ articles: [], ...limites });

  const ids = lignes.map((l) => l.product_id);
  // `*` : mode_prix et supplier_price sont récents, une colonne absente ne doit pas
  // faire tomber la page (même règle que /api/reseller/prix).
  const { data: produits, error: erreurProduits } = await admin.from('products').select('*').in('id', ids);
  if (erreurProduits || !Array.isArray(produits)) {
    return NextResponse.json({ error: 'Vos articles sont indisponibles. Réessayez.' }, { status: 503 });
  }
  const parId = new Map(produits.map((p: any) => [p.id, p]));
  const sesPrix = await prixEnregistres(admin, session.uid, ids);
  const auPrixDeGros = produits.some((p: any) => p.mode_prix === 'gros');
  const reglages = auPrixDeGros ? (await chargerReglages()).reglages : null;

  const articles: ArticleBoutique[] = lignes.map((l) => {
    const p: any = parId.get(l.product_id);
    const coupDeCoeur = estCoupDeCoeur(l.position);
    const ajouteLe = l.added_at || null;
    if (!p) {
      return { id: l.product_id, slug: null, nom: 'Article indisponible', image: null, prixVitrine: null, gain: null,
        modePrix: 'fixe', monPrix: null, prixMinimal: null, coupDeCoeur, ajouteLe, etat: 'retire', categorie: null };
    }
    const gros = p.mode_prix === 'gros' && reglages !== null;
    const monPrix = gros ? sesPrix.get(p.id) ?? null : null;
    const prixPublic = Number(p.public_price) || 0;
    const prixVitrine = monPrix ?? (prixPublic > 0 ? prixPublic : null);
    // Même filtre que la vitrine (lib/shop.ts) : approuvé, commission > 0, prix « ok ».
    const enVente = p.status === 'approved';
    const partageable = Number(p.reseller_commission) > 0 && (!p.pricing_status || p.pricing_status === 'ok');
    const gain = !enVente ? null
      : gros ? calculerTarifGros(Number(p.supplier_price) || 0, prixVitrine ?? 0, reglages!).commission
        : Number(p.reseller_commission) || 0;
    const etat: EtatArticle = !enVente ? 'retire' : !partageable ? 'sans_gain' : Number(p.stock) > 0 ? 'affiche' : 'epuise';
    return {
      id: p.id,
      slug: p.slug || null,
      nom: p.name || 'Article',
      image: Array.isArray(p.images) && p.images[0] ? String(p.images[0]) : null,
      prixVitrine,
      gain,
      modePrix: gros ? 'gros' : 'fixe',
      monPrix,
      prixMinimal: gros ? prixMinimalGros(Number(p.supplier_price) || 0, reglages!) : null,
      coupDeCoeur,
      ajouteLe,
      etat,
      // Lot 4 (2026-10-03) : rayon de la vitrine, pour « Partager ce rayon ».
      categorie: p.category || null,
    };
  });

  return NextResponse.json({ articles, ...limites });
}
