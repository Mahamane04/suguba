import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { boutiqueDuProprietaire } from '@/lib/reseau/boutiques';
import { lienPermanent } from '@/lib/reseau/db';
import { estCleRayon, refBoutique, type CanalPartage } from '@/lib/reseau/codes';
import { adresseBoutique, nomDeRayonPropre } from '@/lib/partage-boutique';

/**
 * Lien de partage de MA boutique (lot 4 du chantier boutique, 2026-10-03) — ROUTE PRIVÉE.
 *
 * GET ?canal=whatsapp|qr&rayon=<cle>&nom=<nom du rayon> → { url, suivi }
 *  - url : le lien suivi /go/<code>, RÉUTILISÉ pour un même canal et un même
 *    rayon (lienPermanent) ; ou l'adresse brute /boutique/<adresse>[?rayon=cle]
 *    quand le suivi est indisponible (suivi: false). Le partage n'attend jamais
 *    un compteur ;
 *  - rayon : toute la boutique sans rayon, « coups-de-coeur » pour les coups de
 *    cœur, sinon la clé d'un rayon (1 à 40 caractères [a-z0-9-]) ;
 *  - nom : libellé du rayon pour « Mes partages », gardé à la création seulement.
 *
 * La boutique est TOUJOURS celle de la session (boutique principale), jamais
 * lue dans la requête. Boutique masquée par Suguba : 409, un lien partagé
 * mènerait le client à une page introuvable.
 */

const CANAUX_BOUTIQUE: readonly CanalPartage[] = ['whatsapp', 'qr'];

export async function GET(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'reseller') {
    return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  }

  const q = req.nextUrl.searchParams;
  const canal = (q.get('canal') || 'whatsapp') as CanalPartage;
  if (!CANAUX_BOUTIQUE.includes(canal)) return NextResponse.json({ error: 'Canal de partage inconnu.' }, { status: 400 });
  const rayon = q.get('rayon');
  if (rayon !== null && !estCleRayon(rayon)) return NextResponse.json({ error: 'Rayon inconnu.' }, { status: 400 });

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
    libelle: rayon ? nomDeRayonPropre(q.get('nom')) : null,
  }).catch(() => null);

  return NextResponse.json(
    resultat ? { url: `${origine}/go/${resultat.lien.code}`, suivi: true } : { url: brute, suivi: false },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
