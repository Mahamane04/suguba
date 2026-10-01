import { randomUUID } from 'node:crypto';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { verifyActiveSession } from '@/lib/active-session';
import { hasOrderReceiptAccess } from '@/lib/order-access';
import { NextRequest, NextResponse } from 'next/server';
import { initierPayin, estReseau, estReseauGlobal, RESEAUX_MALI, RESEAUX_GLOBAUX } from '@/lib/saspay';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerReglages } from '@/lib/platform-settings';
import { calculerFraisPaiement, completerFraisPaiement, type MoyenPaiementClient } from '@/lib/frais-paiement';

/**
 * Démarre un encaissement SasPay pour une commande existante.
 *
 * ⚠️ Le montant n'est JAMAIS lu depuis la requête : il est relu en base à
 * partir du seul numéro de commande. Accepter un montant fourni par le
 * navigateur laisserait n'importe qui régler 100 F une commande de 216 500 F.
 *
 * Frais de paiement (2026-09-27) : à la charge du client. Le montant demandé
 * à SasPay = commande + frais Suguba, retrait opérateur et fonds de soutien de
 * l'État ; SasPay ajoute lui-même ses propres frais (mode ADD_ON). Le détail
 * est gardé sur la tentative de paiement (payment_attempts.fees).
 *
 * Deux issues possibles, dictées par SasPay et non par nous :
 *  - `urlCheckout` non vide → rediriger le client, aucun push ne partira
 *    (c'est le cas normal d'Orange Money) ;
 *  - `urlCheckout` absent  → une demande arrive sur le téléphone du client,
 *    l'écran doit sonder /api/payments/saspay/status.
 */
export async function POST(req: NextRequest) {
  try {
    const { orderNumber, network, phone, accessKey } = await req.json().catch(() => ({}));

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

    // Tarifs SasPay enregistrés (tenus à jour en arrière-plan) : la même
    // source que l'écran du client, et jamais d'attente de SasPay ici.
    // Réglages illisibles : on refuse plutôt que de facturer des frais par défaut (2026-10-01).
    const etatReglages = await chargerReglages(true).catch(() => null);

    // Carte bancaire (C3) : refusée tant que l'admin ne l'a pas ouverte après un vrai paiement test
    // (y compris quand l'ouverture n'est pas vérifiable).
    if (estReseauGlobal(network) && network === 'card' && etatReglages?.reglages.paiementCarteVerifie !== true) {
      return NextResponse.json({ error: 'Le paiement par carte n’est pas encore ouvert. Votre proche peut payer à la réception.' }, { status: 409 });
    }
    if (!etatReglages) return NextResponse.json({ error: 'Paiement indisponible un instant. Réessayez.' }, { status: 503 });
    const { reglages } = etatReglages;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
    }

    const { data: commande } = await admin
      .from('orders')
      .select('order_number, product_name, quantity, total_amount, status, payment_collected, customer_name, customer_phone, payment_transaction_id, reseller_id')
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

    // Qui peut lancer le paiement (audit du 2026-10-01) : vers le numéro de la
    // commande, ou avec la clé secrète du reçu (payeur différent : un proche, la
    // diaspora), ou le revendeur de la commande / l'équipe. Avant, un simple
    // numéro de commande suffisait pour envoyer une demande de paiement vers
    // n'importe quel téléphone.
    const huitChiffres = (t: unknown) => String(t || '').replace(/\D/g, '').slice(-8);
    if (huitChiffres(telephone) !== huitChiffres(commande.customer_phone) && !(await hasOrderReceiptAccess(admin, commande.order_number, accessKey))) {
      const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
      const autorise = session && (session.role === 'admin' || (session.role === 'reseller' && session.uid === commande.reseller_id));
      if (!autorise) {
        return NextResponse.json({ error: 'Pour payer avec un autre numéro, ouvrez cette commande depuis votre reçu.' }, { status: 403 });
      }
    }

    const { data: tentative, error: reservationError } = await admin.rpc('begin_order_payment', {
      p_order_number: commande.order_number, p_network: network, p_phone: telephone, p_id: randomUUID(),
    });
    if (reservationError || !tentative) return NextResponse.json({ error: reservationError?.message === 'PAYMENT_ALREADY_PENDING'
      ? 'Un paiement est déjà en cours sur un autre réseau. Attendez son résultat avant de changer.'
      : 'Paiement non initié. Vérifiez le paiement précédent ou réessayez.' }, { status: reservationError?.message === 'PAYMENT_ALREADY_PENDING' ? 409 : 503 });
    if (tentative.transaction_id) return NextResponse.json({ success: true, transactionId: tentative.transaction_id,
      statut: tentative.status, urlCheckout: tentative.checkout_url || null,
      reseau: estReseauGlobal(network) ? RESEAUX_GLOBAUX[network] : RESEAUX_MALI[network] });

    // Frais à la charge du client, calculés sur les réglages ENREGISTRÉS : le
    // montant annoncé à l'écran est celui facturé.
    const frais = calculerFraisPaiement(montant, network as MoyenPaiementClient, completerFraisPaiement(reglages.fraisPaiement));
    // Trace de la tentative. Colonnes ajoutées par A-EXECUTER-2026-09-27-frais-paiement.sql :
    // tant qu'il n'est pas lancé, le paiement fonctionne, seule la trace manque.
    const { error: traceErr } = await admin.from('payment_attempts')
      .update({ amount_requested: frais.montantDemande, fees: frais })
      .eq('id', tentative.id);
    if (traceErr) console.warn('[SASPAY] Frais non tracés (SQL du 2026-09-27 à lancer ?):', traceErr.message);

    const [prenom, ...resteNom] = String(commande.customer_name || 'Client Suguba').trim().split(/\s+/);

    const resultat = await initierPayin({
      montant: frais.montantDemande,
      description: `Commande Suguba ${commande.order_number}`,
      reseau: network,
      client: {
        // SasPay exige un email ; les commandes Suguba n'en collectent pas.
        // Une adresse dérivée du numéro de commande reste rattachable et
        // n'expose aucune donnée personnelle inventée.
        email: `commande-${commande.order_number.toLowerCase()}@sugubaml.com`,
        prenom: prenom || 'Client',
        nom: resteNom.join(' ') || 'Suguba',
        telephone: tentative.phone,
      },
      urlRetour: `https://app.sugubaml.com/order-success/${commande.order_number}`,
      // Une clé par commande : si le client double-clique ou si le réseau
      // coupe, SasPay renvoie le paiement d'origine au lieu d'en pousser un
      // second sur son téléphone.
      cleIdempotence: `order-attempt-${tentative.id}`,
    });

    if (!resultat.ok || !resultat.id) {
      return NextResponse.json({ error: resultat.erreur || 'Paiement refusé.' }, { status: 502 });
    }

    // Écrit AVANT de répondre : sans cet id en base, le webhook de
    // confirmation n'aurait aucun moyen de retrouver la commande et le
    // paiement resterait invisible côté Suguba.
    const { error: majErr } = await admin.rpc('record_order_payment', {
      p_id: tentative.id, p_transaction: resultat.id, p_checkout: resultat.urlCheckout || null,
    });

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
      montantTotal: frais.totalClient,
      frais: frais.lignes,
    });
  } catch (error: any) {
    console.error('[SASPAY] Erreur création paiement:', error);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

