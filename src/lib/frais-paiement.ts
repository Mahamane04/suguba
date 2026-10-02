import { formatF } from '@/lib/montant';
/**
 * Frais d'un paiement client — 2026-09-27, décision du fondateur.
 *
 * ── La règle : chaque frais appartient à SON opération ──────────────────
 * La vente crée les montants dus ; le paiement et le retrait déclenchent
 * chacun leurs propres frais, jamais deux fois (audit du fondateur).
 *
 * Paiement (ce fichier) : en ESPÈCES à la livraison, gratuit. Par Mobile
 * Money (ou carte), le client paie la commande plus les frais DU PAIEMENT :
 *   1. Frais de transaction Suguba : `plateformePct` % de la commande ;
 *   2. Frais SasPay : tarif du compte Suguba, relu automatiquement chez
 *      SasPay (tarifs-saspay.ts), ajoutés par SasPay lui-même (ADD_ON).
 *
 * Retrait : les frais de l'opérateur et le fonds de soutien de l'État
 * (1 %, Ordonnance n° 2025-008/PT-RM, en vigueur depuis le 5 mars 2025 ; Wave
 * aussi depuis la décision n° 2026-0001/MIC-DGCC du 2 février 2026) ne sont
 * PAS facturés au client : ils sont prélevés par l'opérateur quand un
 * bénéficiaire retire des espèces chez un agent. Les grilles ci-dessous
 * servent à l'en informer (`estimerRetraitAgent`) ; les frais Suguba d'un
 * retrait sont calculés par calculerFraisRetrait (pricing.ts). Le 27/09, le
 * client les a payés quelques heures : c'était facturer deux fois une sortie
 * d'argent qui n'avait pas encore eu lieu.
 *
 * ── Grilles vérifiées le 2026-09-27, sur les sites des opérateurs ────────
 *   Orange Money Mali : 0–5 000 F → 50 F ; 5 001–1 000 000 F → 1 % ;
 *                       1 000 001–1 500 000 F → 10 000 F (orangemali.com).
 *   Moov Money Mali   : 5–1 000 000 F → 0,9 % ; 1 000 001–2 000 000 F →
 *                       9 000 F (moov-africa.ml).
 *   Wave Mali         : retrait sans frais opérateur, seul le 1 % de l'État
 *                       s'applique (aucune grille officielle publiée).
 *   SasPay (compte Suguba) : Orange 4 %, Moov 4 %, Wave 5 %, en ADD_ON.
 * Ce ne sont que des valeurs de départ : l'équipe les corrige dans Paramètres
 * sans toucher au code, et les tarifs SasPay se mettent à jour seuls.
 *
 * ── ADD_ON ou DEDUCTED : ne jamais faire payer SasPay deux fois ──────────
 * En ADD_ON, SasPay ajoute LUI-MÊME ses frais au montant débité du client :
 * Suguba demande 10 100 F, le client est débité de 10 504 F. Les ajouter aussi
 * côté Suguba les ferait payer deux fois. En DEDUCTED, SasPay les retient sur
 * ce que reçoit Suguba : le montant demandé est alors relevé juste assez pour
 * que Suguba reçoive bien la commande et ses frais.
 *
 * Fonctions PURES : le même calcul sert l'écran du client, le serveur qui
 * démarre le paiement et le panneau de l'admin — ce qui est affiché est ce
 * qui est facturé.
 */

/** Moyens de paiement proposés au client. Les codes réseau sont ceux de SasPay. */
export type MoyenPaiementClient = 'especes' | 'orange_ml' | 'moov_ml' | 'wave_ml' | 'card' | 'crypto';

/** Opérateurs Mobile Money, chacun avec sa grille de retrait chez un agent. */
export type OperateurRetrait = 'orange_ml' | 'moov_ml' | 'wave_ml';
export const OPERATEURS_RETRAIT: OperateurRetrait[] = ['orange_ml', 'moov_ml', 'wave_ml'];

