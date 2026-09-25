import { NextRequest, NextResponse } from 'next/server';
import { verifyActiveSession } from '@/lib/active-session';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { preparerRemise } from '@/lib/remise-qr';

/**
 * Préparation d'une remise par QR, côté livreur (2026-09-25). La logique est
 * partagée avec le fournisseur qui remet lui-même : voir src/lib/remise-qr.ts.
 */
export async function POST(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'driver') return NextResponse.json({ error: 'Authentification livreur requise.' }, { status: 401 });

  const { orderId, qr } = await req.json().catch(() => ({}));
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const r = await preparerRemise(admin, session.uid, orderId, qr);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r.corps, { headers: { 'Cache-Control': 'no-store' } });
}
