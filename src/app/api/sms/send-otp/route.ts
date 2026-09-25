import { hasOrderReceiptAccess } from '@/lib/order-access';
import { verifyActiveSession } from '@/lib/active-session';
import { adminPeut } from '@/lib/reseau/db';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { NextRequest, NextResponse } from 'next/server';
import { smsGateway } from '@/lib/sms-gateway';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/** Le reçu autorise une demande d’envoi, jamais la lecture du secret.
 * Le destinataire et le contenu viennent exclusivement de la commande en base. */
export async function POST(req: NextRequest) {
  try {
    const { orderNumber, accessKey } = await req.json().catch(() => ({}));
    if (typeof orderNumber !== 'string' || !orderNumber.trim() || orderNumber.length > 100) {
      return NextResponse.json({ success: false, error: 'Numéro de commande requis.' }, { status: 400 });
    }
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Envoi indisponible. Votre commande reste enregistrée.' }, { status: 503 });
    const number = orderNumber.trim();
    const receipt = await hasOrderReceiptAccess(admin, number, accessKey);
    const session = receipt ? null : await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
    const support = session?.role === 'admin' && await adminPeut(session.uid, 'commande.modifier');
    if (!receipt && !support) return NextResponse.json({ success: false, error: 'Ouvrez votre reçu ou contactez Suguba pour demander le SMS.' }, { status: 403 });

    const { data: order, error } = await admin.from('orders')
      .select('order_number, product_name, customer_phone, delivery_otp, total_amount, status')
      .eq('order_number', number).maybeSingle();
    if (error) return NextResponse.json({ success: false, error: 'Envoi indisponible. Réessayez.' }, { status: 503 });
    if (!order || !['pending_call', 'confirmed', 'dispatched', 'in_transit'].includes(order.status) || !order.customer_phone || !order.delivery_otp) {
      return NextResponse.json({ success: false, error: 'Cette commande ne permet pas un nouvel envoi.' }, { status: 409 });
    }
    const { data: allowed, error: limitError } = await admin.rpc('claim_order_sms', { p_order_number: number });
    if (limitError) return NextResponse.json({ success: false, error: 'Envoi indisponible. Réessayez.' }, { status: 503 });
    if (!allowed) return NextResponse.json({ success: false, error: 'Attendez une minute entre deux demandes. Après trois tentatives, réessayez dans trente minutes.' }, { status: 429 });
    const current = await admin.from('orders').select('order_number,customer_phone,product_name,delivery_otp,total_amount').eq('order_number',number).maybeSingle();
    if (current.error || !current.data?.delivery_otp) return NextResponse.json({success:false,error:'Envoi indisponible. Réessayez.'},{status:503});
    const recipient = current.data;
    const result = await smsGateway.sendDeliveryOtpSms({
      toPhone: recipient.customer_phone, orderNumber: recipient.order_number,
      productName: recipient.product_name || 'Article Suguba', deliveryOtp: recipient.delivery_otp,
      totalAmount: Number(recipient.total_amount) || 0,
    });
    if (!result.success) return NextResponse.json({ success: false, error: 'Envoi non confirmé. Réessayez ou contactez Suguba ; la commande reste enregistrée.' }, { status: 503 });
    const confirmed = await admin.rpc('confirm_delivery_sms',{p_order_number:number,p_code:recipient.delivery_otp});
    if (confirmed.error || confirmed.data !== true) return NextResponse.json({success:false,error:'Transmission non confirmée dans le suivi. Réessayez ou contactez Suguba.'},{status:503});
    return NextResponse.json({ success: true });
  } catch {
    // Jamais d’erreur de transport pouvant contenir le SMS ou son destinataire.
    return NextResponse.json({ success: false, error: 'Envoi non confirmé. Réessayez.' }, { status: 503 });
  }
}
