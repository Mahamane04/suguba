/**
 * Moteur de tarification Suguba — marge plancher, commission revendeur, devis.
 *
 * Fonctions PURES : aucun accès réseau, aucun secret. Le même code calcule
 * l'aperçu dans la modale admin et fait foi côté serveur, ce qui garantit que
 * ce que l'admin voit est exactement ce qui sera enregistré.
 *
 * ── Le principe ──────────────────────────────────────────────────────────
 * Une commande doit d'abord couvrir ce qu'elle coûte à Suguba. Ce n'est
 * qu'ensuite que le reste se partage avec le revendeur :
 *
 *   coût par commande = coûts variables + coûts fixes du mois ÷ volume de référence
 *   plancher Suguba   = coût par commande + marge nette minimale
 *   reste             = prix de vente − prix fournisseur − plancher
 *   commission        = reste × part revendeur (arrondie VERS LE BAS)
 *
 * Avant ce moteur, la commission était saisie à la main et la seule règle
 * appliquée était « marge Suguba non négative » — sans tenir compte d'aucun
 * coût. Un produit pouvait donc être vendu à perte sans que personne ne le voie.
 *
 * ── Deux choix de prudence ───────────────────────────────────────────────
 * 1. Les frais de paiement SasPay sont comptés sur TOUTES les commandes, même
 *    celles payées en espèces à la livraison. La part réelle espèces / mobile
 *    money n'est pas connue ; surestimer un coût protège la marge, le sous-
 *    estimer la détruit.
 * 2. La commission est arrondie VERS LE BAS. L'arrondir vers le haut prendrait
 *    les francs manquants sur le plancher, qui cesserait d'en être un.
 *
 * Les coûts rattachés à la commande (livraison, message, coûts fixes) sont
 * comptés par UNITÉ vendue. Pour une commande de plusieurs articles, ils sont
 * donc surestimés — là encore dans le sens de la prudence.
 */

import { trouverQuartier, distanceKm } from './bamako-quartiers';

export interface LigneCoutFixe {
  libelle: string;
  /** Montant mensuel en FCFA. */
  montant: number;
}

export interface PointRelais {
  id: string;
  nom: string;
  /** Frais de retrait facturés au client, en FCFA. */
  frais: number;
  horaires: string;
}

export interface CodePromo {
  code: string;
  /** Remise demandée, en FCFA. Plafonnée par le moteur (voir calculerCommande). */
  remise: number;
  actif: boolean;
}

/**
 * Comment Suguba se rémunère quand le FOURNISSEUR fixe la part du revendeur
 * (ajouté le 2026-09-11) :
 *  - 'auto'           : le fournisseur ne fixe rien, le moteur calcule la
 *                       commission (part revendeur du reste, comme avant) ;
 *  - 'prix_vente'     : Suguba prend `tauxPartSuguba` % du prix de vente ;
 *  - 'part_revendeur' : Suguba prend `tauxPartSuguba` % de la part revendeur.
 * Dans les deux derniers cas, un produit sans part indiquée retombe sur le
 * calcul automatique, et le prix est TOUJOURS relevé au plancher s'il ne
 * couvre pas les coûts : aucun mode ne peut faire vendre à perte.
 */
export type ModePartSuguba = 'auto' | 'prix_vente' | 'part_revendeur';

export interface ReglagesPlateforme {
  // ── Coûts variables, par commande ────────────────────────────────────
  /** Frais SasPay d'encaissement, en % du montant encaissé (article + livraison). */
  fraisPaiementPct: number;
  /** Frais SasPay de versement de la commission au revendeur, en % de la commission. */
  fraisVersementPct: number;
  /** SMS ou message WhatsApp envoyé au client, en FCFA. */
  coutMessageParCommande: number;
  /**
   * Provision pour refus à la livraison, en % du prix de vente. C'est le coût
   * caché le plus lourd du paiement à la livraison : un client qui refuse le
   * colis, c'est une course payée pour rien et un article à rapatrier.
   */
  provisionRefusPct: number;

