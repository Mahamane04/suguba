import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerReglages } from '@/lib/platform-settings';
import { calculerFraisRetrait } from '@/lib/pricing';
import { libererGainsFournisseursEchus, lotCAbsent } from '@/lib/gains-fournisseur';
import { CODE_MOYEN_RETRAIT, recuRetrait } from '@/lib/retraits-affichage';

/**
 * Demande de retrait d'un fournisseur (lot C, 2026-09-27) — même circuit que
 * celui du revendeur (/api/payouts/create), sur SON grand-livre :
 *   - propriétaire seul, compte validé ; le fournisseur est toujours celui de
 *     la session, jamais celui du corps de la requête ;
 *   - frais du FOURNISSEUR (taux Suguba caisse / Mobile Money des réglages,
 *     virement SasPay réel), figés avec la demande ;
 *   - la base réserve le solde sous verrou (creer_retrait_fournisseur) : pas
 *     plus que le disponible, et une même demande envoyée deux fois (double
 *     clic, réseau coupé) ne crée qu'un retrait.
 * L'admin paie ensuite depuis « Retraits » (virement SasPay ou guichet).
 */
export async function POST(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'retraits');
  if (!acces.ok) return NextResponse.json({ definitive: true, error: acces.erreur }, { status: acces.statut });
  if (acces.session.status !== 'active') {
    return NextResponse.json({ definitive: true, error: 'Votre compte fournisseur doit être validé avant un retrait.' }, { status: 403 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Enregistrement indisponible.' }, { status: 503 });
  const fournisseur = acces.contexte.fournisseurId;

  try {
    const { withdrawalCode, amount, payoutProvider, payoutPhone } = await req.json();
    const montant = Number(amount);
    const moyen = CODE_MOYEN_RETRAIT[payoutProvider];
    if (!Number.isSafeInteger(montant) || montant <= 0 || !moyen
      || typeof withdrawalCode !== 'string' || !/^[A-Za-z0-9-]{8,100}$/.test(withdrawalCode)
      || typeof payoutPhone !== 'string' || !/^\+?[0-9 ()-]{8,30}$/.test(payoutPhone)) {
      return NextResponse.json({ definitive: true, error: 'Montant, référence, moyen ou téléphone invalide.' }, { status: 400 });
    }
    const hash = (v: string) => createHash('sha256').update(v).digest('hex');
    const cle = hash(withdrawalCode);
    const empreinte = hash(JSON.stringify([montant, moyen, payoutPhone]));

    // Reprise d'une demande déjà enregistrée : le même reçu, rien de plus.
    const { data: precedent, error: erreurLecture } = await admin.from('payouts').select('*')
      .eq('reseller_id', fournisseur).eq('beneficiaire', 'fournisseur').eq('request_key', cle).maybeSingle();
    if (erreurLecture) {
      return NextResponse.json({ error: lotCAbsent(erreurLecture) ? 'Les retraits fournisseurs ne sont pas encore ouverts.' : 'Vérification de la demande indisponible.' }, { status: 503 });
    }
    if (precedent) {
      if (precedent.request_fingerprint !== empreinte) return NextResponse.json({ error: 'Reprenez la demande avec ses informations initiales.' }, { status: 409 });
      return NextResponse.json(recuRetrait(precedent));
    }

    const { reglages } = await chargerReglages(true);
    if (montant < reglages.retraitMinimum) {
      return NextResponse.json({ definitive: true, error: `Le montant minimum de retrait est de ${reglages.retraitMinimum} FCFA.` }, { status: 400 });
    }
    // Même calcul que l'aperçu affiché au fournisseur avant de confirmer.
    const frais = calculerFraisRetrait(montant, moyen, reglages, 'fournisseur');
    if (frais.montantNet <= 0) {
      return NextResponse.json({ definitive: true, error: 'Montant trop faible une fois les frais déduits.' }, { status: 400 });
    }

    // Un montant dont le délai vient de s'écouler doit pouvoir être retiré tout de suite.
    await libererGainsFournisseursEchus(admin);
    const { data: fiche } = await admin.from('suppliers').select('company_name').eq('profile_id', fournisseur).maybeSingle();
    const { data: retrait, error } = await admin.rpc('creer_retrait_fournisseur', {
      p_fournisseur: fournisseur, p_cle: cle, p_empreinte: empreinte,
      p_ligne: {
        id: `WTH-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`,
        reseller_name: fiche?.company_name || 'Fournisseur',
        amount: frais.montantNet, payment_method: moyen, phone_number: payoutPhone,
        montant_demande: frais.montantDemande, frais_retrait: frais.fraisTotal,
        detail_frais: { saspay: frais.fraisSaspay, operateur: frais.fraisOperateur, suguba: frais.fraisSuguba },
      },
    });
    if (error || !retrait) {
      const insuffisant = error?.message === 'INSUFFICIENT_BALANCE';
      const conflit = error?.message === 'IDEMPOTENCY_CONFLICT';
      return NextResponse.json({
        definitive: insuffisant,
        error: insuffisant ? 'Solde disponible insuffisant.'
          : conflit ? 'Cette référence correspond à une autre demande.'
          : lotCAbsent(error) ? 'Les retraits fournisseurs ne sont pas encore ouverts.'
          : 'Retrait non enregistré. Réessayez avec la même référence.',
      }, { status: insuffisant || conflit ? 409 : 503 });
    }
    return NextResponse.json(recuRetrait(retrait));
  } catch (error) {
    console.error('[API supplier/retraits]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Retrait non confirmé. Réessayez avec la même référence.' }, { status: 503 });
  }
}
