import { NextRequest, NextResponse } from 'next/server';
import {
  signatureWebhookValide,
  verifierPayin,
  verifierPayout,
  ENTETE_SIGNATURE,
  ENTETE_HORODATAGE,
  ENTETE_EVENT,
  type EventWebhook,
} from '@/lib/saspay';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Webhook SasPay — changements de statut des transactions.
 *
 * Deux garde-fous, indépendants l'un de l'autre :
 *
 *  1. **Signature HMAC-SHA256** sur `${timestamp}.${corps brut}`, plus un
 *     contrôle d'âge de 5 minutes. C'est un vrai progrès sur LigdiCash, qui
 *     ne signait rien du tout. Une requête non signée est rejetée en 403,
 *     pas « ignorée poliment » : accepter silencieusement laisserait un
 *     attaquant croire qu'il a marqué une commande payée.
 *
 *  2. **Re-vérification systématique** auprès de SasPay avant tout mouvement.
 *     Le corps du webhook n'est jamais la source de vérité, même signé : une
 *     signature valide prouve l'origine, pas que l'argent est arrivé.
 *
 * ── Rattachement à une commande ──────────────────────────────────────────
 * `data` ne contient PAS nos metadata — seulement l'id de transaction
 * SasPay. On retrouve donc la ligne par `payment_transaction_id`, écrit à
 * l'initiation (voir /api/payments/saspay/create et migration-saspay.sql).
 * Une commande dont l'initiation n'a pas été enregistrée est introuvable
 * ici : c'est pour cela que la route de création échoue plutôt que de
 * répondre OK quand l'écriture de l'id rate.
 *
 * Documentation : https://docs.saspay.me/api-reference/webhooks
 */