  // ── Livraison ────────────────────────────────────────────────────────
  /** Frais de livraison facturés au client quand sa ville n'a pas de tarif propre, en FCFA. */
  fraisLivraisonClient: number;
  /** Frais de livraison par ville. */
  livraisonParVille: Record<string, number>;
  /**
   * Livraison À BAMAKO calculée sur la distance réelle entre le quartier du
   * fournisseur et celui du client (2026-09-11), plutôt qu'un tarif plat
   * unique. Ne s'applique que si les DEUX quartiers sont reconnus (voir
   * src/lib/bamako-quartiers.ts) ; sinon, repli silencieux sur
   * `livraisonParVille['Bamako']` — aucune commande ne peut se retrouver sans
   * tarif calculable.
   */
  livraisonDistanceBamako: {
    /** Frais fixe, même pour une distance nulle (même quartier). */
    fraisBase: number;
    /** Frais par kilomètre à vol d'oiseau au-delà de la base. */
    fraisParKm: number;
    /** Plancher, quelle que soit la distance calculée. */
    fraisMinimum: number;
    /** Plafond, pour qu'une erreur de coordonnées ne facture jamais une fortune. */
    fraisMaximum: number;
  };
  /** Points relais où le client retire lui-même son colis. */
  pointsRelais: PointRelais[];
  /** Rémunération du livreur par livraison, en FCFA. */
  remunerationLivreur: number;

  // ── Coûts fixes ──────────────────────────────────────────────────────
  coutsFixesMensuels: LigneCoutFixe[];
  /**
   * Nombre de commandes par mois sur lequel les coûts fixes sont répartis.
   * C'est un OBJECTIF, pas le volume constaté : diviser par le volume réel
   * ferait exploser les prix au lancement (300 000 F ÷ 50 commandes = 6 000 F
   * par commande) puis les ferait s'effondrer à mesure que l'activité monte.
   */
  volumeReference: number;

  // ── Politique commerciale ────────────────────────────────────────────
  /** Marge nette que Suguba garde en plus de ses coûts, en % du prix de vente. */
  margeNetteMinPct: number;
  /** Part du reste (au-dessus du plancher) versée au revendeur, en %. */
  partRevendeurPct: number;
  /** Sous ce montant, le produit reste vendable mais n'est plus proposé au partage. */
  commissionMinimale: number;
  /** Commission visée pour le prix recommandé, en % du prix fournisseur. */
  commissionCiblePct: number;
  /** Pas d'arrondi des commissions et des remises, en FCFA. */
  arrondiCommission: number;
  /** Pas d'arrondi des prix proposés (minimal, recommandé), en FCFA. */
  arrondiPrix: number;
  /** Montant minimal d'un retrait revendeur, en FCFA. */
  retraitMinimum: number;

  // ── Part revendeur fixée par le fournisseur ──────────────────────────
  /** Mode de rémunération de Suguba (voir ModePartSuguba). */
  modePartSuguba: ModePartSuguba;
  /** Pourcentage prélevé par Suguba, sur le prix de vente ou sur la part revendeur selon le mode. */
  tauxPartSuguba: number;
  /** Part minimale de Suguba par article vendu, en FCFA. */
  minimumPartSuguba: number;

  /** Codes promo acceptés au moment de la commande. */
  codesPromo: CodePromo[];
}

/**
 * Valeurs de départ. Les pourcentages SasPay viennent de leur documentation
 * (exemples : 37,50 F sur 2 500 F encaissés, 150 F sur 10 000 F versés, soit
 * 1,5 % dans les deux cas). Livraison, points relais, codes promo et retrait
 * minimum reprennent exactement les valeurs jusqu'ici codées en dur dans
 * l'application — la mise en service ne change rien pour le client.
 *
 * ⚠️ Les coûts fixes sont une ESTIMATION PROVISOIRE, pas des chiffres réels :
 * l'écran des réglages l'annonce comme « non confirmé » tant que l'admin ne
 * les a pas remplacés par ses vraies dépenses.
 */
