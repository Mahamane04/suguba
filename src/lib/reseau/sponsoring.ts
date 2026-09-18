/**
 * Sponsorisation et publicité interne — logique PURE (§ 16 à § 18, § V).
 */

export type Emplacement =
  | 'home_hero' | 'home_products' | 'reseller_dashboard'
  | 'search_top' | 'category_top' | 'recommendations';

/**
 * Emplacements VENDABLES : chacun correspond à un endroit de l'application qui
 * affiche réellement les produits sponsorisés. « recommendations » reste dans
 * le type pour l'avenir, mais n'est pas proposé tant qu'aucune zone de
 * suggestions n'existe — on ne vend pas un emplacement qui n'affiche rien.
 */
export const EMPLACEMENTS: { valeur: Emplacement; libelle: string; description: string }[] = [
  { valeur: 'home_hero',          libelle: 'Accueil — bandeau',     description: 'En haut de la page d’accueil.' },
  { valeur: 'home_products',      libelle: 'Accueil — produits',    description: 'Parmi les produits de l’accueil.' },
  { valeur: 'reseller_dashboard', libelle: 'Espace revendeur',      description: 'Dans le tableau de bord des revendeurs.' },
  { valeur: 'search_top',         libelle: 'Résultats de recherche', description: 'En tête des résultats.' },
  { valeur: 'category_top',       libelle: 'Haut de catégorie',     description: 'En tête d’une catégorie.' },
];

export interface Sponsorisation {
  id: string;
  sujetRef: string | null;
  emplacement: string;
  statut: string;
  commenceLe: string;
  finitLe: string | null;
}

/** Une sponsorisation est-elle en cours à cet instant ? */
export function sponsorisationActive(s: Sponsorisation, maintenant: Date): boolean {
  if (s.statut !== 'active') return false;
  const debut = new Date(s.commenceLe).getTime();
  if (Number.isFinite(debut) && debut > maintenant.getTime()) return false;
  if (s.finitLe) {
    const fin = new Date(s.finitLe).getTime();
    if (Number.isFinite(fin) && fin <= maintenant.getTime()) return false;
  }
  return true;
}

/**
 * Remonte en tête les éléments sponsorisés, en gardant l'ordre d'origine du
 * reste. Deux garde-fous :
 *   — un plafond (`maxSponsorises`) : une page entièrement payante n'est plus
 *     un catalogue, le client le sent immédiatement et s'en va ;
 *   — les sponsorisés sont MARQUÉS. Une publicité qu'on ne peut pas
 *     distinguer d'un résultat naturel trompe le client.
 */
export function classerAvecSponsorises<T extends { id: string }>(
  elements: T[],
  refsSponsorisees: string[],
  maxSponsorises = 3,
): { element: T; sponsorise: boolean }[] {
  const ensemble = new Set(refsSponsorisees);
  const enAvant: { element: T; sponsorise: boolean }[] = [];
  const reste: { element: T; sponsorise: boolean }[] = [];

  for (const e of elements) {
    if (ensemble.has(e.id) && enAvant.length < maxSponsorises) enAvant.push({ element: e, sponsorise: true });
    else reste.push({ element: e, sponsorise: false });
  }
  return [...enAvant, ...reste];
}

/** Date de fin d'un pack, calculée à partir de sa durée. */
export function finDuPack(debut: Date, jours: number): string {
  const fin = new Date(debut.getTime() + Math.max(1, jours) * 86400000);
  return fin.toISOString();
}
