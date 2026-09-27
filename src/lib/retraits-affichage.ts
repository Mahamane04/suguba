/**
 * Retraits : ce qui est commun aux revendeurs et aux fournisseurs (lot C,
 * 2026-09-27). Un seul endroit pour le moyen choisi, la ligne d'historique et
 * le reçu d'une demande : deux copies finiraient par annoncer des frais
 * différents pour le même retrait.
 */
import type { TauxRetrait } from './pricing';
import { completerFraisPaiement } from './frais-paiement';

/** Moyen affiché dans le formulaire → valeur enregistrée (`payouts.payment_method`), qui fixe les frais. */
export const CODE_MOYEN_RETRAIT: Record<string, string> = {
  'Orange Money': 'orange_money',
  'Moov Money': 'moov',
  // Wave (2026-09-27) : versement SasPay disponible au Mali (wave_ml).
  'Wave': 'wave',
  'Agence Suguba': 'cash',
};

export const LIBELLE_MOYEN_RETRAIT: Record<string, string> = {
  orange_money: 'Orange Money',
  moov: 'Moov Money',
  mobi_cash: 'Mobi Cash',
  cash: 'Espèces au guichet',
  wave: 'Wave',
};

export interface RetraitAffiche {
  id: string;
  montant: number;
  montantDemande: number | null;
  frais: number | null;
  moyen: string;
  telephone: string;
  statut: string;
  reference: string | null;
  creeLe: string;
}

/** Une ligne de `payouts` telle que le bénéficiaire la voit dans son historique. */
export function retraitAffiche(p: Record<string, any>): RetraitAffiche {
  return {
    id: p.id,
    montant: Number(p.amount) || 0,
    // Colonnes ajoutées le 2026-09-24 : absentes des anciens retraits.
    montantDemande: p.montant_demande != null ? Number(p.montant_demande) : null,
    frais: p.frais_retrait != null ? Number(p.frais_retrait) : null,
    moyen: LIBELLE_MOYEN_RETRAIT[p.payment_method] || p.payment_method || '—',
    telephone: p.phone_number || '',
    statut: p.status,
    reference: p.payment_transaction_id || null,
    creeLe: p.created_at,
  };
}

/** Réponse d'une demande de retrait enregistrée (frais figés avec la demande). */
export function recuRetrait(retrait: Record<string, any>) {
  return {
    success: true, cloud: true, withdrawalCode: retrait.id,
    frais: {
      fraisSaspay: Number(retrait.detail_frais?.saspay || 0), fraisOperateur: Number(retrait.detail_frais?.operateur || 0),
      fraisSuguba: Number(retrait.detail_frais?.suguba || 0), montantDemande: Number(retrait.montant_demande),
      montantNet: Number(retrait.amount), fraisTotal: Number(retrait.frais_retrait),
    },
  };
}

/**
 * Taux de retrait publiés par /api/settings/public, au format attendu par
 * calculerFraisRetrait : l'aperçu du navigateur applique les mêmes chiffres
 * que le serveur.
 */
export function tauxRetraitPublics(reglages: any): TauxRetrait | null {
  if (!reglages?.fraisRetrait) return null;
  return {
    fraisVersementPct: Number(reglages.fraisRetrait.saspayPct) || 0,
    fraisOperateurRetraitPct: reglages.fraisRetrait.operateurPct,
    fraisRetraitSugubaPct: Number(reglages.fraisRetrait.sugubaPct) || 0,
    // Taux Suguba par bénéficiaire, à la caisse et en Mobile Money (2026-09-27).
    fraisRetraitSuguba: reglages.fraisRetrait.sugubaParRole,
    // Vrai tarif SasPay de versement (2026-09-27), comme le serveur.
    fraisPaiement: completerFraisPaiement(reglages.fraisPaiement),
  };
}
