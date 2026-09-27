/**
 * Le cycle complet d'une vente, en trois étapes (2026-09-27, audit du fondateur).
 *
 *   1. VENTE        : elle crée les montants dus — au fournisseur, au
 *                     revendeur, et la commission commerciale de Suguba (avec
 *                     sa base et qui la paie).
 *   2. ENCAISSEMENT : le client paie en espèces (aucun frais) ou par Mobile
 *                     Money (frais du paiement, payés par le client).
 *   3. RETRAITS     : chaque bénéficiaire retire plus tard ce qui lui est dû,
 *                     par le moyen qu'il choisit, et paie les frais de CE
 *                     retrait. Tant qu'ils n'ont pas eu lieu, ils restent
 *                     PRÉVISIONNELS : jamais comptés comme déjà gagnés.
 *
 * Aucun frais n'est compté deux fois, et aucun n'est rattaché à la mauvaise
 * opération. Les coûts de Suguba sont détaillés ligne par ligne.
 *
 * Fonction PURE : elle sert au simulateur des Paramètres et aux tests.
 */
import {
  calculerFraisRetrait,
  calculerTarif,
  calculerTarifGros,
  prixDepuisPartRevendeur,
  type DetailFraisRetrait,
  type DetailTarif,
  type MoyenRetrait,
  type ReglagesPlateforme,
} from './pricing';
import { calculerFraisPaiement, completerFraisPaiement, type DetailFraisPaiement, type MoyenPaiementClient } from './frais-paiement';

export interface EntreeCycle {
  /** Prix fixe (part revendeur choisie par le fournisseur) ou prix de gros (prix libre du revendeur). */
  mode: 'fixe' | 'gros';
  /** Prix fournisseur (fixe) ou prix de gros (gros). */
  prixFournisseur: number;
  /** Prix fixe : part laissée au revendeur par le fournisseur. */
  partRevendeur?: number;
  /** Prix de gros : prix de vente choisi par le revendeur. */
  prixVenteRevendeur?: number;
  paiement: MoyenPaiementClient;
  retraitFournisseur: MoyenRetrait;
  retraitRevendeur: MoyenRetrait;
}

export interface CommissionExpliquee {
  /** Sur quoi la commission est calculée. */
  base: string;
  /** Qui la finance. */
  payeur: string;
}

export interface LigneCout { libelle: string; montant: number }

export interface Cycle {
  vente: {
    prixClient: number;
    duFournisseur: number;
    duRevendeur: number;
    commissionSuguba: number;
    commission: CommissionExpliquee;
    tarif: DetailTarif;
  };
  encaissement: DetailFraisPaiement & { gainSuguba: number };
  /** Prévisionnels : ils n'ont pas encore eu lieu. */
  retraits: { fournisseur: DetailFraisRetrait; revendeur: DetailFraisRetrait | null };
  couts: { lignes: LigneCout[]; total: number };
  synthese: {
    /** Commission de la vente + frais de transaction du paiement. */
    acquis: number;
    /** Frais Suguba des retraits, s'ils ont lieu comme simulé. */
    previsionnel: number;
    couts: number;
    resultat: number;
    resultatAvecPrevisionnel: number;
  };
}

/** Sur quoi la commission de Suguba est calculée, et qui la paie. */
export function commissionExpliquee(r: ReglagesPlateforme, mode: 'fixe' | 'gros'): CommissionExpliquee {
  if (mode === 'gros') {
    const g = r.prixDeGros;
    switch (g?.modeGain) {
      case 'marge_revendeur': return { base: `${g.taux} % de la marge du revendeur`, payeur: 'le revendeur (prélevé sur sa marge)' };
      case 'ajout_prix_gros': return { base: `${g.taux} % du prix de gros`, payeur: 'le revendeur (son prix d’achat augmente)' };
      case 'montant_fixe': return { base: 'un montant fixe par article', payeur: 'le revendeur (prélevé sur sa marge)' };
      default: return { base: 'aucune commission', payeur: 'personne' };
    }
  }
  switch (r.modePartSuguba) {
    case 'prelevement_revendeur': return { base: `${r.tauxPartSuguba} % de la part revendeur`, payeur: 'le revendeur (prélevé sur sa part)' };
    case 'prix_vente': return { base: `${r.tauxPartSuguba} % du prix de vente`, payeur: 'le client (ajouté au prix)' };
    case 'part_revendeur': return { base: `${r.tauxPartSuguba} % de la part revendeur`, payeur: 'le client (ajouté au prix)' };
    default: return { base: 'ce qui reste une fois les coûts couverts', payeur: 'partagé entre revendeur et Suguba' };
  }
}

export function simulerCycle(e: EntreeCycle, r: ReglagesPlateforme): Cycle {
  const PF = Math.max(0, Math.round(Number(e.prixFournisseur) || 0));
  let tarif: DetailTarif;
  let prixClient: number;
  if (e.mode === 'gros') {
    prixClient = Math.max(0, Math.round(Number(e.prixVenteRevendeur) || 0));
    tarif = calculerTarifGros(PF, prixClient, r);
  } else if (r.modePartSuguba === 'auto' || !(Number(e.partRevendeur) > 0)) {
    prixClient = calculerTarif(PF, 0, r).prixRecommande;
    tarif = calculerTarif(PF, prixClient, r);
  } else {
    const part = Math.round(Number(e.partRevendeur));
    prixClient = prixDepuisPartRevendeur(PF, part, r).prixVente;
    tarif = calculerTarif(PF, prixClient, r, part);
  }

  // 1. Vente : les montants dus.
  const duFournisseur = tarif.prixFournisseur;
  const duRevendeur = tarif.commission;
  const commissionSuguba = prixClient - duFournisseur - duRevendeur;

  // 2. Encaissement : les frais du paiement, rien d'autre.
  const paiement = calculerFraisPaiement(prixClient, e.paiement, completerFraisPaiement(r.fraisPaiement));
  const gainSuguba = paiement.lignes.find((l) => l.code === 'plateforme')?.montant || 0;

  // 3. Retraits : prévisionnels, chacun avec ses propres frais.
  const fournisseur = calculerFraisRetrait(duFournisseur, e.retraitFournisseur, r, 'fournisseur');
  const revendeur = duRevendeur > 0 ? calculerFraisRetrait(duRevendeur, e.retraitRevendeur, r, 'revendeur') : null;

  // Coûts supportés par Suguba, détaillés (plus de total opaque).
  const lignes: LigneCout[] = [
    { libelle: 'Provision pour refus à la livraison', montant: tarif.provisionRefus },
    { libelle: 'Part des coûts fixes du mois', montant: tarif.coutFixe },
    { libelle: 'Message au client', montant: tarif.coutMessage },
    { libelle: 'Livraison non couverte par le client', montant: tarif.deficitLivraison },
  ].filter((l) => l.montant > 0);
  const couts = lignes.reduce((s, l) => s + l.montant, 0);

  const acquis = commissionSuguba + gainSuguba;
  const previsionnel = fournisseur.fraisSuguba + (revendeur?.fraisSuguba || 0);
  return {
    vente: { prixClient, duFournisseur, duRevendeur, commissionSuguba, commission: commissionExpliquee(r, e.mode), tarif },
    encaissement: { ...paiement, gainSuguba },
    retraits: { fournisseur, revendeur },
    couts: { lignes, total: couts },
    synthese: { acquis, previsionnel, couts, resultat: acquis - couts, resultatAvecPrevisionnel: acquis + previsionnel - couts },
  };
}
