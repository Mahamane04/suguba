import type { ReglagesPlateforme } from './pricing';

/**
 * Protection Suguba — lot 3 (2026-09-26) — règles PURES, testables seules,
 * utilisables dans le navigateur.
 */

// ── 1. Baisse de la part Suguba ─────────────────────────────────────────────
export interface ChangementPart { cle: string; libelle: string; avant: unknown; apres: unknown }

const nombre = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Changements de réglages qui RÉDUISENT ce que Suguba gagne sur une vente.
 * Vide = rien à justifier. Une hausse, ou un réglage sans effet sur la part
 * Suguba (livraison, arrondis…), ne demande ni droit dédié ni motif.
 */
export function baissesPartSuguba(avant: Partial<ReglagesPlateforme>, apres: Partial<ReglagesPlateforme>): ChangementPart[] {
  const l: ChangementPart[] = [];
  const baisse = (cle: keyof ReglagesPlateforme, libelle: string) => {
    if (nombre(apres[cle]) < nombre(avant[cle])) l.push({ cle, libelle, avant: avant[cle], apres: apres[cle] });
  };
  const hausse = (cle: keyof ReglagesPlateforme, libelle: string) => {
    if (nombre(apres[cle]) > nombre(avant[cle])) l.push({ cle, libelle, avant: avant[cle], apres: apres[cle] });
  };
  baisse('margeNetteMinPct', 'Marge nette minimale de Suguba');
  hausse('partRevendeurPct', 'Part du reste versée au revendeur');
  hausse('commissionCiblePct', 'Commission revendeur visée');
  baisse('tauxPartSuguba', 'Taux de la part Suguba');
  baisse('minimumPartSuguba', 'Part minimale de Suguba par article');
  baisse('fraisRetraitSugubaPct', 'Frais Suguba sur les retraits');
  if ((avant.modePartSuguba || 'auto') !== (apres.modePartSuguba || 'auto')) {
    l.push({ cle: 'modePartSuguba', libelle: 'Mode de rémunération de Suguba', avant: avant.modePartSuguba, apres: apres.modePartSuguba });
  }
  if (avant.couvrirCoutsDansLePrix === true && apres.couvrirCoutsDansLePrix !== true) {
    l.push({ cle: 'couvrirCoutsDansLePrix', libelle: 'Coûts de Suguba couverts par le prix client', avant: true, apres: false });
  }
  const g0 = avant.prixDeGros; const g1 = apres.prixDeGros;
  if (g0 && g1) {
    if (g0.modeGain !== g1.modeGain) l.push({ cle: 'prixDeGros.modeGain', libelle: 'Gain de Suguba sur les articles au prix de gros', avant: g0.modeGain, apres: g1.modeGain });
    else if (g1.modeGain !== 'aucun') {
      if (nombre(g1.taux) < nombre(g0.taux)) l.push({ cle: 'prixDeGros.taux', libelle: 'Taux Suguba sur le prix de gros', avant: g0.taux, apres: g1.taux });
      if (nombre(g1.montantFixe) < nombre(g0.montantFixe)) l.push({ cle: 'prixDeGros.montantFixe', libelle: 'Montant Suguba par article au prix de gros', avant: g0.montantFixe, apres: g1.montantFixe });
    }
  }
  // Code promo : la remise est financée par la part Suguba.
  const codes0 = new Map((avant.codesPromo || []).map((c) => [String(c.code).toUpperCase(), c]));
  for (const c of apres.codesPromo || []) {
    if (!c.actif) continue;
    const ancien = codes0.get(String(c.code).toUpperCase());
    if (!ancien || !ancien.actif || nombre(c.remise) > nombre(ancien.remise)) {
      l.push({ cle: `codePromo.${c.code}`, libelle: `Code promo ${c.code}`, avant: ancien?.actif ? ancien.remise : null, apres: c.remise });
    }
  }
  return l;
}

// ── 2. Messagerie : ce qui doit être vérifié avant d'être remis ─────────────
export type MotifMessage = 'telephone' | 'email' | 'lien' | 'contournement';

const MOTS_CONTOURNEMENT = [
  'whatsapp', 'watsap', 'wathsapp', 'appelle moi', 'appelez moi', 'mon numero', 'mon contact', 'ton numero', 'votre numero',
  'hors suguba', 'sans suguba', 'sans passer par', 'directement chez moi', 'paye moi', 'payez moi', 'paie moi',
  'payer directement', 'payez directement', 'orange money direct', 'moov money direct', 'entre nous', 'mon adresse', 'mon magasin',
];

const normaliser = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'\-]/g, ' ').replace(/\s+/g, ' ');

/**
 * Motifs qui font attendre un message la vérification de l'équipe. Une
 * référence de pièce ou un numéro de série (lettres et chiffres mêlés) ne
 * ressemble pas à un téléphone : il passe.
 */
export function analyserMessage(texte: string): MotifMessage[] {
  const motifs = new Set<MotifMessage>();
  const t = String(texte || '');
  // Téléphone : 8 chiffres maliens (5 à 9 en tête), avec ou sans +223 et
  // séparateurs ; ou tout numéro international long.
  const colle = t.replace(/(\d)[\s.\-/]+(?=\d)/g, '$1');
  if (/(?:^|[^\dA-Za-z])(?:\+?223|00223)?[5-9]\d{7}(?![\dA-Za-z])/.test(colle) || /\+\d{9,15}/.test(colle)) motifs.add('telephone');
  if (/[\w.+-]+@[\w-]+\.[\w.]{2,}/.test(t)) motifs.add('email');
  if (/(https?:\/\/|www\.|wa\.me|t\.me|chat\.whatsapp|facebook\.com|fb\.me|instagram\.com|tiktok\.com)/i.test(t)) motifs.add('lien');
  const norme = normaliser(t);
  if (MOTS_CONTOURNEMENT.some((m) => norme.includes(normaliser(m)))) motifs.add('contournement');
  return [...motifs];
}

export const LIBELLE_MOTIF: Record<MotifMessage, string> = {
  telephone: 'numéro de téléphone', email: 'adresse e-mail', lien: 'lien externe', contournement: 'invitation à traiter hors Suguba',
};
