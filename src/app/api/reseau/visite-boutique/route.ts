import { NextRequest, NextResponse } from 'next/server';
import { ipClient } from '@/lib/ip-client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session';
import { boutiqueParSlug } from '@/lib/reseau/boutiques';
import { empreinteVisiteur, journaliser, lienParCode } from '@/lib/reseau/db';
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
 * meta {v: empreinte salée du visiteur, canal}}. Ni IP ni navigateur en clair.
 * Ces chiffres ne servent à aucun paiement ni à aucune mission.
 */
export const dynamic = 'force-dynamic';

const sansCorps = () => new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  try {
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

    const visiteur = empreinteVisiteur(ipClient(req), userAgent);
    const debutDuJour = new Date();
    debutDuJour.setUTCHours(0, 0, 0, 0); // fuseau de Bamako = UTC

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
      meta: { v: visiteur, canal: origineDeVisite(lienDeLaBoutique ? lien?.canal : null) },
    });
  } catch (erreur) {
    console.error('[VISITE BOUTIQUE]', (erreur as Error).message);
  }
  return sansCorps();
}
