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
    const { data: tentative, error: attemptError } = await admin.from('payment_attempts').select('order_number').eq('transaction_id', idTransaction).maybeSingle();
    if (attemptError) return NextResponse.json({ error: 'Rapprochement indisponible.' }, { status: 503 });
    let requete = admin.from('orders').select('order_number, status, payment_collected');
    requete = tentative ? requete.eq('order_number', tentative.order_number) : requete.eq('payment_transaction_id', idTransaction);
    const { data: commande, error: orderError } = await requete.maybeSingle();
    if (orderError) return NextResponse.json({ error: 'Rapprochement indisponible.' }, { status: 503 });
    if (commande) return await traiterCommande(admin, commande, idTransaction);

    const { data: retrait } = await admin
      .from('payouts')
      .select('id, status')
      .eq('payment_transaction_id', idTransaction)
      .maybeSingle();

    if (retrait) return await traiterRetrait(admin, retrait, idTransaction);

    console.warn('[WEBHOOK SASPAY] Transaction rattachée à aucune ligne:', idTransaction, type);
    return NextResponse.json({ error: 'Transaction en attente de rattachement.' }, { status: 503 });
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
  const verif = await verifierPayin(idTransaction);
  if (!verif.ok) {
    // Vérification impossible : ne rien décider. Un 503 fait retenter SasPay.
    console.error('[WEBHOOK SASPAY] Vérification impossible pour', commande.order_number, verif.erreur);
    return NextResponse.json({ error: 'Vérification impossible.' }, { status: 503 });
  }
  if (!verif.statut || verif.statut === 'PENDING') return NextResponse.json({ status: 'OK', ignore: 'paiement en cours' });
  const { error } = await admin.rpc('apply_verified_payment', {
    p_order_number: commande.order_number, p_transaction: idTransaction, p_status: verif.statut,
  });
  if (error) return NextResponse.json({ error: 'Rapprochement non enregistré.' }, { status: 503 });
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

  if (verif.statut === 'SUCCESS' || verif.statut === 'FAILED' || verif.statut === 'CANCELLED') {
    const { data, error } = await admin.rpc('finalize_payout_atomic', {
      p_id: retrait.id, p_status: verif.statut === 'SUCCESS' ? 'completed' : 'rejected',
      p_reference: verif.reference || idTransaction,
    });
    if (error || !data) return NextResponse.json({ error: 'Versement en attente de rapprochement.' }, { status: 503 });
    return NextResponse.json({ status: 'OK', traite: 'versement' });
  }
  return NextResponse.json({ status: 'OK', ignore: 'versement en cours' });
}
