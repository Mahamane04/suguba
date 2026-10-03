import { randomUUID } from 'node:crypto';
import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { boutiqueDuProprietaire, type BoutiqueReseau } from '@/lib/reseau/boutiques';
import { journaliser } from '@/lib/reseau/db';
import { notifierAbonnes } from '@/lib/reseau/notifications';
import { nomPublicBoutique } from '@/lib/enseigne';
import { formatDate } from '@/lib/montant';
import {
  ANNONCE_DELAI_HEURES, contenuAnnonce, debutDesNouveautes, nouveautesAAnnoncer, prochaineAnnonce,
  type EtatAnnonce, type ProduitAnnonce, type ResultatAnnonce,
} from '@/lib/annonce-boutique';

/**
 * Prévenir mes abonnés (lot 5 du chantier boutique, 2026-10-03) — ROUTE PRIVÉE.
 *
 * Demande du fondateur : des outils « qui aident à vendre ». Le bouton « Suivre »
 * de la vitrine ne tenait pas sa promesse : les abonnés d'une boutique de
 * revendeur n'étaient jamais prévenus. Ici, le revendeur annonce ses nouveautés,
 * DANS L'APPLICATION SEULEMENT (décision du fondateur, règle anti-ban : aucun
 * envoi WhatsApp automatique, aucun appel sortant).
 *
 * GET → { nouveautes, apercu, abonnesAvecCompte, abonnesSansCompte, derniereAnnonce, possibleLe }
 *   Lecture seule : de quoi afficher « Prévenir mes abonnés (N nouveautés) » et
 *   l'aperçu de la feuille. Rien n'est écrit. Sans nouveauté, ni le nom ni les
 *   abonnés ne sont lus (apercu et comptes à null).
 *
 * POST (sans corps : rien n'est lu dans la requête) → { prevenus, sansCompte, possibleLe }
 *  - session revendeur ; boutique PRINCIPALE de la session, en ligne ;
 *  - 429 si une annonce date de moins de 24 h (événement STORE_ANNOUNCE, lu par
 *    reseller_id : index existant, aucune migration) ;
 *  - nouveautés = articles de SA sélection ajoutés après la dernière annonce
 *    (14 jours au plus, durée de « Nouveau »), affichés et en stock ; 400 s'il n'y
 *    en a aucune ;
 *  - 409 s'il n'a aucun abonné avec un compte : l'annonce ne partirait vers
 *    personne et bloquerait la suivante pour rien ;
 *  - message composé ICI : « Nouveautés chez <enseigne> » et 3 noms d'articles ;
 *  - prevenus et sansCompte sont des chiffres réels (notifications écrites,
 *    abonnés inscrits par téléphone seul).
 *
 * La limite tient même avec deux envois simultanés (deux onglets) : la trace
 * STORE_ANNOUNCE est écrite AVANT l'envoi, porteuse d'un jeton ; si elle ne
 * peut pas l'être, rien ne part. Puis la plus ancienne trace des 24 dernières
 * heures l'emporte : l'autre envoi retire la sienne et reçoit 429. Si aucune
 * notification n'a pu être écrite, la trace est retirée : le revendeur peut
 * réessayer sans attendre 24 h.
 */

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const SANS_CACHE = { 'Cache-Control': 'no-store' };
const INDISPONIBLE = 'Annonce indisponible pour le moment. Réessayez.';
const RIEN_ENVOYE = 'Annonce impossible pour le moment : rien n’a été envoyé. Réessayez.';
const DELAI_MS = ANNONCE_DELAI_HEURES * 3600 * 1000;

function refus(status: number, error: string, enPlus: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...enPlus }, { status, headers: SANS_CACHE });
}

async function revendeurConnecte(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  return session && session.role === 'reseller' ? session : null;
}

interface Lecture {
  boutique: BoutiqueReseau;
  derniere: string | null;
  possibleLe: string | null;
  nouveautes: { id: string; nom: string }[];
  /** Nom public (l'enseigne, ou « Awa D. » ; jamais le nom complet). Lu seulement s'il y a des nouveautés. */
  nomBoutique: string | null;
  /** null si le compte n'a pas pu être lu (ou n'a pas été lu, sans nouveauté) : jamais un 0 inventé. */
  avecCompte: number | null;
  sansCompte: number | null;
}

/** Abonnés avec un compte (follower_id renseigné), ou inscrits par téléphone seul. */
async function compterAbonnes(admin: Admin, boutiqueId: string, avecCompte: boolean): Promise<number | null> {
  const base = admin.from('store_follows').select('store_id', { count: 'exact', head: true }).eq('store_id', boutiqueId);
  const { count, error } = await (avecCompte ? base.not('follower_id', 'is', null) : base.is('follower_id', null));
  return !error && typeof count === 'number' ? count : null;
}

