import { verifyActiveSession } from '@/lib/active-session';
import { exigerValidation, marquerExecutee } from '@/lib/admin/securite';
import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { initierPayout, RESEAUX_MALI, type ReseauMali } from '@/lib/saspay';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Déclenche le versement d'un retrait via SasPay : commission d'un revendeur,
 * ou montant dû à un fournisseur (lot C, 2026-09-27).
 *
 * ── Ce qui a changé en migrant depuis momo-gateway (CinetPay) ────────────
 * L'ancienne passerelle basculait en « mode simulation » dès qu'aucune clé
 * n'était configurée : elle renvoyait `success: true` avec un faux numéro de
 * transaction, et cette route marquait alors le retrait `completed` et
 * consommait les commissions — sans qu'un centime ait bougé. Un revendeur
 * voyait son solde débité et son retrait « payé » pour rien.
 *
 * Deux principes ici, en réponse directe :
 *  1. **Aucun mode dégradé.** Sans clé SasPay, la route échoue franchement.
 *  2. **Le succès ne s'auto-proclame pas.** `POST /payouts/initialize/`
 *     renvoie un versement `PENDING`, jamais exécuté à ce stade. On passe
 *     donc en `processing` et on attend le webhook `transaction.success`
 *     (voir /api/webhooks/saspay) pour écrire `completed` et consommer les
 *     commissions. Un échec y libère la réservation.
 */

/** `payouts.payment_method` (contrainte CHECK) → code réseau SasPay. */
const RESEAU_PAR_METHODE: Record<string, ReseauMali> = {
  orange_money: 'orange_ml',
  moov: 'moov_ml',
  // Wave : versement SasPay disponible au Mali depuis le 2026-09-20.
  wave: 'wave_ml',
};