/** Un palier de tarif SasPay, tel que renvoyé par GET /pricing/my-rates. */
export interface PalierSasPay {
  min: number;
  max: number;
  pct: number;
  fixe: number;
  /** Frais minimum, ou null. */
  plancher: number | null;
  /** Frais maximum, ou null. */
  plafond: number | null;
  /** ADD_ON : payés en plus par le payeur. DEDUCTED : retenus sur le montant. */
  mode: 'ADD_ON' | 'DEDUCTED';
}

export interface TarifReseauSasPay {
  /** Encaissement (le client paie Suguba). Vide = non disponible. */
  encaissement: PalierSasPay[];
  /** Versement (Suguba paie un revendeur). Vide = non disponible. */
  versement: PalierSasPay[];
}

export interface TarifsSasPay {
  /** Date du relevé (ISO), null si jamais relevé. */
  releveLe: string | null;
  /** Par code réseau SasPay : orange_ml, moov_ml, wave_ml, card, crypto… */
  reseaux: Record<string, TarifReseauSasPay>;
}

/** Une tranche de la grille de retrait : frais = pct % du montant + fixe. */
export interface TrancheRetrait {
  min: number;
  max: number;
  pct: number;
  fixe: number;
}

export interface GrilleRetraitOperateur {
  /** Tranches croissantes. Le max de la dernière est le plafond d'un retrait. */
  tranches: TrancheRetrait[];
  /** D'où viennent ces chiffres (site de l'opérateur, décision…). */
  source: string;
  /** Date de la dernière vérification (AAAA-MM-JJ). */
  verifieLe: string;
}

export interface ReglagesFraisPaiement {
  /** Frais de transaction Suguba, en % de la commande. C'est un gain pour Suguba. */
  plateformePct: number;
  /** Prélèvement de l'État sur un retrait d'espèces chez un agent, en % (information). */
  fondsSoutienPct: number;
  /** Grille de retrait chez un agent, par opérateur (information du bénéficiaire). */
  retraitOperateur: Record<OperateurRetrait, GrilleRetraitOperateur>;
  /** Derniers tarifs SasPay enregistrés — secours quand SasPay ne répond pas. */
  saspay: TarifsSasPay;
}

/**
 * Relevé du compte SasPay de Suguba le 2026-09-27 (clé live). Secours
 * seulement : les tarifs sont relus en direct chez SasPay (tarifs-saspay.ts).
 * Carte bancaire absente : SasPay ne la propose pas encore sur ce compte.
 */
export const TARIFS_SASPAY_RELEVES: TarifsSasPay = {
  releveLe: '2026-09-27',
  reseaux: {
    orange_ml: {
      encaissement: [{ min: 200, max: 100000000, pct: 4, fixe: 0, plancher: null, plafond: null, mode: 'ADD_ON' }],
      versement: [{ min: 0, max: 100000000, pct: 2, fixe: 100, plancher: null, plafond: null, mode: 'ADD_ON' }],
    },
    moov_ml: {
      encaissement: [{ min: 200, max: 100000000, pct: 4, fixe: 0, plancher: null, plafond: null, mode: 'ADD_ON' }],
      versement: [{ min: 0, max: 100000000, pct: 3.8, fixe: 0, plancher: 450, plafond: null, mode: 'ADD_ON' }],
    },
    wave_ml: {
      encaissement: [{ min: 0, max: 100000000, pct: 5, fixe: 0, plancher: null, plafond: null, mode: 'ADD_ON' }],
      versement: [{ min: 0, max: 100000000, pct: 3.8, fixe: 0, plancher: 450, plafond: null, mode: 'ADD_ON' }],
    },
    crypto: {
      encaissement: [{ min: 1, max: 50000, pct: 6, fixe: 0, plancher: null, plafond: null, mode: 'ADD_ON' }],
      versement: [],
    },
  },
};

