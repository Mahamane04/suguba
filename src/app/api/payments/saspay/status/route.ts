import { NextRequest, NextResponse } from 'next/server';
import { verifierPayin } from '@/lib/saspay';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * État réel d'un encaissement, pour l'écran qui attend la validation du
 * client sur son téléphone (flux push, sans redirection).
 *
 * Le webhook reste le chemin normal de confirmation ; cette route existe
 * parce qu'un client qui vient de taper son code veut voir l'écran bouger
 * sans attendre. Elle ne fait donc pas que lire la base : elle redemande le
 * statut réel à SasPay, qui revalide lui-même auprès du gateway quand la
 * transaction est encore PENDING.
 *
 * Elle est publique (un client sans compte doit pouvoir suivre sa commande)
 * mais ne renvoie qu'un statut — jamais de montant, de nom ni de téléphone.
 */
export async function GET(req: NextRequest) {
  const orderNumber = req.nextUrl.searchParams.get('orderNumber');
  if (!orderNumber) {
    return NextResponse.json({ error: 'Numéro de commande requis.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  }

  const { data: commande } = await admin
    .from('orders')
    .select('order_number, status, payment_collected, payment_transaction_id')
    .eq('order_number', orderNumber.trim())
    .maybeSingle();

  if (!commande) {
    return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
  }
  if (commande.payment_collected) {
    return NextResponse.json({ statut: 'SUCCESS', paye: true });
  }
  if (!commande.payment_transaction_id) {
    return NextResponse.json({ statut: 'AUCUN', paye: false });
  }

  const verif = await verifierPayin(commande.payment_transaction_id);
  if (!verif.ok) {
    return NextResponse.json({ statut: 'PENDING', paye: false });
  }

  // Le webhook fait foi pour l'écriture, mais s'il tarde ou s'est perdu, la
  // commande resterait affichée « à payer » alors que l'argent est arrivé.
  // On rattrape ici, avec les mêmes gardes que le webhook.
  if (verif.statut === 'SUCCESS' && commande.status === 'pending_call') {
    await admin
      .from('orders')
      .update({ status: 'confirmed', payment_collected: true, payment_method: 'mobile_money' })
      .eq('order_number', commande.order_number)
      .eq('payment_collected', false);
  }

  return NextResponse.json({ statut: verif.statut || 'PENDING', paye: verif.statut === 'SUCCESS' });
}