export async function POST(req: NextRequest) {
  const refusEquipe = await refusSansPermissionAdmin(req, 'POST /api/payouts/initiate');
  if (refusEquipe) return refusEquipe;
  try {
    // Défense en profondeur : le middleware protège déjà cette route
    // (BUG-005), mais on revérifie ici au cas où le matcher du middleware
    // serait un jour mal configuré — un endpoint qui déclenche un virement
    // réel ne doit jamais dépendre d'une seule couche de protection.
    const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
    }

    const { withdrawalId } = await req.json().catch(() => ({}));
    if (!withdrawalId) {
      return NextResponse.json({ error: 'Identifiant de retrait requis.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
    }

    const { data: withdrawal, error: fetchErr } = await admin
      .from('payouts')
      // Toutes les colonnes : `beneficiaire` (lot C) n'existe qu'une fois son SQL exécuté.
      .select('*')
      .eq('id', withdrawalId)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!withdrawal) {
      return NextResponse.json({ error: 'Demande de retrait introuvable.' }, { status: 404 });
    }
    if (!['pending', 'processing'].includes(withdrawal.status)) {
      return NextResponse.json({ error: 'Ce retrait a déjà été traité.' }, { status: 400 });
    }

    // Retrait en agence : l'argent est remis en main propre, il n'y a aucun
    // virement à déclencher. Le marquer ici éviterait de confondre « payé en
    // espèces » et « viré par mobile money ».
    if (withdrawal.payment_method === 'cash') {
      return NextResponse.json(
        { error: 'Retrait en agence : à régler en espèces, puis à marquer payé manuellement.' },
        { status: 422 },
      );
    }

    const reseau = RESEAU_PAR_METHODE[withdrawal.payment_method];
    if (!reseau) {
      // Cas concret : `mobi_cash`, retiré de Suguba. Envoyer un code réseau
      // non accepté ferait un 422 côté SasPay : mieux vaut le dire.
      return NextResponse.json(
        {
          error: `SasPay ne prend pas en charge « ${withdrawal.payment_method} » au Mali. `
            + `Réseaux disponibles : ${Object.values(RESEAUX_MALI).join(', ')}. `
            + `Demandez au bénéficiaire un numéro sur l'un de ces réseaux.`,
        },
        { status: 422 },
      );
    }

    const montant = Number(withdrawal.amount);
    if (!Number.isFinite(montant) || montant <= 0) {
      return NextResponse.json({ error: 'Montant de retrait invalide.' }, { status: 422 });
    }

    // Double validation (A3) : au-dessus du seuil, un AUTRE membre doit avoir
    // approuvé exactement ce retrait (montant et bénéficiaire).
    const validation = withdrawal.status === 'pending'
      ? await exigerValidation(admin, {
        type: 'retrait', dossier: `retrait:${withdrawal.id}`, montant,
        resume: { beneficiaire: withdrawal.reseller_name || null, telephone: withdrawal.phone_number || null, methode: withdrawal.payment_method },
        demandeurId: session.uid,
      })
      : { ok: true as const, validationId: null };
    if (!validation.ok) return NextResponse.json(validation.corps, { status: validation.status });

    // Réserve vérifiée et passage en processing avant l'appel. Les reprises
    // utilisent la même clé prestataire, y compris après une réponse perdue.
    const { data: verrouille, error: lockError } = await admin.rpc('begin_payout_transfer', { p_id: withdrawal.id });
    if (lockError || !verrouille) return NextResponse.json({ error: 'Versement non initié. Vérifiez le retrait et sa réserve.' }, { status: 409 });
    if (verrouille.payment_transaction_id) return NextResponse.json({ success: true, statut: 'processing', transactionId: verrouille.payment_transaction_id });
    await marquerExecutee(admin, validation.validationId);

    // Lot C (2026-09-27) : le même virement paie aussi un fournisseur.
    const fournisseur = withdrawal.beneficiaire === 'fournisseur';
    const [prenom, ...resteNom] = String(withdrawal.reseller_name || (fournisseur ? 'Fournisseur Suguba' : 'Revendeur Suguba')).trim().split(/\s+/);

    const resultat = await initierPayout({
      montant,
      description: `${fournisseur ? 'Paiement fournisseur' : 'Commission'} Suguba — retrait ${withdrawal.id}`,
      reseau,
      msisdn: withdrawal.phone_number,
      beneficiaire: {
        prenom: prenom || (fournisseur ? 'Fournisseur' : 'Revendeur'),
        nom: resteNom.join(' ') || 'Suguba',
        telephone: withdrawal.phone_number,
      },
      // Une clé par retrait : un retry réseau ne doit jamais provoquer un
      // second virement réel vers le même revendeur.
      cleIdempotence: `payout-${withdrawal.id}`,
    });

    if (!resultat.ok || !resultat.id) {
      // Refus net de SasPay (4xx : numéro invalide, solde du compte vide…) : aucun
      // virement n'existe, le retrait est refusé et le montant revient au solde du
      // bénéficiaire — sinon il restait « en cours » pour toujours (FIN-05, 2026-10-01).
      if (resultat.definitif) {
        const { error: refusErr } = await admin.rpc('finalize_payout_atomic', { p_id: withdrawal.id, p_status: 'rejected', p_reference: `REFUS SASPAY ${resultat.code || ''}`.trim() });
        if (!refusErr) {
          return NextResponse.json({ success: false, error: `SasPay a refusé ce versement : ${resultat.erreur || 'refus'}. Le montant est revenu sur le solde du bénéficiaire.` }, { status: 422 });
        }
      }
      // Résultat incertain : garder la réserve et reprendre avec la même clé prestataire.
      return NextResponse.json({ success: false, error: resultat.erreur || 'Versement refusé.' }, { status: 502 });
    }

    // Sans cet id en base, le webhook ne pourra pas rattacher la confirmation
    // au retrait — et un virement réellement exécuté resterait éternellement
    // en `processing`. On le journalise bruyamment si l'écriture rate.
    const { error: majErr } = await admin
      .from('payouts')
      .update({ payment_transaction_id: resultat.id, payment_network: reseau })
      .eq('id', withdrawal.id);

    if (majErr) {
      console.error('[SASPAY] Référence de versement non enregistrée, rapprochement requis.');
      return NextResponse.json({ success: false, error: 'Confirmation non enregistrée. Reprenez ce même retrait.' }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      transactionId: resultat.id,
      statut: 'processing',
      message: 'Versement transmis à SasPay. Le retrait sera marqué payé à la confirmation du réseau.',
    });
  } catch (error: any) {
    console.error('[SASPAY] Erreur versement:', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