export const GRILLES_RETRAIT_PAR_DEFAUT: Record<OperateurRetrait, GrilleRetraitOperateur> = {
  orange_ml: {
    tranches: [
      { min: 0, max: 5000, pct: 0, fixe: 50 },
      { min: 5001, max: 1000000, pct: 1, fixe: 0 },
      { min: 1000001, max: 1500000, pct: 0, fixe: 10000 },
    ],
    source: 'orangemali.com — Les tarifs Orange Money, retrait compte normal',
    verifieLe: '2026-09-27',
  },
  moov_ml: {
    tranches: [
      { min: 5, max: 1000000, pct: 0.9, fixe: 0 },
      { min: 1000001, max: 2000000, pct: 0, fixe: 9000 },
    ],
    source: 'moov-africa.ml — Les tarifs Moov Money, retrait national compte principal',
    verifieLe: '2026-09-27',
  },
  wave_ml: {
    tranches: [{ min: 0, max: 100000000, pct: 0, fixe: 0 }],
    source: 'Wave : retrait sans frais opérateur ; aucune grille officielle publiée — à confirmer en agence',
    verifieLe: '2026-09-27',
  },
};

export const FRAIS_PAIEMENT_PAR_DEFAUT: ReglagesFraisPaiement = {
  plateformePct: 1,
  fondsSoutienPct: 1,
  retraitOperateur: GRILLES_RETRAIT_PAR_DEFAUT,
  saspay: TARIFS_SASPAY_RELEVES,
};

export const LIBELLES_MOYENS: Record<MoyenPaiementClient, string> = {
  especes: 'Espèces à la livraison',
  orange_ml: 'Orange Money',
  moov_ml: 'Moov Money',
  wave_ml: 'Wave',
  card: 'Carte bancaire',
  crypto: 'Crypto',
};

const pct = (x: number) => x / 100;
/** Arrondi au franc supérieur, sans l'erreur des nombres à virgule (0,9 % de 10 000 = 90,000…01, pas 91). */
const francSup = (v: number) => Math.ceil(Math.round(v * 100) / 100);
const nombre = (v: unknown, defaut = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : defaut);
const montantFrancs = formatF;
const enPct = (n: number) => `${String(n).replace('.', ',')} %`;

/** Opérateur Mobile Money d'un moyen de paiement (carte et crypto : aucun). */
export function operateurDeRetrait(moyen: MoyenPaiementClient): OperateurRetrait | null {
  return moyen === 'orange_ml' || moyen === 'moov_ml' || moyen === 'wave_ml' ? moyen : null;
}

/** Frais SasPay d'un montant selon ses paliers, ou null si aucun palier ne le couvre. */
export function fraisPalier(montant: number, paliers: PalierSasPay[] | undefined): { frais: number; palier: PalierSasPay } | null {
  const M = Math.max(0, Number(montant) || 0);
  const palier = (paliers || []).find((p) => M >= p.min && M <= p.max);
  if (!palier) return null;
  let frais = pct(palier.pct) * M + palier.fixe;
  if (palier.plancher !== null) frais = Math.max(frais, palier.plancher);
  if (palier.plafond !== null) frais = Math.min(frais, palier.plafond);
  return { frais: francSup(frais), palier };
}

/** « 1 % », « 50 F », « 0,9 % + 25 F », « sans frais ». */
export function texteTranche(t: Pick<TrancheRetrait, 'pct' | 'fixe'>): string {
  const morceaux = [t.pct > 0 ? enPct(t.pct) : '', t.fixe > 0 ? montantFrancs(t.fixe) : ''].filter(Boolean);
  return morceaux.join(' + ') || 'sans frais';
}

const fraisDeTranche = (M: number, t: TrancheRetrait) => francSup(pct(t.pct) * M + t.fixe);

/**
 * Frais de retrait de l'opérateur sur `montant`, selon sa grille. Au-delà du
 * plafond d'un retrait (max de la dernière tranche), l'argent sort en
 * plusieurs retraits, chacun facturé selon la grille.
 */