export const REGLAGES_PAR_DEFAUT: ReglagesPlateforme = {
  fraisPaiementPct: 1.5,
  fraisVersementPct: 1.5,
  coutMessageParCommande: 20,
  provisionRefusPct: 4,
  fraisLivraisonClient: 1500,
  livraisonParVille: {
    Bamako: 1500,
    Kati: 2500,
    Sikasso: 3500,
    'Ségou': 3500,
    Kayes: 5000,
    Mopti: 5000,
  },
  livraisonDistanceBamako: {
    fraisBase: 300,
    fraisParKm: 150,
    fraisMinimum: 500,
    fraisMaximum: 3000,
  },
  pointsRelais: [
    { id: 'hub-aci', nom: 'Hub Central Suguba — Hamdallaye ACI 2000 (Derrière Clinique Pasteur)', frais: 0, horaires: '08h - 19h30' },
    { id: 'relais-badala', nom: 'Point Relais Badalabougou — Station Total Pont Fahd', frais: 500, horaires: '07h - 21h00' },
    { id: 'relais-marche', nom: 'Point Relais Grand Marché — Carrefour Vox Daoula', frais: 500, horaires: '08h - 18h30' },
    { id: 'relais-faladie', nom: 'Point Relais Faladié — Tour d\'Afrique / Rond-Point', frais: 500, horaires: '07h30 - 20h30' },
    { id: 'relais-kalaban', nom: 'Point Relais Kalaban-Coro — Face Mairie', frais: 500, horaires: '08h - 20h00' },
    { id: 'relais-yirimadio', nom: 'Point Relais Yirimadio — Près du Stade du 26 Mars', frais: 500, horaires: '08h - 20h00' },
  ],
  remunerationLivreur: 1000,
  coutsFixesMensuels: [
    { libelle: 'Estimation provisoire globale — à remplacer par le détail ci-dessous', montant: 300000 },
    { libelle: 'Hébergement (Vercel)', montant: 0 },
    { libelle: 'Base de données (Supabase)', montant: 0 },
    { libelle: 'Nom de domaine', montant: 0 },
    { libelle: 'Guichet et personnel', montant: 0 },
    { libelle: 'Marketing', montant: 0 },
  ],
  volumeReference: 500,
  margeNetteMinPct: 5,
  partRevendeurPct: 70,
  commissionMinimale: 500,
  commissionCiblePct: 10,
  arrondiCommission: 250,
  arrondiPrix: 500,
  retraitMinimum: 5000,
  modePartSuguba: 'prix_vente',
  tauxPartSuguba: 8,
  minimumPartSuguba: 1000,
  codesPromo: [
    { code: 'RAMADAN', remise: 2000, actif: true },
    { code: 'TABASKI', remise: 2000, actif: true },
    { code: 'SUGUBAVIP', remise: 1500, actif: true },
    { code: 'BAMAKO', remise: 1000, actif: true },
    { code: 'PROMO2026', remise: 1000, actif: true },
  ],
};

export type StatutTarif = 'ok' | 'sous_plancher' | 'commission_faible';

export interface DetailTarif {
  prixFournisseur: number;
  prixVente: number;
  // Décomposition du coût par commande
  coutPaiement: number;
  provisionRefus: number;
  coutFixe: number;
  coutMessage: number;
  deficitLivraison: number;
  coutParCommande: number;
  margeNetteMinimale: number;
  plancher: number;
  // Partage
  reste: number;
  commission: number;
  fraisVersement: number;
  /** Prix de vente − prix fournisseur − commission. */
  margeSuguba: number;
  /** Ce qui reste réellement à Suguba une fois tous ses coûts payés. */
  margeNetteSuguba: number;
  // Verdict
  statut: StatutTarif;
  /** Proposé aux revendeurs ? Faux si sous le plancher ou commission trop faible. */
  partageable: boolean;
  /** Prix de vente sous lequel Suguba perd de l'argent. */
  prixMinimal: number;
  /** Prix permettant la commission visée. */
  prixRecommande: number;
}

const pct = (x: number) => x / 100;
/** Arrondi à l'unité, sans produire de « −0 » à l'affichage (Math.round(−0,4) vaut −0). */
const franc = (v: number) => Math.round(v) || 0;
const arrondiInf = (v: number, pas: number) => Math.floor(v / pas) * pas;
const arrondiSup = (v: number, pas: number) => Math.ceil(v / pas) * pas;

export function totalCoutsFixes(r: ReglagesPlateforme): number {
  return r.coutsFixesMensuels.reduce((s, l) => s + (Number(l.montant) || 0), 0);
}

export function coutFixeParCommande(r: ReglagesPlateforme): number {
  return totalCoutsFixes(r) / Math.max(1, r.volumeReference);
}

/** Part des coûts qui croît avec le prix de vente (paiement, refus, marge nette). */
function tauxProportionnel(r: ReglagesPlateforme): number {
  return pct(r.fraisPaiementPct) + pct(r.provisionRefusPct) + pct(r.margeNetteMinPct);
}

