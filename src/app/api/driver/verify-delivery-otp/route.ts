import { NextRequest, NextResponse } from 'next/server';
import { verifyActiveSession } from '@/lib/active-session';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/** REQ-010 / TASK-AUD-S2 : preuve, compteur et grand-livre dans une transaction. */
export async function POST(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'driver') return NextResponse.json({ error: 'Authentification livreur requise.' }, { status: 401 });
  const { orderId, code } = await req.json().catch(() => ({}));
  if (typeof orderId !== 'string' || typeof code !== 'string' || !/^\d{4}$/.test(code)) return NextResponse.json({ error: 'Commande et code à quatre chiffres requis.' }, { status: 400 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  const { data, error } = await admin.rpc('verify_delivery_atomic', { p_order_id: orderId, p_driver_id: session.uid, p_code: code });
  if (error || !data) return NextResponse.json({ error: 'Livraison non confirmée. Réessayez avec le même code.' }, { status: 503 });
  return NextResponse.json(data.error ? { error: data.error } : data, { status: data.http || 200 });
}