async function lire(admin: Admin, uid: string, maintenant: number): Promise<{ lu: Lecture } | { refus: NextResponse }> {
  // La boutique est TOUJOURS celle de la session (boutique principale), jamais lue dans la requête.
  const boutique = await boutiqueDuProprietaire('reseller', uid).catch(() => null);
  if (!boutique) return { refus: refus(404, 'Boutique introuvable.') };
  if (boutique.statut !== 'active') {
    return { refus: refus(409, 'Votre boutique est masquée par Suguba : vos abonnés ne peuvent pas être prévenus.') };
  }

  // Dernière annonce : sans elle, la limite des 24 h ne peut pas être vérifiée
  // (table absente ou lecture en échec : l'annonce n'est pas proposée).
  const { data: annonces, error: erreurAnnonces } = await admin
    .from('analytics_events')
    .select('occurred_at')
    .eq('event', 'STORE_ANNOUNCE')
    .eq('reseller_id', uid)
    .order('occurred_at', { ascending: false })
    .limit(1);
  if (erreurAnnonces || !Array.isArray(annonces)) return { refus: refus(503, INDISPONIBLE) };
  const derniere = annonces[0]?.occurred_at ? String(annonces[0].occurred_at) : null;

  // Sélection de la SESSION seulement.
  const { data: selection, error: erreurSelection } = await admin
    .from('reseller_shop_items')
    .select('product_id, added_at')
    .eq('reseller_id', uid);
  if (erreurSelection || !Array.isArray(selection)) return { refus: refus(503, INDISPONIBLE) };
  const debut = debutDesNouveautes(derniere, maintenant);
  const recents = (selection as { product_id: string; added_at?: string | null }[])
    .filter((l) => l.product_id && l.added_at && Date.parse(l.added_at) > debut);
  let produits: ProduitAnnonce[] = [];
  if (recents.length > 0) {
    const { data, error } = await admin
      .from('products')
      .select('id, name, status, stock, reseller_commission, pricing_status')
      .in('id', recents.map((l) => l.product_id));
    if (error || !Array.isArray(data)) return { refus: refus(503, INDISPONIBLE) };
    produits = data as ProduitAnnonce[];
  }
  const nouveautes = nouveautesAAnnoncer(recents, produits, debut);
  const lu: Lecture = {
    boutique, derniere, possibleLe: prochaineAnnonce(derniere, maintenant), nouveautes,
    nomBoutique: null, avecCompte: null, sansCompte: null,
  };
  // Sans nouveauté, il n'y a rien à annoncer : ni le nom ni les abonnés ne sont lus
  // (cette lecture part à chaque ouverture de « Mes articles » et des Statistiques).
  if (nouveautes.length === 0) return { lu };

  // Nom public. Profil illisible : rien ne part (sans le nom du compte, on ne
  // peut pas vérifier que le nom de la boutique n'est pas le nom complet).
  const { data: profil, error: erreurProfil } = await admin.from('profiles').select('full_name').eq('id', uid).maybeSingle();
  if (erreurProfil || !profil) return { refus: refus(503, INDISPONIBLE) };
  lu.nomBoutique = nomPublicBoutique(boutique.nom, (profil as { full_name?: string | null }).full_name ?? null);

  [lu.avecCompte, lu.sansCompte] = await Promise.all([
    compterAbonnes(admin, boutique.id, true),
    compterAbonnes(admin, boutique.id, false),
  ]);
  return { lu };
}

export async function GET(req: NextRequest) {
  const session = await revendeurConnecte(req);
  if (!session) return refus(401, 'Session revendeur requise.');
  const admin = getSupabaseAdmin();
  if (!admin) return refus(503, INDISPONIBLE);

  const lecture = await lire(admin, session.uid, Date.now());
  if ('refus' in lecture) return lecture.refus;
  const e = lecture.lu;
  const etat: EtatAnnonce = {
    nouveautes: e.nouveautes.length,
    apercu: e.nouveautes.length > 0 && e.nomBoutique
      ? contenuAnnonce({ nomBoutique: e.nomBoutique, slug: e.boutique.slug, nouveautes: e.nouveautes })
      : null,
    abonnesAvecCompte: e.avecCompte,
    abonnesSansCompte: e.sansCompte,
    derniereAnnonce: e.derniere,
    possibleLe: e.possibleLe,
  };
  return NextResponse.json(etat, { headers: SANS_CACHE });
}