/** Part du plancher qui ne dépend pas du prix de vente, en FCFA. */
function chargesIndependantesDuPrix(r: ReglagesPlateforme): number {
  return (
    pct(r.fraisPaiementPct) * r.fraisLivraisonClient +
    coutFixeParCommande(r) +
    r.coutMessageParCommande +
    Math.max(0, r.remunerationLivreur - r.fraisLivraisonClient)
  );
}

/**
 * Prix de vente qui laisse exactement `resteVoulu` au-dessus du plancher.
 * Se déduit de : PV − PF − (taux × PV + charges) = reste.
 */
function prixPourReste(r: ReglagesPlateforme, prixFournisseur: number, resteVoulu: number): number {
  const denominateur = 1 - tauxProportionnel(r);
  if (denominateur <= 0) return Number.POSITIVE_INFINITY;
  return (prixFournisseur + chargesIndependantesDuPrix(r) + resteVoulu) / denominateur;
}

/**
 * `commissionProposee` : part revendeur choisie par le fournisseur (colonne
 * products.commission_proposee). Ignorée en mode 'auto' ou si elle est vide ;
 * sinon elle devient LA commission, à condition que le prix couvre les coûts
 * plus cette commission (sinon verdict « sous_plancher »).
 */
export function calculerTarif(
  prixFournisseur: number,
  prixVente: number,
  r: ReglagesPlateforme,
  commissionProposee?: number | null,
): DetailTarif {
  const PF = Math.max(0, Number(prixFournisseur) || 0);
  const PV = Math.max(0, Number(prixVente) || 0);

  const coutPaiement = pct(r.fraisPaiementPct) * (PV + r.fraisLivraisonClient);
  const provisionRefus = pct(r.provisionRefusPct) * PV;
  const coutFixe = coutFixeParCommande(r);
  const coutMessage = r.coutMessageParCommande;
  const deficitLivraison = Math.max(0, r.remunerationLivreur - r.fraisLivraisonClient);
  const coutParCommande = coutPaiement + provisionRefus + coutFixe + coutMessage + deficitLivraison;
  const margeNetteMinimale = pct(r.margeNetteMinPct) * PV;
  const plancher = coutParCommande + margeNetteMinimale;
  const reste = PV - PF - plancher;

  const part = pct(r.partRevendeurPct);
  const tauxVersement = pct(r.fraisVersementPct);

  // Part revendeur CHOISIE par le fournisseur (modes « % du prix de vente » et
  // « % de la part revendeur »). En mode automatique elle est ignorée.
  const imposee = r.modePartSuguba !== 'auto' && Number(commissionProposee) > 0
    ? arrondiInf(Number(commissionProposee), r.arrondiCommission)
    : null;

  let prixMinimal: number;
  let prixRecommande: number;
  if (imposee !== null) {
    // Le prix doit couvrir les coûts ET la commission promise, frais de
    // versement compris.
    prixMinimal = arrondiSup(prixPourReste(r, PF, imposee * (1 + tauxVersement)), r.arrondiPrix);
    prixRecommande = prixDepuisPartRevendeur(PF, imposee, r).prixVente;
  } else {
    prixMinimal = arrondiSup(prixPourReste(r, PF, 0), r.arrondiPrix);
    // Commission visée, puis le reste nécessaire pour la verser à la part
    // revendeur choisie. Sans part revendeur, le prix recommandé est le minimal.
    const cible = arrondiSup(Math.max(r.commissionMinimale, pct(r.commissionCiblePct) * PF), r.arrondiCommission);
    prixRecommande = part > 0
      ? arrondiSup(prixPourReste(r, PF, cible / part), r.arrondiPrix)
      : prixMinimal;
  }

  let commission = 0;
  let statut: StatutTarif;

  if (imposee !== null) {
    if (reste < imposee * (1 + tauxVersement)) {
      statut = 'sous_plancher';
    } else if (imposee < r.commissionMinimale) {
      statut = 'commission_faible';
    } else {
      statut = 'ok';
      commission = imposee;
    }
  } else if (reste < 0) {
    statut = 'sous_plancher';
  } else {
    // Le versement de la commission coûte `fraisVersementPct` à Suguba. On
    // plafonne donc la commission à reste ÷ (1 + frais) : au-delà, ces frais
    // seraient pris sur le plancher.
    const plafond = reste / (1 + pct(r.fraisVersementPct));
    const brute = arrondiInf(Math.min(reste * part, plafond), r.arrondiCommission);
    if (brute < r.commissionMinimale) {
      statut = 'commission_faible';
    } else {
      statut = 'ok';
      commission = brute;
    }
  }

  const fraisVersement = pct(r.fraisVersementPct) * commission;
  const margeSuguba = PV - PF - commission;
  const margeNetteSuguba = margeSuguba - coutParCommande - fraisVersement;

  return {
    prixFournisseur: PF,
    prixVente: PV,
    coutPaiement: franc(coutPaiement),
    provisionRefus: franc(provisionRefus),
    coutFixe: franc(coutFixe),
    coutMessage: franc(coutMessage),
    deficitLivraison: franc(deficitLivraison),
    coutParCommande: franc(coutParCommande),
    margeNetteMinimale: franc(margeNetteMinimale),
    plancher: franc(plancher),
    reste: franc(reste),
    commission,
    fraisVersement: franc(fraisVersement),
    margeSuguba: franc(margeSuguba),
    margeNetteSuguba: franc(margeNetteSuguba),
    statut,
    partageable: statut === 'ok',
    prixMinimal,
    prixRecommande,
  };
}

