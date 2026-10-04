import { NextRequest, NextResponse } from 'next/server';
import { ipClient } from '@/lib/ip-client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session';
import { boutiqueParSlug } from '@/lib/reseau/boutiques';
import { empreinteAdresseDuJour, empreinteVisiteur, journaliser, lienParCode } from '@/lib/reseau/db';
import { estRobotApercu } from '@/lib/reseau/missions';
import { normaliserCodeLien } from '@/lib/reseau/codes';
import { origineDeVisite } from '@/lib/reseau/stats';

/**
 * Visite d'une boutique (lot 4 du chantier boutique, 2026-10-03) — route PUBLIQUE,
 * appelée par VisiteBoutique (src/components/shop/VisiteBoutique.tsx) après 2 s
 * de page visible.
 *
 * POST { slug, via } → toujours 204, sans corps : un tricheur n'apprend rien en
 * rejouant l'appel, et la mesure ne gêne jamais le visiteur.
 *
 * Définition validée par le fondateur : une visite = un vrai navigateur, au moins
 * 2 s de page visible, hors propriétaire et robots d'aperçu, un même visiteur une
 * fois par jour et par boutique, aucune IP stockée. Le signal part du navigateur,
 * jamais du rendu serveur (generateMetadata et la page lisent la boutique, et les
 * aperçus de liens WhatsApp gonfleraient les chiffres).
 *
 * Journal : STORE_VIEW {reseller_id ou supplier_id, subject_type 'store',
 * subject_ref = id de la boutique (stable si son adresse change), link_code = via,
 * meta {v: empreinte salée du visiteur, ipj: empreinte salée de l'adresse IP seule,
 * qui change chaque jour, canal}}. Ni IP ni navigateur en clair.
 * Ces chiffres ne servent à aucun paiement ni à aucune mission.
 *
 * Relecture finale (2026-10-04) — limites d'abus. La route est publique et le
 * « visiteur » se reconnaissait à son IP ET à son navigateur déclaré, que
 * l'appelant choisit : une seule machine gonflait les visites d'une boutique à
 * volonté, et une page d'un autre site pouvait faire émettre l'appel par ses
 * propres visiteurs. Désormais :
 *  - appel venu d'un autre site (Sec-Fetch-Site présent et différent de
 *    « same-origin ») : rien n'est compté — même règle que les routes du partage,
 *    de l'annonce et de l'adresse. En-tête absent (navigateur ancien) : accepté ;
 *  - par adresse IP et par jour : 30 visites au plus pour une même boutique, 200
 *    au plus toutes boutiques confondues. Comptées sur `meta.ipj`, en UNE lecture
 *    sur l'index existant (event, occurred_at) : ni index ni migration. Lecture en
 *    échec : rien n'est écrit. Des visiteurs qui partagent la même adresse (même
 *    opérateur mobile, même Wi-Fi) partagent ces plafonds.
 */
export const dynamic = 'force-dynamic';

/** Visites comptées par adresse IP et par jour : pour une même boutique, puis toutes boutiques confondues. */
const PLAFOND_PAR_BOUTIQUE = 30;
const PLAFOND_PAR_ADRESSE = 200;

const sansCorps = () => new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  try {
    // Toujours 204 : un appel refusé n'apprend rien à celui qui l'émet.
    const site = req.headers.get('sec-fetch-site');
    if (site && site !== 'same-origin') return sansCorps();

    const corps = await req.json().catch(() => ({}));
    // Adresse de boutique seulement (lettres, chiffres, tirets) : la recherche par
    // adresse ne tolère pas les jokers (« % », « _ ») d'une valeur fabriquée.
    const slug = typeof corps?.slug === 'string' ? corps.slug.trim() : '';
    const userAgent = req.headers.get('user-agent');
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/i.test(slug) || estRobotApercu(userAgent)) return sansCorps();

    const boutique = await boutiqueParSlug(slug);
    if (!boutique || boutique.statut !== 'active') return sansCorps();

    // Le propriétaire qui ouvre sa boutique n'est pas un visiteur.
    const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value).catch(() => null);
    if (session?.uid && boutique.proprietaireId && session.uid === boutique.proprietaireId) return sansCorps();

    const admin = getSupabaseAdmin();
    if (!admin) return sansCorps();

    const ip = ipClient(req);
    const visiteur = empreinteVisiteur(ip, userAgent);
    const debutDuJour = new Date();
    debutDuJour.setUTCHours(0, 0, 0, 0); // fuseau de Bamako = UTC
    const adresseDuJour = empreinteAdresseDuJour(ip, debutDuJour.toISOString().slice(0, 10));

    // Une visite par visiteur, par boutique et par jour : lecture préalable sur
    // l'index (event, occurred_at). Lecture en échec : rien n'est écrit.
    const { data: deja, error } = await admin
      .from('analytics_events')
      .select('id')
      .eq('event', 'STORE_VIEW')
      .gte('occurred_at', debutDuJour.toISOString())
      .eq('subject_ref', boutique.id)
      .eq('meta->>v', visiteur)
      .limit(1);
    if (error || !Array.isArray(deja) || deja.length > 0) return sansCorps();

    // Plafonds par adresse IP (relecture finale, 2026-10-04) : les visites déjà
    // comptées aujourd'hui depuis cette adresse, en une lecture (200 lignes au plus).
    const { data: duJour, error: erreurPlafond } = await admin
      .from('analytics_events')
      .select('subject_ref')
      .eq('event', 'STORE_VIEW')
      .gte('occurred_at', debutDuJour.toISOString())
      .eq('meta->>ipj', adresseDuJour)
      .limit(PLAFOND_PAR_ADRESSE);
    if (erreurPlafond || !Array.isArray(duJour) || duJour.length >= PLAFOND_PAR_ADRESSE) return sansCorps();
    if (duJour.filter((l: { subject_ref?: string | null }) => l.subject_ref === boutique.id).length >= PLAFOND_PAR_BOUTIQUE) return sansCorps();

    // Origine : le lien suivi de CETTE boutique qui a amené le visiteur (/go/<code>
    // ajoute ?via=), sinon « direct ».
    const via = normaliserCodeLien(corps?.via);
    const lien = via ? await lienParCode(via) : null;
    const lienDeLaBoutique = Boolean(lien && lien.cible === 'store' && lien.ownerId && lien.ownerId === boutique.proprietaireId);

    await journaliser({
      evenement: 'STORE_VIEW',
      resellerId: boutique.typeProprietaire === 'reseller' ? boutique.proprietaireId : null,
      supplierId: boutique.typeProprietaire === 'supplier' ? boutique.proprietaireId : null,
      sujetType: 'store',
      sujetRef: boutique.id,
      linkCode: lienDeLaBoutique ? via : null,
      meta: { v: visiteur, ipj: adresseDuJour, canal: origineDeVisite(lienDeLaBoutique ? lien?.canal : null) },
    });
  } catch (erreur) {
    console.error('[VISITE BOUTIQUE]', (erreur as Error).message);
  }
  return sansCorps();
}
