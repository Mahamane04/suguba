import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut } from '@/lib/reseau/db';
import { ecrireReglagesReseau, lireReglagesReseau } from '@/lib/reseau/recompenses';

/** Réglages du réseau (primes de parrainage) — § 51, sous-section Parrainage. */

export async function GET(req: NextRequest) {
  const refusEquipe = await refusSansPermissionAdmin(req, 'GET /api/admin/reseau-reglages');
  if (refusEquipe) return refusEquipe;
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  return NextResponse.json({ reglages: await lireReglagesReseau() });
}

export async function POST(req: NextRequest) {
  const refusEquipe = await refusSansPermissionAdmin(req, 'POST /api/admin/reseau-reglages');
  if (refusEquipe) return refusEquipe;
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'commission.configurer'))) {
    return NextResponse.json({ error: 'Votre rôle ne permet pas de modifier les primes.' }, { status: 403 });
  }
  const reglages = await ecrireReglagesReseau(await req.json().catch(() => ({})));
  if (!reglages) return NextResponse.json({ error: 'Enregistrement impossible (migration réseau V2 appliquée ?).' }, { status: 503 });
  return NextResponse.json({ reglages });
}