// ──────────────── Prix à partir de la part revendeur choisie ─────────────

export interface PrixDepuisPart {
  /** Prix client final (arrondi, relevé au plancher si besoin). */
  prixVente: number;
  commission: number;
  /** Ce qui revient à Suguba avant ses coûts : prix − fournisseur − commission. */
  partSuguba: number;
  /** Prix issu du seul pourcentage Suguba, avant relèvement au plancher. */
  prixCalcule: number;
  /** Vrai si le pourcentage ne couvrait pas les coûts et que le prix a été relevé. */
  releveAuPlancher: boolean;
  prixMinimal: number;
}

/**
 * Prix client = prix fournisseur + part revendeur + part Suguba, selon le mode
 * choisi par l'admin. Utilisé par la publication automatique, l'aperçu du
 * fournisseur et le tableau de simulation de l'admin — un seul calcul.
 */
export function prixDepuisPartRevendeur(
  prixFournisseur: number,
  commissionVoulue: number,
  r: ReglagesPlateforme,
): PrixDepuisPart {
  const PF = Math.max(0, Number(prixFournisseur) || 0);
  const C = arrondiInf(Math.max(0, Number(commissionVoulue) || 0), r.arrondiCommission);
  const taux = pct(r.tauxPartSuguba);
  const minimum = Math.max(0, Number(r.minimumPartSuguba) || 0);

  let brut: number;
  if (r.modePartSuguba === 'part_revendeur') {
    brut = PF + C + Math.max(minimum, taux * C);
  } else {
    // % du prix de vente : P = (PF + C) / (1 − taux), sauf si la part qui en
    // résulte est sous le minimum.
    const p = taux < 1 ? (PF + C) / (1 - taux) : Number.POSITIVE_INFINITY;
    brut = taux * p >= minimum ? p : PF + C + minimum;
  }

  const prixCalcule = arrondiSup(brut, r.arrondiPrix);
  const prixMinimal = arrondiSup(prixPourReste(r, PF, C * (1 + pct(r.fraisVersementPct))), r.arrondiPrix);
  const prixVente = Math.max(prixCalcule, prixMinimal);

  return {
    prixVente,
    commission: C,
    partSuguba: prixVente - PF - C,
    prixCalcule,
    releveAuPlancher: prixVente > prixCalcule,
    prixMinimal,
  };
}

// ─────────────────────────── Devis de commande ───────────────────────────

export interface DemandeDevis {
  quantite: number;
  ville?: string;
  /**
   * Quartier du CLIENT à Bamako (2026-09-11). Combiné à `quartierFournisseur`,
   * remplace le tarif plat par un calcul à la distance réelle — voir
   * `livraisonDistanceBamako`. Le caller (route API) le résout depuis la
   * fiche fournisseur du produit ; cette fonction reste pure, donc ne va
   * jamais le chercher elle-même.
   */
  quartierClient?: string;
  /** Quartier du FOURNISSEUR du produit commandé (`suppliers.warehouse_neighborhood`). */
  quartierFournisseur?: string;
  /** Si renseigné et valide, le client retire son colis à ce point relais. */
  pointRelaisId?: string;
  codePromo?: string;
  /** La commande vient-elle d'un lien revendeur reconnu ? Sinon, pas de commission. */
  revendeurAttribue: boolean;
}