/** Retiré du corps brut pour que Next ne le reparse pas : la signature porte
 * sur le texte exact reçu, pas sur une re-sérialisation. */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const corpsBrut = await req.text();

  if (!signatureWebhookValide(
    corpsBrut,
    req.headers.get(ENTETE_SIGNATURE),
    req.headers.get(ENTETE_HORODATAGE),
  )) {
    console.warn('[WEBHOOK SASPAY] Signature invalide ou horodatage hors tolérance — rejeté.');
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 403 });
  }

  let event: EventWebhook;
  try {
    event = JSON.parse(corpsBrut);
  } catch {
    return NextResponse.json({ error: 'Corps illisible.' }, { status: 400 });
  }

  const type = event.event || req.headers.get(ENTETE_EVENT) || '';
  const idTransaction = String(event.data?.id || '').trim();

  // Event de test déclenché depuis le tableau de bord : rien à traiter, mais
  // répondre 200 pour que la vérification d'intégration passe au vert.
  if (type === 'webhook.test') {
    return NextResponse.json({ status: 'OK', test: true });
  }

  // On ne traite que les transactions. Les events settlement.* et
  // wallet_transfer.* concernent les mouvements du wallet SasPay lui-même,
  // pas les commandes Suguba — et la doc signale que la forme de leur `data`
  // n'est pas encore garantie.
  if (!type.startsWith('transaction.')) {
    return NextResponse.json({ status: 'OK', ignore: `event non traité: ${type}` });
  }
  if (!idTransaction) {
    return NextResponse.json({ status: 'OK', ignore: 'id de transaction absent' });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    // 503 : SasPay retentera (immédiat, +30s, +5min, +30min, +2h). Répondre
    // 200 ici perdrait définitivement la notification.
    console.error('[WEBHOOK SASPAY] Supabase indisponible — notification non traitée:', idTransaction);
    return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  }

  try {
    const { data: commande } = await admin
      .from('orders')
      .select('order_number, status, payment_collected')
      .eq('payment_transaction_id', idTransaction)
      .maybeSingle();

    if (commande) return await traiterCommande(admin, commande, idTransaction);

    const { data: retrait } = await admin
      .from('payouts')
      .select('id, status')
      .eq('payment_transaction_id', idTransaction)
      .maybeSingle();

    if (retrait) return await traiterRetrait(admin, retrait, idTransaction);

    console.warn('[WEBHOOK SASPAY] Transaction rattachée à aucune ligne:', idTransaction, type);
    return NextResponse.json({ status: 'OK', ignore: 'transaction inconnue' });
  } catch (error: any) {
    console.error('[WEBHOOK SASPAY] Erreur de traitement:', error);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

async function traiterCommande(
  admin: any,
  commande: { order_number: string; status: string; payment_collected: boolean },
  idTransaction: string,
) {
  if (commande.payment_collected) {
    return NextResponse.json({ status: 'OK', ignore: 'déjà encaissée' });
  }

  const verif = await verifierPayin(idTransaction);
  if (!verif.ok) {
    // Vérification impossible : ne rien décider. Un 503 fait retenter SasPay.
    console.error('[WEBHOOK SASPAY] Vérification impossible pour', commande.order_number, verif.erreur);
    return NextResponse.json({ error: 'Vérification impossible.' }, { status: 503 });
  }
  if (verif.statut !== 'SUCCESS') {
    return NextResponse.json({ status: 'OK', ignore: `statut vérifié: ${verif.statut}` });
  }

  const { error } = await admin
    .from('orders')
    .update({
      status: commande.status === 'pending_call' ? 'confirmed' : commande.status,
      // Indispensable : sans ce marquage, la commande reste vue comme un
      // paiement à la livraison et le livreur réclamerait au client une
      // somme déjà réglée par mobile money.
      payment_collected: true,
      payment_method: 'mobile_money',
    })
    .eq('order_number', commande.order_number)
    // Garde d'idempotence : SasPay peut livrer le même event plusieurs fois
    // (5 tentatives, plus un renvoi manuel possible depuis le dashboard).
    .eq('payment_collected', false);

  if (error) {
    console.error('[WEBHOOK SASPAY] Écriture commande échouée:', commande.order_number, error);
    return NextResponse.json({ error: 'Écriture échouée.' }, { status: 503 });
  }

  return NextResponse.json({ status: 'OK', traite: 'commande' });
}

async function traiterRetrait(
  admin: any,
  retrait: { id: string; status: string },
  idTransaction: string,
) {
  if (retrait.status !== 'pending' && retrait.status !== 'processing') {
    return NextResponse.json({ status: 'OK', ignore: 'déjà traité' });
  }

  const verif = await verifierPayout(idTransaction);
  if (!verif.ok) {
    console.error('[WEBHOOK SASPAY] Vérification versement impossible:', retrait.id, verif.erreur);
    return NextResponse.json({ error: 'Vérification impossible.' }, { status: 503 });
  }

  if (verif.statut === 'SUCCESS') {
    const { error } = await admin
      .from('payouts')
      .update({
        status: 'completed',
        transaction_ref: verif.reference || idTransaction,
        processed_at: new Date().toISOString(),
      })
      .eq('id', retrait.id)
      .in('status', ['pending', 'processing']);

    if (error) {
      console.error('[WEBHOOK SASPAY] Écriture versement échouée:', retrait.id, error);
      return NextResponse.json({ error: 'Écriture échouée.' }, { status: 503 });
    }

    // Les commissions réservées à la création du retrait sont maintenant
    // définitivement consommées.
    await admin.rpc('settle_commissions_for_withdrawal', { p_withdrawal_id: retrait.id });
    return NextResponse.json({ status: 'OK', traite: 'versement' });
  }

  if (verif.statut === 'FAILED' || verif.statut === 'CANCELLED') {
    const { error } = await admin
      .from('payouts')
      // 'rejected' et non 'failed' : la contrainte CHECK de `payouts.status`
      // n'accepte que pending/processing/completed/rejected. Écrire une valeur
      // hors contrainte ferait échouer la mise à jour en silence — exactement
      // le piège déjà rencontré sur les statuts de commande.
      .update({ status: 'rejected' })
      .eq('id', retrait.id)
      .in('status', ['pending', 'processing']);

    if (error) {
      console.error('[WEBHOOK SASPAY] Écriture échec versement:', retrait.id, error);
      return NextResponse.json({ error: 'Écriture échouée.' }, { status: 503 });
    }

    // Le virement n'aura pas lieu : on rend son solde au revendeur plutôt
    // que de le laisser bloqué sur une réservation morte.
    await admin.rpc('release_commissions_for_withdrawal', { p_withdrawal_id: retrait.id });
    return NextResponse.json({ status: 'OK', traite: 'versement échoué' });
  }

  return NextResponse.json({ status: 'OK', ignore: `statut vérifié: ${verif.statut}` });
}
