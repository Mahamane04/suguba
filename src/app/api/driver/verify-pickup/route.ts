import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Ramassage chez le fournisseur (2026-09-24).
 *
 * Le trou noir signalé : une course passait de « À récupérer » à « Livrée »
 * sans que rien n'atteste que le colis avait quitté le dépôt. Désormais le
 * fournisseur voit un code à 4 chiffres (page Commandes de son espace) et le
 * livreur le saisit ici en prenant le colis : la commande passe « en cours de
 * livraison » avec l'heure du ramassage. Le code du client, lui, n'est
 * accepté qu'après (voir verify-delivery-otp).
 *
 * Même principe que le code de livraison : un livreur ne peut pas valider seul
 * un ramassage qui n'a pas eu lieu, et 5 codes faux bloquent la commande.
 */
export async function POST(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'driver') {
    return NextResponse.json({ error: 'Authentification livreur requise.' }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const { orderId, code } = await req.json().catch(() => ({}));
  if (typeof orderId !== 'string' || typeof code !== 'string' || !/^\d{4}$/.test(code.trim())) {
    return NextResponse.json({ error: 'Saisissez le code à 4 chiffres donné par le fournisseur.' }, { status: 400 });
  }

  const { data, error } = await admin.rpc('verify_pickup_atomic', { p_order_id: orderId, p_driver_id: session.uid, p_code: code.trim() });
  if (error || !data) return NextResponse.json({ error: 'Ramassage non confirmé. Réessayez.' }, { status: 503 });
  if (data.error) return NextResponse.json({ error: data.error }, { status: data.http || 409 });
  return NextResponse.json(data);
}