export interface Devis {
  quantite: number;
  prixUnitaire: number;
  montantArticles: number;
  modeLivraison: 'domicile' | 'relais';
  ville: string;
  pointRelais: { id: string; nom: string } | null;
  fraisLivraison: number;
  /** Distance estimée (km, à vol d'oiseau) ayant servi au calcul ci-dessus. null hors Bamako ou quartiers inconnus. */
  distanceLivraisonKm: number | null;
  codePromo: string | null;
  remiseDemandee: number;
  remise: number;
  /** 'invalide' : code inconnu ou inactif. 'plafonnee' : remise réduite pour ne pas vendre à perte. */
  avisPromo: 'invalide' | 'plafonnee' | null;
  total: number;
  commissionUnitaire: number;
  commissionTotale: number;
  /** Marge brute Suguba de la commande, remise déduite. */
  margeSuguba: number;
  tarif: DetailTarif;
}

export const QUANTITE_MAX = 50;

/**
 * Livraison à Bamako calculée sur la distance réelle entre les deux
 * quartiers, si les deux sont reconnus. Renvoie `null` sinon (quartier
 * manquant ou non répertorié) : le caller retombe alors sur le tarif plat
 * `livraisonParVille['Bamako']`, jamais sur une commande sans tarif.
 */
function fraisLivraisonDistanceBamako(
  r: ReglagesPlateforme,
  quartierFournisseur: string | undefined,
  quartierClient: string | undefined,
): { frais: number; distanceKm: number } | null {
  const a = trouverQuartier(quartierFournisseur);
  const b = trouverQuartier(quartierClient);
  if (!a || !b) return null;
  const km = distanceKm(a, b);
  const d = r.livraisonDistanceBamako;
  const brut = d.fraisBase + d.fraisParKm * km;
  const frais = Math.round(Math.min(d.fraisMaximum, Math.max(d.fraisMinimum, brut)) / 50) * 50;
  return { frais, distanceKm: km };
}

/** Recherche d'une ville sans tenir compte de la casse ni des espaces autour. */
function fraisPourVille(r: ReglagesPlateforme, ville: string): { ville: string; frais: number } {
  const cherchee = ville.trim().toLowerCase();
  for (const [nom, frais] of Object.entries(r.livraisonParVille)) {
    if (nom.toLowerCase() === cherchee) return { ville: nom, frais: Number(frais) || 0 };
  }
  return { ville: ville.trim() || 'Bamako', frais: r.fraisLivraisonClient };
}

/**
 * Devis complet d'une commande — la SEULE source des montants d'une commande.
 *
 * Utilisé à l'identique pour l'affichage sur la page produit et pour
 * l'enregistrement côté serveur. Jusqu'ici, la page calculait son propre
 * total (livraison par ville, point relais, code promo) pendant que la
 * commande enregistrée gardait 1 500 F de livraison et aucune remise : le
 * client se voyait promettre un montant, et on lui en réclamait un autre.
 *
 * ── La règle des codes promo ─────────────────────────────────────────────
 * La remise est prise sur la marge de Suguba, jamais sur la commission du
 * revendeur. Et elle est plafonnée pour que Suguba ne VENDE JAMAIS À PERTE :
 * elle peut consommer le bénéfice, pas les coûts. Au-delà, elle est réduite
 * — et le devis le dit (`avisPromo: 'plafonnee'`) plutôt que de le cacher.
 */
