/**
 * Rémunération au résultat (2026-09-26, lot 3) — constantes et règles PURES,
 * utilisables aussi dans le navigateur (aucun module Node).
 *
 * Les montants et délais vivent AUSSI dans la base
 * (A-EXECUTER-2026-09-26-campagnes-resultat.sql), qui fait foi pour le
 * paiement : ceux d'ici servent à l'affichage et aux contrôles de saisie.
 */

export const TYPES_RESULTAT = ['visite_qualifiee', 'demande_qualifiee'] as const;
export type TypeResultat = (typeof TYPES_RESULTAT)[number];
export const estTypeResultat = (t: unknown): t is TypeResultat => TYPES_RESULTAT.includes(t as TypeResultat);

/** Prix minimum payé par le fournisseur pour un résultat. */
export const PRIX_MIN: Record<TypeResultat, number> = { visite_qualifiee: 25, demande_qualifiee: 500 };
export const PRIX_MAX: Record<TypeResultat, number> = { visite_qualifiee: 5_000, demande_qualifiee: 100_000 };
/** Part gardée par Suguba ; le revendeur reçoit le reste. */
export const PART_SUGUBA = 0.2;
export const DELAI_GARANTIE_JOURS = 7;
export const DELAI_CONTESTATION_H = 48;
export const PLAFOND_VISITES_JOUR = 50;
/** Une visite est qualifiée après ce temps sur la page ET un geste (toucher, défiler). */
export const DUREE_MIN_VISITE_S = 20;
/** Au-delà, le jeton de début de visite a expiré. */
export const DUREE_MAX_VISITE_S = 2 * 3600;

export const LIBELLE_RESULTAT: Record<TypeResultat, { court: string; unite: string }> = {
  visite_qualifiee: { court: 'Visites qualifiées', unite: 'visite' },
  demande_qualifiee: { court: 'Demandes qualifiées', unite: 'demande' },
};

/** Ce que reçoit le revendeur pour un résultat (même arrondi que la base). */
export function partRevendeur(prix: number): number {
  return Math.floor((Number(prix) || 0) * (1 - PART_SUGUBA));
}

/** Prix saisi par le fournisseur : entier, arrondi à 5 F, borné. null = refusé. */
export function prixResultat(type: TypeResultat, brut: unknown): number | null {
  const n = Math.round((Number(brut) || 0) / 5) * 5;
  if (!Number.isFinite(n) || n < PRIX_MIN[type] || n > PRIX_MAX[type]) return null;
  return n;
}

/** Le fournisseur peut-il encore contester ce résultat ? */
export function contestable(statut: string, creeLe: string, maintenant = Date.now()): boolean {
  return ['retenu', 'a_verifier'].includes(statut) && maintenant - Date.parse(creeLe) <= DELAI_CONTESTATION_H * 3_600_000;
}

/** Taux de visites qualifiées (0–100), pour la page « Qualité des mesures ». */
export function tauxQualification(ouvertes: number, qualifiees: number): number | null {
  const total = ouvertes + qualifiees;
  return total > 0 ? Math.round((qualifiees / total) * 100) : null;
}
