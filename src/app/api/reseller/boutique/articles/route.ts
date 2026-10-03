import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerReglages } from '@/lib/platform-settings';
import { calculerTarifGros, prixMinimalGros } from '@/lib/pricing';
import { prixEnregistres } from '@/lib/prix-revendeur';
import { partageable } from '@/lib/shop';
import { ARTICLES_MAX, COUPS_DE_COEUR_MAX, estCoupDeCoeur, type ArticleBoutique, type EtatArticle } from '@/lib/boutique-ordre';
import { BOUTIQUE_ILLISIBLE, cibleArticles, lireSelection } from '@/lib/reseau/articles-boutique';
import { estEnseigne, nomPublicBoutique } from '@/lib/enseigne';

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
 * Lot 7 (2026-10-03) : ?boutique=<id> lit les articles d'une boutique
 * supplémentaire (formule Pro, store_products) par la couche commune
 * src/lib/reseau/articles-boutique.ts. La boutique doit appartenir à la SESSION
 * (lireBoutiqueDuCompte) : celle d'un autre compte, ou un identifiant inconnu, donne
 * 404 sans rien lire de ses articles. La réponse porte alors `boutique` {id, slug,
 * nom, enseigne, statut} — le nom que voient les clients (l'enseigne, ou
 * « Awa D. »), jamais le nom complet. Sans ce paramètre : la boutique principale,
 * réponse inchangée. Avec l'identifiant de SA boutique principale : ses articles
 * habituels, et `principale: true`.
 *
 * Relecture du lot 7 (2026-10-03) : si la base ne répond pas quand on vérifie la
 * boutique, la réponse est 503 « Vos articles sont indisponibles. Réessayez. »,
 * comme pour un profil ou une sélection illisibles — plus « Boutique introuvable »
 * (404), qui privait son propriétaire du bouton « Réessayer ».
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

  // Boutique visée : la principale de la session, ou une boutique Pro qui lui appartient.
  const demandee = req.nextUrl.searchParams.get('boutique');
  const cible = await cibleArticles(session.uid, demandee);
  if (cible === BOUTIQUE_ILLISIBLE) return NextResponse.json({ error: 'Vos articles sont indisponibles. Réessayez.' }, { status: 503 });
  if (!cible) return NextResponse.json({ error: 'Boutique introuvable.' }, { status: 404 });

  const limites: Record<string, unknown> = { max: ARTICLES_MAX, coupsDeCoeurMax: COUPS_DE_COEUR_MAX };
  // ?boutique=<identifiant de SA boutique principale> : ce sont ses articles
  // habituels ; l'écran le sait et se comporte comme sans paramètre.
  if (demandee !== null && !cible.pro) limites.principale = true;
  if (cible.pro) {
    // Nom public calculé ICI : le nom complet du compte ne quitte pas le serveur.
    // Profil illisible : rien n'est renvoyé plutôt qu'un nom qu'on ne sait pas vérifier.
    const { data: profil, error: erreurProfil } = await admin.from('profiles').select('full_name').eq('id', session.uid).maybeSingle();
    if (erreurProfil || !profil) return NextResponse.json({ error: 'Vos articles sont indisponibles. Réessayez.' }, { status: 503 });
    limites.boutique = {
      id: cible.boutique.id,
      slug: cible.boutique.slug,
      nom: nomPublicBoutique(cible.boutique.nom, profil.full_name),
      enseigne: estEnseigne(cible.boutique.nom, profil.full_name),
      statut: cible.boutique.statut,
    };
  }

  const lignes = await lireSelection(admin, cible);
  if (!lignes) return NextResponse.json({ error: 'Vos articles sont indisponibles. Réessayez.' }, { status: 503 });
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
    const rapporte = partageable(p);
    const gain = !enVente ? null
      : gros ? calculerTarifGros(Number(p.supplier_price) || 0, prixVitrine ?? 0, reglages!).commission
        : Number(p.reseller_commission) || 0;
    const etat: EtatArticle = !enVente ? 'retire' : !rapporte ? 'sans_gain' : Number(p.stock) > 0 ? 'affiche' : 'epuise';
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
