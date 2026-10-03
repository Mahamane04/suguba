import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { boutiqueDuProprietaire } from '@/lib/reseau/boutiques';
import { lienPermanent } from '@/lib/reseau/db';
import { RAYON_COUPS_DE_COEUR, estCleRayon, refBoutique, type CanalPartage } from '@/lib/reseau/codes';
import { RAYON_SANS_CATEGORIE, adresseBoutique, cleRayon, nomDeRayonPropre } from '@/lib/partage-boutique';

/**
 * Lien de partage de MA boutique (lot 4 du chantier boutique, 2026-10-03) — ROUTE PRIVÉE.
 *
 * POST { canal: 'whatsapp' | 'qr', rayon?: <cle> } → { url, suivi }
 *  - url : le lien suivi /go/<code>, RÉUTILISÉ pour un même canal et un même
 *    rayon (lienPermanent) ; ou l'adresse brute /boutique/<adresse>[?rayon=cle]
 *    quand le suivi est indisponible (suivi: false). Le partage n'attend jamais
 *    un compteur ;
 *  - rayon : toute la boutique sans rayon, « coups-de-coeur » pour les coups de
 *    cœur, sinon la clé d'un rayon (1 à 40 caractères [a-z0-9-]).
 *
 * La boutique est TOUJOURS celle de la session (boutique principale), jamais
 * lue dans la requête. Boutique masquée par Suguba : 409, un lien partagé
 * mènerait le client à une page introuvable.
 *
 * Relecture du lot 4 (2026-10-03) : la route était un GET qui ÉCRIVAIT (lien suivi
 * + SHARE), avec un libellé lu dans l'adresse (?nom=). Le cookie de session étant
 * `sameSite: 'lax'`, un autre site pouvait faire naviguer un revendeur connecté
 * vers cette adresse : lien créé à son nom avec un libellé choisi par ce site
 * (« Mes partages »), étape « Partager ma boutique » cochée, SHARE journalisé sans
 * partage. Désormais :
 *  - POST seulement (un cookie `lax` ne part pas avec un POST venu d'un autre
 *    site), et refus quand le navigateur annonce un appel d'un autre site
 *    (Sec-Fetch-Site) ;
 *  - le libellé du rayon n'est plus lu dans la requête : il est recalculé ici, à
 *    partir des catégories réelles des articles de la boutique (cleRayon), et
 *    seulement à la création du lien.
 *
 * Lot 6 (2026-10-03) : un rayon MAISON (stores.reglages, lu avec la boutique de la
 * session) donne son nom au lien avant toute catégorie : « Ma boutique · Pagnes ».
 */

const CANAUX_BOUTIQUE: readonly CanalPartage[] = ['whatsapp', 'qr'];

/**
 * Nom du rayon `cle` dans la boutique du revendeur : la catégorie d'un de ses
 * articles dont la clé est `cle` (même règle que la vitrine). null si aucun
 * article ne correspond ou si la lecture échoue : « Mes partages » affiche alors
 * la clé rendue lisible.
 */
async function nomDuRayon(revendeurId: string, cle: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data: selection, error } = await admin
    .from('reseller_shop_items')
    .select('product_id')
    .eq('reseller_id', revendeurId);
  if (error || !Array.isArray(selection) || selection.length === 0) return null;
  const ids = selection.map((l: { product_id: string }) => l.product_id).filter(Boolean);
  if (ids.length === 0) return null;
  const { data: produits, error: erreurProduits } = await admin.from('products').select('category').in('id', ids);
  if (erreurProduits || !Array.isArray(produits)) return null;
  for (const p of produits as { category?: string | null }[]) {
    const nom = String(p.category || '').trim() || RAYON_SANS_CATEGORIE;
    if (cleRayon(nom) === cle) return nomDeRayonPropre(nom);
  }
  return null;
}

export async function POST(req: NextRequest) {
  // Appel venu d'un autre site (navigateur récent) : rien n'est créé. En-tête absent
  // (navigateur ancien) : accepté, le POST et le cookie `lax` suffisent.
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') {
    return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 });
  }

  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'reseller') {
    return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  }

  const corps = await req.json().catch(() => null);
  const donnees = corps && typeof corps === 'object' ? corps as Record<string, unknown> : {};
  const canal = (donnees.canal ?? 'whatsapp') as CanalPartage;
  if (!CANAUX_BOUTIQUE.includes(canal)) return NextResponse.json({ error: 'Canal de partage inconnu.' }, { status: 400 });
  const rayon = donnees.rayon == null ? null : donnees.rayon;
  if (rayon !== null && (typeof rayon !== 'string' || !estCleRayon(rayon))) {
    return NextResponse.json({ error: 'Rayon inconnu.' }, { status: 400 });
  }

  const boutique = await boutiqueDuProprietaire('reseller', session.uid);
  if (!boutique) return NextResponse.json({ error: 'Boutique introuvable.' }, { status: 404 });
  if (boutique.statut !== 'active') {
    return NextResponse.json({ error: 'Votre boutique est masquée par Suguba : elle ne peut pas être partagée.' }, { status: 409 });
  }

  const origine = req.nextUrl.origin;
  const brute = adresseBoutique(origine, boutique.slug, rayon);
  // Aperçu d'un administrateur sous l'identité du revendeur : rien n'est créé.
  if (session.apercu) return NextResponse.json({ url: brute, suivi: false });

  const resultat = await lienPermanent({
    ownerId: session.uid,
    ownerRole: 'reseller',
    cible: 'store',
    ref: refBoutique(boutique.slug, rayon),
    canal,
    // Coups de cœur : libellé fixe (« Ma boutique · Coups de cœur »), rien à lire.
    // Rayon maison (lot 6) : son nom, déjà lu avec la boutique ; sinon la catégorie.
    libelle: rayon && rayon !== RAYON_COUPS_DE_COEUR
      ? async () => {
        const maison = boutique.reglages.rayons.find((r) => r.cle === rayon);
        return maison ? nomDeRayonPropre(maison.nom) : nomDuRayon(session.uid, rayon);
      }
      : null,
  }).catch(() => null);

  return NextResponse.json(
    resultat ? { url: `${origine}/go/${resultat.lien.code}`, suivi: true } : { url: brute, suivi: false },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
