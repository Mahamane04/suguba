import { NextRequest, NextResponse } from 'next/server';
import { hasOrderReceiptAccess } from '@/lib/order-access';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const ACTIVES = ['pending_call', 'confirmed', 'dispatched', 'in_transit'];

/**
 * Code de remise affiché DANS L'APPLICATION (2026-09-25, choix du fondateur) :
 * Suguba n'a pas de service SMS branché, et le lot d'audit n'acceptait une
 * livraison qu'après un envoi SMS confirmé — aucune livraison n'aurait pu
 * être validée.
 *
 * Seul l'appareil qui a passé la commande (il détient la clé secrète du reçu)
 * obtient le code. Les suivis publics, feeds, exports et l'équipe support ne
 * le reçoivent toujours pas. La transmission est enregistrée avec les mêmes
 * fonctions SQL que l'envoi SMS : `claim_order_sms` remplace un code d'avant
 * l'audit par un code neuf versionné, `confirm_delivery_sms` note la date de
 * transmission, condition que vérifie `verify_delivery_atomic`.
 *
 * Limite assumée : pour une vente saisie par un revendeur (« + Vente »), c'est
 * le revendeur qui détient le reçu, donc le code, et qui le transmet au client.
 */
export async function POST(req: NextRequest) {
  const { orderNumber, accessKey } = await req.json().catch(() => ({}));
  if (typeof orderNumber !== 'string' || !orderNumber.trim() || orderNumber.length > 100) {
    return NextResponse.json({ error: 'Numéro de commande requis.' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible. Réessayez.' }, { status: 503 });
  const numero = orderNumber.trim();
  if (!(await hasOrderReceiptAccess(admin, numero, accessKey))) {
    return NextResponse.json({ error: 'Le code s’affiche sur l’appareil qui a passé la commande. Sinon, contactez Suguba.' }, { status: 403 });
  }

  const lire = () => admin.from('orders')
    .select('status, delivery_otp, delivery_code_version, delivery_code_sent_at')
    .eq('order_number', numero).maybeSingle();

  let { data: commande, error } = await lire();
  if (error) return NextResponse.json({ error: 'Service indisponible. Réessayez.' }, { status: 503 });
  if (!commande || !ACTIVES.includes(commande.status)) {
    return NextResponse.json({ error: 'Cette commande n’attend plus de remise.' }, { status: 409 });
  }

  if (!(Number(commande.delivery_code_version) >= 1 && commande.delivery_code_sent_at)) {
    if (!(Number(commande.delivery_code_version) >= 1)) {
      const { error: claimErr } = await admin.rpc('claim_order_sms', { p_order_number: numero });
      if (claimErr) return NextResponse.json({ error: 'Service indisponible. Réessayez.' }, { status: 503 });
      ({ data: commande, error } = await lire());
      if (error || !commande) return NextResponse.json({ error: 'Service indisponible. Réessayez.' }, { status: 503 });
      if (!(Number(commande.delivery_code_version) >= 1)) {
        return NextResponse.json({ error: 'Réessayez dans une minute.' }, { status: 429 });
      }
    }
    const { data: note, error: noteErr } = await admin.rpc('confirm_delivery_sms', {
      p_order_number: numero, p_code: commande.delivery_otp,
    });
    if (noteErr || note !== true) return NextResponse.json({ error: 'Service indisponible. Réessayez.' }, { status: 503 });
  }

  return NextResponse.json({ code: commande.delivery_otp }, { headers: { 'Cache-Control': 'no-store' } });
}