export function calculerCommande(
  produit: { prixFournisseur: number; prixVente: number; commissionProposee?: number | null },
  demande: DemandeDevis,
  r: ReglagesPlateforme,
): Devis {
  const quantite = Math.min(QUANTITE_MAX, Math.max(1, Math.floor(Number(demande.quantite) || 1)));
  // La part revendeur choisie par le fournisseur doit suivre jusqu'à la
  // commande : sinon la commission enregistrée différerait de celle affichée.
  const tarif = calculerTarif(produit.prixFournisseur, produit.prixVente, r, produit.commissionProposee);

  const prixUnitaire = tarif.prixVente;
  const montantArticles = prixUnitaire * quantite;

  // Livraison : point relais valide, sinon ville, sinon tarif par défaut.
  const relais = demande.pointRelaisId
    ? r.pointsRelais.find((p) => p.id === demande.pointRelaisId) || null
    : null;
  let modeLivraison: 'domicile' | 'relais';
  let ville: string;
  let fraisLivraison: number;
  let distanceLivraisonKm: number | null = null;
  if (relais) {
    modeLivraison = 'relais';
    ville = 'Bamako';
    fraisLivraison = Number(relais.frais) || 0;
  } else {
    modeLivraison = 'domicile';
    const trouve = fraisPourVille(r, demande.ville || 'Bamako');
    ville = trouve.ville;
    fraisLivraison = trouve.frais;
    // À Bamako, un tarif à la distance réelle remplace le tarif plat dès que
    // les deux quartiers (fournisseur et client) sont reconnus.
    if (ville.trim().toLowerCase() === 'bamako') {
      const parDistance = fraisLivraisonDistanceBamako(r, demande.quartierFournisseur, demande.quartierClient);
      if (parDistance) {
        fraisLivraison = parDistance.frais;
        distanceLivraisonKm = parDistance.distanceKm;
      }
    }
  }

  const commissionUnitaire = demande.revendeurAttribue ? tarif.commission : 0;
  const commissionTotale = commissionUnitaire * quantite;

  // Code promo
  const saisi = (demande.codePromo || '').trim().toUpperCase();
  const promo = saisi ? r.codesPromo.find((c) => c.actif && c.code.toUpperCase() === saisi) || null : null;
  const remiseDemandee = promo ? Math.max(0, Number(promo.remise) || 0) : 0;

  // Ce que Suguba garde réellement sur la commande une fois TOUS ses coûts
  // payés (y compris les frais de versement de la commission). La remise ne
  // peut pas dépasser ce montant.
  const netUnitaire =
    tarif.prixVente - tarif.prixFournisseur - commissionUnitaire -
    tarif.coutParCommande - pct(r.fraisVersementPct) * commissionUnitaire;
  const plafondRemise = Math.max(0, arrondiInf(netUnitaire * quantite, r.arrondiCommission));
  const remise = Math.min(remiseDemandee, plafondRemise);

  let avisPromo: Devis['avisPromo'] = null;
  if (saisi && !promo) avisPromo = 'invalide';
  else if (promo && remise < remiseDemandee) avisPromo = 'plafonnee';

  const total = Math.max(0, montantArticles + fraisLivraison - remise);
  const margeSuguba = (tarif.prixVente - tarif.prixFournisseur - commissionUnitaire) * quantite - remise;

  return {
    quantite,
    prixUnitaire,
    montantArticles,
    modeLivraison,
    ville,
    pointRelais: relais ? { id: relais.id, nom: relais.nom } : null,
    fraisLivraison,
    distanceLivraisonKm,
    codePromo: promo ? promo.code : null,
    remiseDemandee,
    remise,
    avisPromo,
    total,
    commissionUnitaire,
    commissionTotale,
    margeSuguba: franc(margeSuguba),
    tarif,
  };
}

// ─────────────────────────── Réglages ───────────────────────────

/**
 * Vérifie que des réglages sont cohérents. Renvoie la liste des problèmes, vide
 * si tout va bien. Un réglage absurde — des pourcentages qui dépassent 100 % du
 * prix, un volume nul — rendrait tous les prix incalculables.
 */
