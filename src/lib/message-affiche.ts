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
const GRAND_NOMBRE = /\d{1,3}(?:[\s.,]\d{3})+|\d{3,}/;
const BAISSE = /(?:^|[\s(])[-−–]\s*\d|\bmoins\s+\d/i;
// … ou un nombre avec un mot de remise (« Promo 30 ce week-end », « Remise 20 »,
// « Soldes 50 », « 1 acheté 1 offert ») : une remise chiffrée, même sans « % » ni
// unité (relecture du lot 3). Le message fait 40 caractères au plus : tout nombre
// y est « près » du mot. Accents retirés avant la comparaison (« réduc », « reduc »).
const MOT_REMISE = /\b(?:promos?|promotions?|remises?|soldes?|reduc|reducs|reductions?|rabais|discounts?|offerte?s?)\b/i;
// « 2 pour 1 », « 1 = 2 » : une offre chiffrée, même sans mot de remise.
const N_POUR_M = /\d\s*(?:pour|=)\s*\d/i;

/** null si le message peut être imprimé, sinon la raison du refus (affichée sous le champ). */
export function refusMessageAffiche(texte: string | null | undefined): string | null {
  const t = String(texte || '').trim();
  if (!t) return null;
  if (t.length > MESSAGE_AFFICHE_MAX) return `${MESSAGE_AFFICHE_MAX} caractères au plus.`;
  if (POURCENTAGE.test(t)) return 'Pas de pourcentage : Suguba n’applique pas de remise sur cette affiche.';
  if (MONTANT_MONNAIE.test(t) || MILLIERS_K.test(t) || GRAND_NOMBRE.test(t) || BAISSE.test(t)) {
    return 'Pas de prix ni de montant : le vrai prix est déjà sur l’affiche.';
  }
  const sansAccents = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if ((/\d/.test(t) && MOT_REMISE.test(sansAccents)) || N_POUR_M.test(t)) {
    return 'Pas de remise chiffrée : Suguba n’applique pas de remise sur cette affiche.';
  }
  return null;
}