export function fraisRetraitOperateur(montant: number, g: GrilleRetraitOperateur): { frais: number; retraits: number; tranche: TrancheRetrait | null } {
  const M = Math.max(0, Math.round(Number(montant) || 0));
  const tranches = g.tranches;
  if (tranches.length === 0 || M === 0) return { frais: 0, retraits: 0, tranche: null };
  const trancheDe = (x: number) => tranches.find((t) => x >= t.min && x <= t.max)
    || (x < tranches[0].min ? tranches[0] : tranches[tranches.length - 1]);
  const plafond = tranches[tranches.length - 1].max;
  if (M <= plafond) {
    const t = trancheDe(M);
    return { frais: fraisDeTranche(M, t), retraits: 1, tranche: t };
  }
  const pleins = Math.floor(M / plafond);
  const reste = M - pleins * plafond;
  const tPlafond = trancheDe(plafond);
  const frais = pleins * fraisDeTranche(plafond, tPlafond) + (reste > 0 ? fraisDeTranche(reste, trancheDe(reste)) : 0);
  return { frais, retraits: pleins + (reste > 0 ? 1 : 0), tranche: tPlafond };
}

export interface LigneFrais {
  code: 'plateforme' | 'saspay';
  libelle: string;
  /** Explication courte : « 1 % », « 4 %, ajoutés par SasPay »… */
  detail: string;
  montant: number;
}

export interface DetailFraisPaiement {
  moyen: MoyenPaiementClient;
  /** Montant de la commande (articles + livraison − remise). */
  montantCommande: number;
  lignes: LigneFrais[];
  fraisTotal: number;
  /** Montant envoyé à SasPay. */
  montantDemande: number;
  /** Ce que le client débourse réellement. */
  totalClient: number;
  /** Faux si le tarif SasPay de ce moyen est inconnu : ses frais ne sont pas comptés. */
  tarifSasPayConnu: boolean;
}

function detailPalier(p: PalierSasPay): string {
  const base = texteTranche(p);
  const bornes = [p.plancher !== null ? `min. ${montantFrancs(p.plancher)}` : '', p.plafond !== null ? `max. ${montantFrancs(p.plafond)}` : ''].filter(Boolean);
  return bornes.length ? `${base} (${bornes.join(', ')})` : base;
}

/**
 * Détail des frais d'un paiement client. Espèces : aucun frais, jamais.
 * Les frais Suguba, retrait et État sont calculés sur le montant de la
 * commande ; ceux de SasPay sur le montant qui lui est demandé.
 */
export function calculerFraisPaiement(
  montantCommande: number,
  moyen: MoyenPaiementClient,
  f: ReglagesFraisPaiement,
): DetailFraisPaiement {
  const base = Math.max(0, Math.round(Number(montantCommande) || 0));
  if (moyen === 'especes' || base === 0) {
    return { moyen, montantCommande: base, lignes: [], fraisTotal: 0, montantDemande: base, totalClient: base, tarifSasPayConnu: true };
  }

  const lignes: LigneFrais[] = [];
  const plateforme = francSup(pct(f.plateformePct) * base);
  if (plateforme > 0) lignes.push({ code: 'plateforme', libelle: 'Frais de transaction Suguba', detail: enPct(f.plateformePct), montant: plateforme });


  const avantSasPay = base + lignes.reduce((s, l) => s + l.montant, 0);
  const paliers = f.saspay.reseaux[moyen]?.encaissement;
  const premier = fraisPalier(avantSasPay, paliers);
  let montantDemande = avantSasPay;
  let totalClient = avantSasPay;
  if (premier && premier.palier.mode === 'ADD_ON') {
    // SasPay ajoute ses frais au débit du client : on les montre, on ne les demande pas.
    totalClient = avantSasPay + premier.frais;
    lignes.push({ code: 'saspay', libelle: 'Frais SasPay', detail: `${detailPalier(premier.palier)}, ajoutés par SasPay`, montant: premier.frais });
  } else if (premier) {
    // Retenus sur ce que reçoit Suguba : relever le montant demandé jusqu'à
    // ce que, frais retenus, il reste au moins `avantSasPay`.
    let M = avantSasPay + premier.frais;
    for (let i = 0; i < 8; i++) {
      const suivant = fraisPalier(M, paliers);
      if (!suivant) break;
      const cible = avantSasPay + suivant.frais;
      if (cible <= M) break;
      M = cible;
    }
    montantDemande = M;
    totalClient = M;
    lignes.push({ code: 'saspay', libelle: 'Frais SasPay', detail: detailPalier(premier.palier), montant: M - avantSasPay });
  }

  const fraisTotal = totalClient - base;
  return { moyen, montantCommande: base, lignes, fraisTotal, montantDemande, totalClient, tarifSasPayConnu: premier !== null };
}

