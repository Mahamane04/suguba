import { NextRequest, NextResponse } from 'next/server';
import { verifyActiveSession } from '@/lib/active-session';
import { possedeRoleActif, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { boutiqueDuProprietaire, obtenirOuCreerBoutique } from '@/lib/reseau/boutiques';
import { boutiqueDuCompte } from '@/lib/reseau/boutiques-multiples';
import { nomPublic } from '@/lib/shop';
import { adresseVitrine, PORTE_MA_BOUTIQUE } from '@/lib/reseau/porte-boutique';

/**
 * Porte unique « Ma boutique » (lot 1 du chantier boutique, 2026-10-03).
 *
 * Gestionnaire de route, pas une page : il trouve la boutique principale de la
 * session et redirige (307) vers /boutique/<adresse>, dans le MÊME onglet — y
 * compris dans l'application installée, d'où l'on ne sort plus.
 *
 * Session : on vérifie l'uid ET possedeRoleActif(session, 'reseller'), PAS
 * sessionAvecRole. Le middleware (/reseller/*) bascule le profil actif en
 * posant un nouveau jeton dans la RÉPONSE : ce gestionnaire lit encore l'ancien,
 * dont le rôle actif peut être « client » ou « fournisseur » pour un compte qui
 * est aussi revendeur. Le bandeau « C'est votre boutique · Gérer » de la vitrine
 * compte justement sur cette bascule.
 *
 * Sans boutique, elle est créée avec « Prénom I. » (nomPublic), jamais avec le
 * nom complet : son adresse en est tirée, et ne se change ensuite qu'UNE fois
 * (lot 8, « Adresse de ma boutique » dans Personnaliser).
 *
 * Lot 7 (2026-10-03) : ?boutique=<id> ouvre une boutique supplémentaire (formule
 * Pro) du compte. Le bandeau « C'est votre boutique · Gérer » de SA vitrine passe
 * par ici pour rebasculer le profil, puis y revenir. La boutique doit appartenir
 * à la session (boutiqueDuCompte) ; sinon, la boutique principale, comme sans
 * paramètre — jamais la boutique d'un autre compte.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const vers = (chemin: string) => NextResponse.redirect(new URL(chemin, req.url), 307);

  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session?.uid || !possedeRoleActif(session, 'reseller')) {
    return vers(`/login?denied=reseller&next=${encodeURIComponent(PORTE_MA_BOUTIQUE)}`);
  }
  // Aperçu d'un administrateur : identité fictive, aucune boutique à ouvrir ni à créer.
  if (session.apercu) return vers('/reseller/boutique');

  try {
    const demandee = req.nextUrl.searchParams.get('boutique');
    if (demandee && demandee.length <= 100) {
      const pro = await boutiqueDuCompte('reseller', session.uid, demandee);
      if (pro?.slug) return vers(adresseVitrine(pro.slug, req.nextUrl.searchParams));
    }
    let boutique = await boutiqueDuProprietaire('reseller', session.uid);
    if (!boutique) {
      const admin = getSupabaseAdmin();
      if (!admin) return vers('/reseller/boutique');
      const { data: profil, error } = await admin.from('profiles').select('full_name').eq('id', session.uid).maybeSingle();
      // Relecture du lot 1 (2026-10-03) : profil illisible = rien n'est créé.
      // L'erreur était ignorée et la boutique naissait « Revendeur Suguba », sous
      // une adresse revendeur-suguba-N (qui ne se change qu'une fois, lot 8).
      if (error || !profil) return vers('/reseller/boutique');
      boutique = await obtenirOuCreerBoutique({
        typeProprietaire: 'reseller',
        proprietaireId: session.uid,
        nom: nomPublic(profil.full_name || null),
      });
    }
    // Base ou table indisponible : la page de réglages garde son écran d'attente.
    if (!boutique?.slug) return vers('/reseller/boutique');
    return vers(adresseVitrine(boutique.slug, req.nextUrl.searchParams));
  } catch {
    return vers('/reseller/boutique');
  }
}
