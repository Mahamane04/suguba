import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { liensPhotosTicket } from '@/lib/sav-photos';

/**
 * Photos jointes par le client à une demande SAV (2026-09-25) : liens signés
 * valables dix minutes, jamais d'URL publique. Même permission que la lecture
 * des tickets.
 */
export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/sav/photos');
  if (refus) return refus;
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });

  const ticketId = req.nextUrl.searchParams.get('ticketId') || '';
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ photos: [] });
  return NextResponse.json({ photos: await liensPhotosTicket(admin, ticketId) }, { headers: { 'Cache-Control': 'no-store' } });
}
