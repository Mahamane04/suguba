import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ajouterPaiement, annulerPaiement, listerPaiements, PaiementError } from '@/lib/paiements-recus';

/**
 * Historique des paiements reçus (campagnes, sponsorisations) — 2026-09-26,
 * Protection Suguba lot 1.
 *
 * GET  ?cible=campagne|sponsorisation&id=…   → paiements, annulés compris
 * POST { action: 'ajouter', cible, cibleId, montant, reference, note }
 * POST { action: 'annuler', id, motif }
 */
export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/paiements-recus');
  if (refus) return refus;
  if (!(await sessionAvecRole(req, 'admin'))) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ paiements: [] });
  const cible = req.nextUrl.searchParams.get('cible');
  const id = req.nextUrl.searchParams.get('id') || '';
  if ((cible !== 'campagne' && cible !== 'sponsorisation') || !id) return NextResponse.json({ error: 'Cible inconnue.' }, { status: 400 });
  const par = await listerPaiements(admin, cible, [id]);
  return NextResponse.json({ paiements: par[id] || [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'POST /api/admin/paiements-recus');
  if (refus) return refus;
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  const corps = await req.json().catch(() => ({}));
  try {
    if (corps.action === 'ajouter') return NextResponse.json(await ajouterPaiement(admin, session.uid, corps));
    if (corps.action === 'annuler') return NextResponse.json(await annulerPaiement(admin, session.uid, corps));
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  } catch (e) {
    if (e instanceof PaiementError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Enregistrement impossible. Réessayez.' }, { status: 500 });
  }
}
