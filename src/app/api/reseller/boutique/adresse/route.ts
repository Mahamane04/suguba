import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adresseLibre, boutiqueDuProprietaire, changerAdresse, etatAdresse } from '@/lib/reseau/boutiques';
import { OPTION_ABSENTE } from '@/lib/boutique-reglages';
import {
  ADRESSE_BRUTE_MAX, ADRESSE_DEJA_CHANGEE, ADRESSE_INDISPONIBLE, ADRESSE_PRISE, adresseDepuis, refusAdresse, refusChangement,
  type EtatAdresseDemandee,
} from '@/lib/adresse-boutique';

/**
 * Adresse de MA boutique (lot 8 du chantier boutique, 2026-10-03) — ROUTE PRIVÉE.
 *
 * Décision du fondateur : un revendeur peut changer l'adresse de sa boutique UNE
 * seule fois, pour qu'elle porte son enseigne au lieu de son nom (« Beaucoup de
 * revendeurs ont une adresse /boutique/prenom-nom »). L'ancienne adresse redirige
 * pour toujours vers la nouvelle : les liens et QR codes déjà partagés restent valides.
 *
 * GET → { option, actuelle, ancienne }
 *   Lecture seule. `option` : la base permet le changement (table
 *   store_slug_aliases, supabase/A-EXECUTER-2026-10-03-vitrine-boutique.sql) ;
 *   `ancienne` : l'adresse d'avant, si le changement a déjà eu lieu.
 * GET ?adresse=<texte> → en plus { demande: { adresse, etat, message } }
 *   `adresse` : ce qui serait enregistré (minuscules, sans accent, tirets) ;
 *   `etat` : 'libre', 'prise' (par une boutique, ou ancienne adresse d'une autre)
 *   ou 'refusee' (format, adresse réservée à Suguba, numéro, déjà la sienne,
 *   changement déjà fait). Simple aide à la saisie : rien n'est réservé.
 *
 * POST { adresse } → { adresse, ancienne }
 *  - la boutique est TOUJOURS la boutique principale de la session, et son
 *    propriétaire l'uid de la session : rien d'autre que `adresse` n'est lu dans
 *    la requête ;
 *  - `adresse` doit être exactement ce que l'aperçu a montré (déjà en minuscules,
 *    sans accent ni espace) : le changement est unique et sans retour, il n'écrit
 *    jamais une autre adresse que celle confirmée à l'écran ;
 *  - 409 si l'adresse est prise, si le changement a déjà eu lieu, ou si l'option
 *    n'existe pas encore (« Option pas encore activée », jamais 500) ;
 *  - POST seulement et refus d'un appel venu d'un autre site (Sec-Fetch-Site),
 *    comme les routes du partage et de l'annonce ; rien en aperçu administrateur.
 *
 * Aucune table d'articles n'est lue ni écrite : reseller_shop_items garde son
 * effet commercial (offres revendeurs, blocage de l'achat direct).
 */

const SANS_CACHE = { 'Cache-Control': 'no-store' };

function refus(status: number, error: string, enPlus: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...enPlus }, { status, headers: SANS_CACHE });
}

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return refus(401, 'Session revendeur requise.');

  const boutique = await boutiqueDuProprietaire('reseller', session.uid).catch(() => null);
  if (!boutique) return refus(404, 'Boutique introuvable.');

  const etat = await etatAdresse(boutique.id);
  const base = { option: etat.option, actuelle: boutique.slug, ancienne: etat.ancienne };
  const brute = req.nextUrl.searchParams.get('adresse');
  // Option absente : la réponse ne dit rien d'une adresse, la section n'existe pas.
  if (brute === null || !etat.option) return NextResponse.json(base, { headers: SANS_CACHE });

  const adresse = adresseDepuis(brute);
  const demande = (etatDemande: EtatAdresseDemandee, message: string | null) =>
    NextResponse.json({ ...base, demande: { adresse, etat: etatDemande, message } }, { headers: SANS_CACHE });
  if (etat.ancienne) return demande('refusee', ADRESSE_DEJA_CHANGEE);
  const raison = brute.length > ADRESSE_BRUTE_MAX ? 'Adresse trop longue.' : refusAdresse(adresse, boutique.slug);
  if (raison) return demande('refusee', raison);

  const libre = await adresseLibre(adresse);
  // On ne sait pas : jamais « libre » sur une panne.
  if (libre === null) return refus(503, ADRESSE_INDISPONIBLE);
  return libre ? demande('libre', null) : demande('prise', ADRESSE_PRISE);
}

export async function POST(req: NextRequest) {
  // Appel venu d'un autre site (navigateur récent) : rien ne change.
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return refus(403, 'Requête refusée.');

  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return refus(401, 'Session revendeur requise.');
  // Aperçu d'un administrateur sous l'identité du revendeur : rien n'est enregistré.
  if (session.apercu) return refus(403, 'Aperçu : rien n’est enregistré.');

  const corps = await req.json().catch(() => null);
  const brute = corps && typeof corps === 'object' && !Array.isArray(corps) ? (corps as Record<string, unknown>).adresse : undefined;
  // L'adresse confirmée à l'écran, telle quelle : jamais une autre que celle-là.
  if (typeof brute !== 'string' || brute.length > ADRESSE_BRUTE_MAX || adresseDepuis(brute) !== brute) {
    return refus(400, 'Adresse illisible. Vérifiez-la, puis réessayez.');
  }

  // Identité tirée de la session : SA boutique principale, jamais un identifiant de la requête.
  const boutique = await boutiqueDuProprietaire('reseller', session.uid).catch(() => null);
  if (!boutique) return refus(404, 'Boutique introuvable.');
  const raison = refusAdresse(brute, boutique.slug);
  if (raison) return refus(400, raison);

  const resultat = await changerAdresse(boutique.id, session.uid, brute);
  if (resultat !== 'ok') {
    const r = refusChangement(resultat, OPTION_ABSENTE);
    return refus(r.statut, r.erreur, { resultat });
  }
  return NextResponse.json({ adresse: brute, ancienne: boutique.slug.toLowerCase() }, { headers: SANS_CACHE });
}
