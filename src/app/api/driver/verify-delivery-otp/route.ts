import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const MAX_ATTEMPTS = 3;

/**
 * Validation de la livraison par code secret — entièrement côté serveur.
 *
 * Avant ce correctif (2026-08-26), `/api/orders/feed` renvoyait
 * `delivery_otp` en clair pour TOUTES les commandes à tout livreur connecté,
 * et la comparaison se faisait dans le navigateur (sugubaStore.verifyDeliveryOtp)
 * — n'importe quel livreur pouvait donc lire le code d'une commande qui ne
 * lui était pas assignée et la valider frauduleusement (livraison + paiement
 * marqués faits sans rien livrer). Cette route est désormais la SEULE
 * source de vérité : le code n'est plus jamais envoyé au client, la
 * comparaison et le compteur d'essais vivent en base.
 */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'driver') {
    return NextResponse.json({ error: 'Authentification livreur requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  }

  try {
    const { orderId, code } = await req.json().catch(() => ({}));
    if (!orderId || !code) {
      return NextResponse.json({ error: 'Commande et code requis.' }, { status: 400 });
    }

    const { data: order } = await admin
      .from('orders')
      .select('id, status, delivery_otp, failed_otp_attempts, assigned_driver_id, payment_method, order_number')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
    }
    // Un livreur ne peut valider que SES courses — sans cette vérification,
    // n'importe quel livreur pourrait deviner un id de commande et la
    // marquer livrée à la place du livreur réellement assigné.
    if (order.assigned_driver_id !== session.uid) {
      return NextResponse.json({ error: 'Cette commande ne vous est pas assignée.' }, { status: 403 });
    }
    if (order.status === 'delivered') {
      return NextResponse.json({ error: 'Cette commande est déjà marquée livrée.' }, { status: 409 });
    }
    if (!['dispatched', 'in_transit'].includes(order.status)) {
      return NextResponse.json({ error: 'Cette commande n\'est pas prête pour la livraison.' }, { status: 409 });
    }

    const attempts = order.failed_otp_attempts || 0;
    if (attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Commande bloquée après 3 tentatives erronées. Contactez Suguba Ops pour débloquer.' },
        { status: 423 }
      );
    }

    if (String(order.delivery_otp || '').trim() !== String(code).trim()) {
      const nextAttempts = attempts + 1;
      await admin.from('orders').update({ failed_otp_attempts: nextAttempts }).eq('id', orderId);
      const remaining = Math.max(0, MAX_ATTEMPTS - nextAttempts);
      return NextResponse.json({
        error: remaining > 0
          ? `Code incorrect. Il vous reste ${remaining} tentative(s).`
          : 'Code incorrect. Commande bloquée pour sécurité.',
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    await admin.from('orders').update({
      status: 'delivered',
      payment_collected: true,
      failed_otp_attempts: 0,
      delivered_at: now,
    }).eq('id', orderId);

    // Même règle que /api/orders/sync : la commission ne devient réclamable
    // qu'à la livraison effective, jamais avant.
    await admin
      .from('commissions')
      .update({ status: 'available', available_at: now })
      .eq('order_id', orderId)
      .eq('status', 'pending');

    return NextResponse.json({ success: true, orderNumber: order.order_number });
  } catch (error: any) {
    console.error('[API driver/verify-delivery-otp ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
