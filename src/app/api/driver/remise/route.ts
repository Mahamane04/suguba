import { NextRequest, NextResponse } from 'next/server';
import { verifyActiveSession } from '@/lib/active-session';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { lireQrRemise } from '@/lib/qr-remise';

/**
 * Préparation d'une remise par QR (2026-09-25).
 *
 * Le scan NE livre PAS la commande : il vérifie la preuve et renvoie au
 * livreur ce qu'il s'apprête à remettre (articles, paiement). La livraison
 * n'est enregistrée qu'ensuite, quand il appuie sur « Confirmer la remise »,
 * par /api/driver/verify-delivery-otp (verify_delivery_atomic) — la même voie
 * que la saisie du code, donc mêmes protections : 3 essais partagés,
 * livreur assigné, ramassage confirmé, aucun double traitement.
 *
 * Aucun code n'est renvoyé : le livreur l'a lu sur le téléphone du client.
 */

const COLONNES = 'id, order_number, cart_id, pricing_snapshot, assigned_driver_id, status, picked_up_at, delivery_otp, failed_otp_attempts, payment_method, payment_collected, product_name, quantity, total_amount';

type Ligne = Record<string, any>;
const cleLivraison = (o: Ligne) => {
  const groupe = o.pricing_snapshot?.panier?.groupeLivraison;
  return o.cart_id && groupe != null ? `${o.cart_id}:${groupe}` : String(o.id);
};

export async function POST(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'driver') return NextResponse.json({ error: 'Authentification livreur requise.' }, { status: 401 });

  const { orderId, qr } = await req.json().catch(() => ({}));
  const lu = lireQrRemise(qr);
  if (typeof orderId !== 'string' || !orderId) return NextResponse.json({ error: 'Course manquante.' }, { status: 400 });
  if (!lu) return NextResponse.json({ error: 'Ce QR n’est pas un reçu de remise Suguba.' }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const [{ data: course, error: e1 }, { data: scannee, error: e2 }] = await Promise.all([
    admin.from('orders').select(COLONNES).eq('id', orderId).maybeSingle(),
    admin.from('orders').select(COLONNES).eq('order_number', lu.orderNumber).maybeSingle(),
  ]);
  if (e1 || e2) return NextResponse.json({ error: 'Base indisponible. Réessayez.' }, { status: 503 });
  if (!course) return NextResponse.json({ error: 'Course introuvable.' }, { status: 404 });
  if (course.assigned_driver_id !== session.uid) return NextResponse.json({ error: 'Cette commande ne vous est pas assignée.' }, { status: 403 });
  if (!scannee || cleLivraison(scannee) !== cleLivraison(course)) {
    return NextResponse.json({ error: `Ce QR correspond à une autre commande (#${lu.orderNumber}). Vérifiez que c’est le bon client.` }, { status: 409 });
  }
  if (course.status === 'delivered') return NextResponse.json({ error: 'Cette commande est déjà livrée.' }, { status: 409 });
  if (Number(course.failed_otp_attempts) >= 3) return NextResponse.json({ error: 'Commande bloquée après trois essais. Contactez Suguba.' }, { status: 423 });

  if (course.delivery_otp !== lu.code) {
    // Code faux (ancien reçu, QR régénéré…) : compté comme un essai raté,
    // exactement comme une saisie manuelle erronée.
    const { data } = await admin.rpc('verify_delivery_atomic', { p_order_id: course.id, p_driver_id: session.uid, p_code: lu.code });
    const r = (data || {}) as { error?: string; http?: number };
    return NextResponse.json({ error: r.error || 'Ce QR n’est plus valable. Demandez au client de rouvrir son reçu.' }, { status: r.http || 400 });
  }

  // Tous les articles de cette livraison assignés à ce livreur.
  let lignes: Ligne[] = [course];
  if (course.cart_id) {
    const { data } = await admin.from('orders').select(COLONNES).eq('cart_id', course.cart_id).eq('assigned_driver_id', session.uid);
    const memes = (data || []).filter((o) => cleLivraison(o) === cleLivraison(course));
    if (memes.length) lignes = memes;
  }

  return NextResponse.json({
    orderNumber: lu.orderNumber,
    commandes: lignes
      .filter((o) => !['cancelled', 'returned'].includes(o.status))
      .map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        productName: o.product_name,
        quantity: Number(o.quantity) || 1,
        totalAmount: Math.round(Number(o.total_amount) || 0),
        status: o.status,
        pretARemettre: o.status === 'in_transit' && Boolean(o.picked_up_at),
        payeEnLigne: o.payment_method === 'mobile_money' && Boolean(o.payment_collected),
      })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
