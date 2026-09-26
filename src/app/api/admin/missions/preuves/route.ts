import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { deciderPreuve, PreuveError, preuvesAVerifier } from '@/lib/reseau/preuves-missions';

/** Preuves de publication à vérifier (2026-09-26, lot 2a). */
export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/missions/preuves');
  if (refus) return refus;
  if (!(await sessionAvecRole(req, 'admin'))) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ preuves: [], migrationRequise: false });
  try {
    return NextResponse.json(await preuvesAVerifier(admin), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const err = e as PreuveError;
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}

export async function POST(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'POST /api/admin/missions/preuves');
  if (refus) return refus;
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  try {
    return NextResponse.json(await deciderPreuve(admin, session.uid, await req.json().catch(() => ({}))));
  } catch (e) {
    const err = e as PreuveError;
    return NextResponse.json({ error: err.message || 'Action impossible.' }, { status: err.status || 500 });
  }
}