export async function POST(req: NextRequest) {
  // Appel venu d'un autre site (navigateur récent) : rien n'est envoyé. Même
  // règle que la route du partage (relecture du lot 4).
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return refus(403, 'Requête refusée.');

  const session = await revendeurConnecte(req);
  if (!session) return refus(401, 'Session revendeur requise.');
  // Aperçu d'un administrateur sous l'identité du revendeur : rien ne part.
  if (session.apercu) return refus(403, 'Aperçu : rien n’est envoyé.');
  const admin = getSupabaseAdmin();
  if (!admin) return refus(503, INDISPONIBLE);

  const uid = session.uid;
  const maintenant = Date.now();
  const lecture = await lire(admin, uid, maintenant);
  if ('refus' in lecture) return lecture.refus;
  const e = lecture.lu;

  if (e.possibleLe) {
    return refus(429, `Vous avez déjà prévenu vos abonnés : une annonce par 24 h. Prochaine annonce possible le ${formatDate(e.possibleLe, 'jourHeure')}.`, { possibleLe: e.possibleLe });
  }
  if (e.nouveautes.length === 0 || !e.nomBoutique) {
    return refus(400, 'Aucune nouveauté depuis votre dernière annonce : ajoutez d’abord des articles à votre boutique.');
  }
  if (e.avecCompte === null) return refus(503, INDISPONIBLE);
  if (e.avecCompte === 0) {
    return refus(409, 'Aucun abonné avec un compte : personne ne peut être prévenu dans l’application.', { sansCompte: e.sansCompte });
  }

  const contenu = contenuAnnonce({ nomBoutique: e.nomBoutique, slug: e.boutique.slug, nouveautes: e.nouveautes });

  // 1. Trace AVANT l'envoi : c'est elle qui fait la limite des 24 h.
  const reservation = randomUUID();
  const meta = { prevenus: e.avecCompte, sansCompte: e.sansCompte, nouveautes: e.nouveautes.length, reservation };
  const tracee = await journaliser({
    evenement: 'STORE_ANNOUNCE',
    acteurId: uid,
    resellerId: uid,
    sujetType: 'store',
    sujetRef: e.boutique.id,
    meta,
  });
  if (!tracee) return refus(503, RIEN_ENVOYE);
  const journal = () => admin.from('analytics_events');
  // Retire SA trace (jamais celle d'un autre envoi) : sans elle, pas de limite de 24 h
  // pour une annonce qui n'est pas partie.
  const annuler = async () => {
    const { error } = await journal().delete().eq('event', 'STORE_ANNOUNCE').eq('reseller_id', uid).eq('meta->>reservation', reservation);
    if (error) console.error('[ANNONCE] trace non retirée:', error.code);
  };

  // 2. Deux envois simultanés : la plus ancienne trace des 24 h l'emporte.
  const { data: recentes, error: erreurRecentes } = await admin
    .from('analytics_events')
    .select('id, meta')
    .eq('event', 'STORE_ANNOUNCE')
    .eq('reseller_id', uid)
    .gt('occurred_at', new Date(maintenant - DELAI_MS).toISOString())
    .order('id', { ascending: true })
    .limit(5);
  if (erreurRecentes || !Array.isArray(recentes) || recentes.length === 0) {
    await annuler();
    return refus(503, RIEN_ENVOYE);
  }
  const possibleLe = new Date(maintenant + DELAI_MS).toISOString();
  if ((recentes[0] as { meta?: { reservation?: unknown } | null }).meta?.reservation !== reservation) {
    await annuler();
    return refus(429, 'Vous avez déjà prévenu vos abonnés : une annonce par 24 h.', { possibleLe });
  }

  // 3. Envoi, dans l'application seulement. Chiffre RÉEL : les notifications écrites.
  const prevenus = await notifierAbonnes(e.boutique.id, {
    type: 'nouveaute',
    titre: contenu.titre,
    texte: contenu.texte,
    lien: contenu.lien,
  });
  if (prevenus === 0) {
    await annuler();
    return refus(503, 'Vos abonnés n’ont pas pu être prévenus. Réessayez.');
  }
  if (prevenus !== e.avecCompte) {
    await journal().update({ meta: { ...meta, prevenus } })
      .eq('event', 'STORE_ANNOUNCE').eq('reseller_id', uid).eq('meta->>reservation', reservation);
  }

  const resultat: ResultatAnnonce = { prevenus, sansCompte: e.sansCompte, possibleLe };
  return NextResponse.json(resultat, { headers: SANS_CACHE });
}
