/**
 * « Message » des affiches du créateur de visuels (lot 3 du chantier boutique,
 * 2026-10-03) — règle PURE, partagée par l'écran et le dessin de l'affiche.
 *
 * L'ancien « Bandeau promo » laissait écrire « -10 % ce week-end » ou « 5 000 F
 * seulement » sur une affiche dont le prix réel, imprimé dessous, ne changeait
 * pas : le client lisait une remise que Suguba n'applique pas. Décision du
 * fondateur : le bandeau devient « Message » et refuse les pourcentages et les
 * montants, tant qu'il n'y a pas de vraies promotions (hors de ce chantier).
 * « Nouveau », « Stock limité », « Livré en 24 h » restent permis.
 */

export const MESSAGE_AFFICHE_MAX = 40;

const POURCENTAGE = /%|\bpour\s*-?\s*cents?\b|\bpourcents?\b/i;
// Un nombre suivi d'une monnaie (« 5 000 F », « 2500fr », « 10 000 francs », « 5k F »)…
const MONTANT_MONNAIE = /\d[\d\s.,]*\s*(?:k\s*)?(?:f\b|fr\b|frs\b|francs?\b|f?\s*cfa\b|xof\b|€|\$|mille\b)/i;
// … des milliers en « k » : au moins 2 chiffres (« 10k », « 25 k ») ou un décimal
// (« 2,5k »). Relecture du lot 3 (2026-10-03) : « k » seul refusait « Télé 4K » ou
// « Écran 8K », qui ne sont pas des prix.
const MILLIERS_K = /(?:\d{2,}|\d+[.,]\d+)\s*k\b/i;
// … un grand nombre (« 5000 », « 15.000 », « 2 500 ») ou une baisse chiffrée (« -10 », « moins 500 »).
// Relecture du lot 5 (2026-10-03) : le grand nombre se lit en deux temps. Milliers
// séparés (« 5 000 », « 15.000 ») : toujours un prix. Nombre d'un seul tenant
// (« 5000 ») : un prix sur une affiche, pas dans un nom de boutique (« Bamako 2000 »,
// « Mode 223 ») — voir promesseChiffree.
const MILLIERS_SEPARES = /\d{1,3}(?:[\s.,]\d{3})+/;
const NOMBRE_SEUL = /\d{3,}/;
const BAISSE = /(?:^|[\s(])[-−–]\s*\d|\bmoins\s+\d/i;
// … ou un nombre avec un mot de remise (« Promo 30 ce week-end », « Remise 20 »,
// « Soldes 50 », « 1 acheté 1 offert ») : une remise chiffrée, même sans « % » ni
// unité (relecture du lot 3). Le message fait 40 caractères au plus : tout nombre
// y est « près » du mot. Accents retirés avant la comparaison (« réduc », « reduc »).
const MOT_REMISE = /\b(?:promos?|promotions?|remises?|soldes?|reduc|reducs|reductions?|rabais|discounts?|offerte?s?)\b/i;
// « 2 pour 1 », « 1 = 2 » : une offre chiffrée, même sans mot de remise.
const N_POUR_M = /\d\s*(?:pour|=)\s*\d/i;

/** Ce qu'un texte court annonce à tort. */
export type PromesseChiffree = 'pourcentage' | 'montant' | 'remise';

/**
 * Le texte annonce-t-il un pourcentage, un prix ou une remise chiffrée ? null sinon.
 *
 * Relecture du lot 5 (2026-10-03) : la règle du message des affiches sert aussi
 * au titre de l'annonce aux abonnés (« Nouveautés chez <nom de la boutique> »,
 * voir annonce-boutique.ts) — un seul langage pour « ni prix, ni remise ».
 * `nombreSeul: false` laisse passer un nombre d'un seul tenant, sans monnaie
 * (« Bamako 2000 », « Mode 223 » sont de vrais noms de boutique) ; sur une
 * affiche, il reste refusé.
 */
export function promesseChiffree(texte: string | null | undefined, options: { nombreSeul?: boolean } = {}): PromesseChiffree | null {
  const t = String(texte || '').trim();
  if (!t) return null;
  if (POURCENTAGE.test(t)) return 'pourcentage';
  const grandNombre = MILLIERS_SEPARES.test(t) || (options.nombreSeul !== false && NOMBRE_SEUL.test(t));
  if (MONTANT_MONNAIE.test(t) || MILLIERS_K.test(t) || grandNombre || BAISSE.test(t)) return 'montant';
  const sansAccents = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if ((/\d/.test(t) && MOT_REMISE.test(sansAccents)) || N_POUR_M.test(t)) return 'remise';
  return null;
}

const REFUS: Record<PromesseChiffree, string> = {
  pourcentage: 'Pas de pourcentage : Suguba n’applique pas de remise sur cette affiche.',
  montant: 'Pas de prix ni de montant : le vrai prix est déjà sur l’affiche.',
  remise: 'Pas de remise chiffrée : Suguba n’applique pas de remise sur cette affiche.',
};

/** null si le message peut être imprimé, sinon la raison du refus (affichée sous le champ). */
export function refusMessageAffiche(texte: string | null | undefined): string | null {
  const t = String(texte || '').trim();
  if (!t) return null;
  if (t.length > MESSAGE_AFFICHE_MAX) return `${MESSAGE_AFFICHE_MAX} caractères au plus.`;
  const promesse = promesseChiffree(t);
  return promesse ? REFUS[promesse] : null;
}