export interface EstimationRetraitAgent {
  operateur: OperateurRetrait;
  /** Frais de l'opérateur selon sa grille. */
  fraisOperateur: number;
  /** Fonds de soutien de l'État. */
  fraisEtat: number;
  total: number;
  /** Nombre de retraits nécessaires (au-delà du plafond d'un retrait). */
  retraits: number;
}

/**
 * Ce que coûterait le retrait de `montant` en espèces chez un agent de
 * l'opérateur : prélevé par l'opérateur, jamais par Suguba. Affiché au
 * bénéficiaire pour information, avant qu'il choisisse son moyen de retrait.
 */
export function estimerRetraitAgent(montant: number, operateur: OperateurRetrait, f: Pick<ReglagesFraisPaiement, 'retraitOperateur' | 'fondsSoutienPct'>): EstimationRetraitAgent {
  const M = Math.max(0, Math.round(Number(montant) || 0));
  const r = fraisRetraitOperateur(M, f.retraitOperateur[operateur]);
  const fraisEtat = francSup(pct(f.fondsSoutienPct) * M);
  return { operateur, fraisOperateur: r.frais, fraisEtat, total: r.frais + fraisEtat, retraits: r.retraits };
}

/** Frais SasPay d'un versement (retrait revendeur) sur `montant`, ou null si le tarif est inconnu. */
export function fraisVersementSasPay(montant: number, reseau: string, tarifs: TarifsSasPay | undefined): number | null {
  const r = fraisPalier(montant, tarifs?.reseaux?.[reseau]?.versement);
  return r ? r.frais : null;
}

// ─────────────────────────── Lecture de l'API SasPay ───────────────────────────

function lirePaliers(brut: unknown): PalierSasPay[] {
  if (!Array.isArray(brut)) return [];
  return brut
    .filter((t) => t && typeof t === 'object')
    .map((t: any) => ({
      min: nombre(t.min_amount),
      max: t.max_amount == null ? Number.MAX_SAFE_INTEGER : nombre(t.max_amount),
      pct: Math.max(0, nombre(t.percent)),
      fixe: Math.max(0, nombre(t.fixed)),
      plancher: t.floor_amount == null ? null : Math.max(0, nombre(t.floor_amount)),
      plafond: t.cap_amount == null ? null : Math.max(0, nombre(t.cap_amount)),
      mode: t.fee_charge_mode === 'DEDUCTED' ? 'DEDUCTED' as const : 'ADD_ON' as const,
    }))
    .sort((a, b) => a.min - b.min);
}

/**
 * Convertit la réponse de GET /pricing/my-rates en tarifs Suguba : Mali
 * (XOF) et réseaux internationaux seulement. Un sens « indisponible » garde
 * une liste vide, jamais un tarif inventé.
 */
export function lireTarifsSasPay(json: unknown, releveLe: string): TarifsSasPay {
  const racine: any = json && typeof json === 'object' ? json : {};
  const lignes: any[] = Array.isArray(racine) ? racine : Array.isArray(racine.data) ? racine.data : Array.isArray(racine.results) ? racine.results : [];
  const reseaux: Record<string, TarifReseauSasPay> = {};
  for (const l of lignes) {
    if (!l || typeof l.network_code !== 'string') continue;
    if (l.country_code !== 'ML' && l.country_code !== 'XX') continue;
    reseaux[l.network_code] = {
      encaissement: l.payin?.available ? lirePaliers(l.payin.tiers) : [],
      versement: l.payout?.available ? lirePaliers(l.payout.tiers) : [],
    };
  }
  return { releveLe, reseaux };
}

// ─────────────────────────── Réglages ───────────────────────────

