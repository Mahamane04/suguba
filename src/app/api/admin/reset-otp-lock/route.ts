import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/** Débloque une commande verrouillée après 3 échecs OTP — admin uniquement. */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  }

  const { orderId } = await req.json().catch(() => ({}));
  if (!orderId) {
    return NextResponse.json({ error: 'Commande requise.' }, { status: 400 });
  }

  const { error } = await admin.from('orders').update({ failed_otp_attempts: 0 }).eq('id', orderId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
