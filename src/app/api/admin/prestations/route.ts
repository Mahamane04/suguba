import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { EtapeError, liensPhotosEtape, listerEtapesAdmin, trancherEtape } from '@/lib/etapes';

/**
 * Prestations à étapes — suivi admin (2026-09-26, lot 1c) : parcours en
 * cours, contestations des clients, étapes sans réponse. L'admin tranche une
 * contestation (valide après appel, ou fait refaire l'étape), toujours avec
 * une raison écrite.
 */
async function exigerAdmin(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  return session && session.role === 'admin' ? session : null;
}

export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/prestations');
  if (refus) return refus;
  if (!(await exigerAdmin(req))) return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ prestations: [], migrationRequise: false });
  try {
    // Photos d'une étape : liens temporaires (10 min), à la demande.
    const orderId = req.nextUrl.searchParams.get('photos');
    if (orderId) {
      const position = Number(req.nextUrl.searchParams.get('position'));
      return NextResponse.json({ liens: await liensPhotosEtape(admin, orderId, position) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(await listerEtapesAdmin(admin), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const err = e as EtapeError;
    return NextResponse.json({ error: err.message || 'Lecture impossible.' }, { status: err.status || 500 });
  }
}

export async function POST(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'POST /api/admin/prestations');
  if (refus) return refus;
  if (!(await exigerAdmin(req))) return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  const corps = await req.json().catch(() => ({}));
  try {
    return NextResponse.json({ etape: await trancherEtape(admin, corps) });
  } catch (e) {
    const err = e as EtapeError;
    return NextResponse.json({ error: err.message || 'Action impossible.' }, { status: err.status || 500 });
  }
}
