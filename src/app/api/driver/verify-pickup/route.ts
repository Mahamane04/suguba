import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const MAX_ESSAIS = 5;

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
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'driver') {
    return NextResponse.json({ error: 'Authentification livreur requise.' }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const { orderId, code } = await req.json().catch(() => ({}));
  if (typeof orderId !== 'string' || typeof code !== 'string' || !/^\d{4}$/.test(code.trim())) {
    return NextResponse.json({ error: 'Saisissez le code à 4 chiffres donné par le fournisseur.' }, { status: 400 });
  }

  const { data: order, error } = await admin.from('orders')
    .select('id, status, assigned_driver_id, pickup_code, picked_up_at, failed_pickup_attempts, order_number')
    .eq('id', orderId).maybeSingle();
  if (error) {
    if (error.code === '42703') {
      return NextResponse.json({ error: 'Le ramassage par code n’est pas encore activé (mise à jour de la base à faire).' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Lecture de la commande impossible.' }, { status: 500 });
  }
  if (!order) return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
  if (order.assigned_driver_id !== session.uid) {
    return NextResponse.json({ error: 'Cette commande ne vous est pas assignée.' }, { status: 403 });
  }
  if (order.picked_up_at) {
    return NextResponse.json({ success: true, dejaFait: true, pickedUpAt: order.picked_up_at });
  }
  if (order.status !== 'dispatched') {
    return NextResponse.json({ error: 'Cette commande n’est pas en attente de ramassage.' }, { status: 409 });
  }

  const essais = Number(order.failed_pickup_attempts) || 0;
  if (essais >= MAX_ESSAIS) {
    return NextResponse.json({ error: 'Commande bloquée après 5 codes erronés. Contactez Suguba pour débloquer.' }, { status: 423 });
  }
  if (String(order.pickup_code || '').trim() !== code.trim()) {
    const suivants = essais + 1;
    await admin.from('orders').update({ failed_pickup_attempts: suivants }).eq('id', orderId);
    const reste = Math.max(0, MAX_ESSAIS - suivants);
    return NextResponse.json({
      error: reste > 0 ? `Code incorrect. Demandez-le au fournisseur (${reste} essai(s) restant(s)).` : 'Code incorrect. Commande bloquée pour sécurité.',
    }, { status: 400 });
  }

  const maintenant = new Date().toISOString();
  const { error: majErr } = await admin.from('orders')
    .update({ status: 'in_transit', picked_up_at: maintenant, failed_pickup_attempts: 0 })
    .eq('id', orderId).eq('status', 'dispatched');
  if (majErr) return NextResponse.json({ error: 'Enregistrement impossible, réessayez.' }, { status: 500 });
  return NextResponse.json({ success: true, pickedUpAt: maintenant, orderNumber: order.order_number });
}
