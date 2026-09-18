/**
 * Distance entre le bas de l'écran et une barre d'action flottante
 * (« Confirmer », « Valider la vente »…) sur téléphone — 2026-09-18.
 *
 * Collées au bord, ces barres passaient sous les coins arrondis et la barre
 * d'accueil de l'iPhone. `env(safe-area-inset-bottom)` ne suffit pas : il
 * vaut 0 tant que le viewport n'est pas en `viewport-fit=cover` (c'est le cas
 * ici). D'où un MINIMUM garanti de 20 px, et la marge système + 12 px quand
 * iOS la fournit.
 */
export const MARGE_BAS_FLOTTANT = 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))';
