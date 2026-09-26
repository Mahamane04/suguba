import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut } from '@/lib/reseau/db';
import { changerStatutSponsorisation, listerPacks, toutesLesSponsorisations } from '@/lib/reseau/sponsorisation-db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/** Administration de la sponsorisation et des packs (§ 47 des écrans). */

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'sponsorisation.gerer'))) {
    return NextResponse.json({ error: 'Votre rôle ne donne pas accès à la sponsorisation.' }, { status: 403 });
  }
  return NextResponse.json({
    packs: await listerPacks(false),
    sponsorisations: await toutesLesSponsorisations(),
  });
}

export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'sponsorisation.gerer'))) {
    return NextResponse.json({ error: 'Votre rôle ne permet pas cette action.' }, { status: 403 });
  }

  const corps = await req.json().catch(() => ({}));

  // Paiement reçu : historique des paiements (/api/admin/paiements-recus).
  if (corps.action === 'paiement') {
    return NextResponse.json({ error: 'Les paiements reçus s’enregistrent désormais dans l’historique « Paiements reçus ».' }, { status: 410 });
  }

  if (typeof corps.sponsorisationId === 'string') {
    if (!['pending', 'active', 'paused', 'ended', 'rejected'].includes(corps.statut)) {
      return NextResponse.json({ error: 'Statut inconnu.' }, { status: 400 });
    }
    const resultat = await changerStatutSponsorisation(corps.sponsorisationId, corps.statut);
    if (!resultat.ok) return NextResponse.json({ error: resultat.erreur }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  // Mise à jour d'un pack : prix, quotas, durée — tout reste administrable,
  // exigence explicite du cahier des charges (§ 16).
  if (typeof corps.packId === 'string') {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
    const ligne: Record<string, unknown> = {};
    if (corps.prix != null) ligne.price = Math.max(0, Number(corps.prix) || 0);
    if (corps.partagesVises != null) ligne.shares_target = Math.max(0, Number(corps.partagesVises) || 0);
    if (corps.maxRevendeurs != null) ligne.max_resellers = Math.max(0, Number(corps.maxRevendeurs) || 0);
    if (corps.dureeJours != null) ligne.duration_days = Math.max(1, Number(corps.dureeJours) || 7);
    if (typeof corps.actif === 'boolean') ligne.active = corps.actif;
    if (Object.keys(ligne).length === 0) return NextResponse.json({ error: 'Rien à modifier.' }, { status: 400 });

    const { error } = await admin.from('sponsorship_plans').update(ligne).eq('id', corps.packId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
}
