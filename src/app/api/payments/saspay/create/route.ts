import { NextRequest, NextResponse } from 'next/server';
import { initierPayin, estReseau, estReseauGlobal, RESEAUX_MALI, RESEAUX_GLOBAUX } from '@/lib/saspay';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Démarre un encaissement SasPay pour une commande existante.
 *
 * ⚠️ Le montant n'est JAMAIS lu depuis la requête : il est relu en base à
 * partir du seul numéro de commande. Accepter un montant fourni par le
 * navigateur laisserait n'importe qui régler 100 F une commande de 216 500 F.
 *
 * Deux issues possibles, dictées par SasPay et non par nous :
 *  - `urlCheckout` non vide → rediriger le client, aucun push ne partira
 *    (c'est le cas normal d'Orange Money) ;
 *  - `urlCheckout` absent  → une demande arrive sur le téléphone du client,
 *    l'écran doit sonder /api/payments/saspay/status.
 */
export async function POST(req: NextRequest) {
  try {
    const { orderNumber, network, phone } = await req.json().catch(() => ({}));

    if (!orderNumber || typeof orderNumber !== 'string') {
      return NextResponse.json({ error: 'Numéro de commande requis.' }, { status: 400 });
    }
    if (!estReseau(network)) {
      const acceptes = [...Object.values(RESEAUX_MALI), ...Object.values(RESEAUX_GLOBAUX)];
      return NextResponse.json(
        { error: `Réseau inconnu. Réseaux acceptés : ${acceptes.join(', ')}.` },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
    }

    const { data: commande } = await admin
      .from('orders')
      .select('order_number, product_name, quantity, total_amount, status, payment_collected, customer_name, customer_phone, payment_transaction_id')
      .eq('order_number', orderNumber.trim())
      .maybeSingle();

    if (!commande) {
      return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
    }

    // Ne jamais refacturer ce qui est déjà payé : un second paiement sur une
    // commande encaissée ferait payer le client deux fois.
    if (commande.payment_collected) {
      return NextResponse.json({ error: 'Cette commande est déjà payée.' }, { status: 409 });
    }
    if (commande.status === 'cancelled' || commande.status === 'returned') {
      return NextResponse.json({ error: 'Cette commande n\'est plus payable.' }, { status: 409 });
    }

    const montant = Number(commande.total_amount);
    if (!Number.isFinite(montant) || montant <= 0) {
      return NextResponse.json({ error: 'Montant de commande invalide.' }, { status: 422 });
    }

    // SasPay exige un téléphone client, y compris pour la carte et la crypto
    // où il n'est jamais utilisé. Celui saisi à l'écran prime (le payeur
    // n'est pas toujours le destinataire — cas de la diaspora), la commande
    // sert de repli.
    const telephone = (typeof phone === 'string' && phone.trim()) || commande.customer_phone;
    if (!telephone) {
      return NextResponse.json({ error: 'Numéro de téléphone du payeur requis.' }, { status: 400 });
    }

    const [prenom, ...resteNom] = String(commande.customer_name || 'Client Suguba').trim().split(/\s+/);

    const resultat = await initierPayin({
      montant,
      description: `Commande Suguba ${commande.order_number}`,
      reseau: network,
      client: {
        // SasPay exige un email ; les commandes Suguba n'en collectent pas.
        // Une adresse dérivée du numéro de commande reste rattachable et
        // n'expose aucune donnée personnelle inventée.
        email: `commande-${commande.order_number.toLowerCase()}@sugubaml.com`,
        prenom: prenom || 'Client',
        nom: resteNom.join(' ') || 'Suguba',
        telephone,
      },
      urlRetour: `https://app.sugubaml.com/order-success/${commande.order_number}`,
      // Une clé par commande : si le client double-clique ou si le réseau
      // coupe, SasPay renvoie le paiement d'origine au lieu d'en pousser un
      // second sur son téléphone.
      cleIdempotence: `order-${commande.order_number}-${network}`,
    });

    if (!resultat.ok || !resultat.id) {
      return NextResponse.json({ error: resultat.erreur || 'Paiement refusé.' }, { status: 502 });
    }

    // Écrit AVANT de répondre : sans cet id en base, le webhook de
    // confirmation n'aurait aucun moyen de retrouver la commande et le
    // paiement resterait invisible côté Suguba.
    const { error: majErr } = await admin
      .from('orders')
      .update({ payment_transaction_id: resultat.id, payment_network: network })
      .eq('order_number', commande.order_number);

    if (majErr) {
      console.error('[SASPAY] Paiement initié mais id non stocké:', commande.order_number, resultat.id, majErr);
      return NextResponse.json(
        { error: 'Paiement initié mais non enregistré. Contactez le support avant de payer.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      transactionId: resultat.id,
      statut: resultat.statut || 'PENDING',
      urlCheckout: resultat.urlCheckout || null,
      reseau: estReseauGlobal(network) ? RESEAUX_GLOBAUX[network] : RESEAUX_MALI[network],
    });
  } catch (error: any) {
    console.error('[SASPAY] Erreur création paiement:', error);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