export function validerReglages(r: ReglagesPlateforme): string[] {
  const erreurs: string[] = [];
  const pourcentages: [keyof ReglagesPlateforme, string][] = [
    ['fraisPaiementPct', 'Frais de paiement'],
    ['fraisVersementPct', 'Frais de versement'],
    ['provisionRefusPct', 'Provision pour refus'],
    ['margeNetteMinPct', 'Marge nette minimale'],
    ['partRevendeurPct', 'Part revendeur'],
    ['commissionCiblePct', 'Commission visée'],
    ['tauxPartSuguba', 'Part Suguba'],
  ];
  for (const [cle, libelle] of pourcentages) {
    const v = Number(r[cle]);
    if (!Number.isFinite(v) || v < 0 || v > 100) erreurs.push(`${libelle} : doit être entre 0 et 100 %.`);
  }
  if (tauxProportionnel(r) >= 0.6) {
    erreurs.push('Paiement + provision pour refus + marge nette dépassent 60 % du prix de vente : aucun prix ne resterait vendable.');
  }
  const montants: [keyof ReglagesPlateforme, string][] = [
    ['coutMessageParCommande', 'Coût du message'],
    ['fraisLivraisonClient', 'Frais de livraison par défaut'],
    ['remunerationLivreur', 'Rémunération du livreur'],
    ['commissionMinimale', 'Commission minimale'],
    ['retraitMinimum', 'Retrait minimum'],
    ['minimumPartSuguba', 'Part minimale Suguba par vente'],
  ];
  for (const [cle, libelle] of montants) {
    const v = Number(r[cle]);
    if (!Number.isFinite(v) || v < 0) erreurs.push(`${libelle} : doit être un montant positif.`);
  }
  if (!['auto', 'prix_vente', 'part_revendeur'].includes(r.modePartSuguba)) {
    erreurs.push('Mode de rémunération Suguba inconnu.');
  }
  if (r.modePartSuguba === 'prix_vente' && Number(r.tauxPartSuguba) >= 90) {
    erreurs.push('Part Suguba sur le prix de vente : au-delà de 90 %, aucun prix ne serait raisonnable.');
  }
  if (!Number.isFinite(r.volumeReference) || r.volumeReference < 1) {
    erreurs.push('Le volume de référence doit être d\'au moins 1 commande par mois.');
  }
  if (!(r.arrondiCommission > 0) || !(r.arrondiPrix > 0)) {
    erreurs.push('Les pas d\'arrondi doivent être strictement positifs.');
  }
  if (!Array.isArray(r.coutsFixesMensuels) || r.coutsFixesMensuels.some((l) => !(Number(l.montant) >= 0))) {
    erreurs.push('Chaque coût fixe doit être un montant positif.');
  }
  if (!r.livraisonParVille || typeof r.livraisonParVille !== 'object'
      || Object.values(r.livraisonParVille).some((v) => !(Number(v) >= 0))) {
    erreurs.push('Chaque tarif de livraison par ville doit être un montant positif.');
  }
  {
    const d = r.livraisonDistanceBamako;
    if (!d || typeof d !== 'object'
        || !(Number(d.fraisBase) >= 0) || !(Number(d.fraisParKm) >= 0)
        || !(Number(d.fraisMinimum) >= 0) || !(Number(d.fraisMaximum) >= Number(d.fraisMinimum))) {
      erreurs.push('Le tarif de livraison à la distance (Bamako) est invalide : vérifiez que le maximum ≥ minimum.');
    }
  }
  if (!Array.isArray(r.pointsRelais) || r.pointsRelais.some((p) => !p.id || !(Number(p.frais) >= 0))) {
    erreurs.push('Chaque point relais doit avoir un identifiant et des frais positifs.');
  }
  if (!Array.isArray(r.codesPromo) || r.codesPromo.some((c) => !c.code?.trim() || !(Number(c.remise) >= 0))) {
    erreurs.push('Chaque code promo doit avoir un nom et une remise positive.');
  } else {
    const codes = r.codesPromo.map((c) => c.code.trim().toUpperCase());
    if (new Set(codes).size !== codes.length) erreurs.push('Deux codes promo portent le même nom.');
  }
  return erreurs;
}

/**
 * Complète des réglages partiels avec les valeurs par défaut. Sert au
 * chargement depuis la base : un réglage ajouté plus tard au moteur ne doit
 * pas faire tomber les calculs des installations existantes.
 */
export function completerReglages(partiels: Partial<ReglagesPlateforme> | null | undefined): ReglagesPlateforme {
  const r = { ...REGLAGES_PAR_DEFAUT, ...(partiels || {}) } as ReglagesPlateforme;
  if (!Array.isArray(r.coutsFixesMensuels)) r.coutsFixesMensuels = REGLAGES_PAR_DEFAUT.coutsFixesMensuels;
  if (!Array.isArray(r.pointsRelais)) r.pointsRelais = REGLAGES_PAR_DEFAUT.pointsRelais;
  if (!Array.isArray(r.codesPromo)) r.codesPromo = REGLAGES_PAR_DEFAUT.codesPromo;
  if (!r.livraisonParVille || typeof r.livraisonParVille !== 'object') {
    r.livraisonParVille = REGLAGES_PAR_DEFAUT.livraisonParVille;
  }
  if (!r.livraisonDistanceBamako || typeof r.livraisonDistanceBamako !== 'object') {
    r.livraisonDistanceBamako = REGLAGES_PAR_DEFAUT.livraisonDistanceBamako;
  }
  return r;
}