function lireTranches(brut: unknown): TrancheRetrait[] | null {
  if (!Array.isArray(brut) || brut.length === 0) return null;
  const tranches = brut
    .filter((t) => t && typeof t === 'object')
    .map((t: any) => ({ min: nombre(t.min), max: nombre(t.max), pct: nombre(t.pct), fixe: nombre(t.fixe) }))
    .sort((a, b) => a.min - b.min);
  return tranches.length ? tranches : null;
}

function completerGrille(brut: unknown, defaut: GrilleRetraitOperateur): GrilleRetraitOperateur {
  const g: any = brut && typeof brut === 'object' ? brut : {};
  const tranches = lireTranches(g.tranches);
  if (!tranches) return defaut;
  return {
    tranches,
    source: typeof g.source === 'string' ? g.source.slice(0, 200) : '',
    verifieLe: typeof g.verifieLe === 'string' ? g.verifieLe.slice(0, 10) : '',
  };
}

/** Palier Suguba → forme brute SasPay, pour repasser par le même contrôle. */
function versBrut(p: any) {
  return {
    min_amount: p?.min, max_amount: p?.max, percent: p?.pct, fixed: p?.fixe,
    floor_amount: p?.plancher, cap_amount: p?.plafond, fee_charge_mode: p?.mode,
  };
}

/** Complète des réglages partiels : un réglage ajouté plus tard ne doit rien casser. */
export function completerFraisPaiement(brut: unknown): ReglagesFraisPaiement {
  const f: any = brut && typeof brut === 'object' ? brut : {};
  const d = FRAIS_PAIEMENT_PAR_DEFAUT;
  const s: any = f.saspay && typeof f.saspay === 'object' ? f.saspay : null;
  const reseaux: Record<string, TarifReseauSasPay> = {};
  if (s && s.reseaux && typeof s.reseaux === 'object') {
    for (const [code, t] of Object.entries<any>(s.reseaux)) {
      if (!t || typeof t !== 'object') continue;
      reseaux[code] = {
        encaissement: lirePaliers((Array.isArray(t.encaissement) ? t.encaissement : []).map(versBrut)),
        versement: lirePaliers((Array.isArray(t.versement) ? t.versement : []).map(versBrut)),
      };
    }
  }
  const retraitOperateur = {} as Record<OperateurRetrait, GrilleRetraitOperateur>;
  for (const op of OPERATEURS_RETRAIT) retraitOperateur[op] = completerGrille(f.retraitOperateur?.[op], d.retraitOperateur[op]);
  return {
    plateformePct: nombre(f.plateformePct, d.plateformePct),
    fondsSoutienPct: nombre(f.fondsSoutienPct, d.fondsSoutienPct),
    retraitOperateur,
    saspay: s && Object.keys(reseaux).length > 0
      ? { releveLe: typeof s.releveLe === 'string' ? s.releveLe : null, reseaux }
      : d.saspay,
  };
}

export function validerFraisPaiement(f: ReglagesFraisPaiement): string[] {
  const erreurs: string[] = [];
  const dansBornes = (v: number) => Number.isFinite(v) && v >= 0 && v <= 20;
  if (!dansBornes(f.plateformePct)) erreurs.push('Frais de transaction Suguba : entre 0 et 20 %.');
  if (!dansBornes(f.fondsSoutienPct)) erreurs.push('Fonds de soutien de l’État : entre 0 et 20 %.');
  for (const op of OPERATEURS_RETRAIT) {
    const t = f.retraitOperateur[op].tranches;
    const nom = `Frais de retrait ${LIBELLES_MOYENS[op]}`;
    if (t.length === 0) { erreurs.push(`${nom} : au moins une tranche.`); continue; }
    if (t.some((x) => !dansBornes(x.pct) || !(x.fixe >= 0) || !(x.min >= 0) || !(x.max >= x.min))) {
      erreurs.push(`${nom} : chaque tranche va d’un montant à un montant plus grand, avec un pourcentage entre 0 et 20 % et des frais fixes positifs.`);
    } else if (t.some((x, i) => i > 0 && x.min <= t[i - 1].max)) {
      erreurs.push(`${nom} : les tranches se chevauchent.`);
    }
  }
  return erreurs;
}
