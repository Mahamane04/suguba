/**
 * Un seul langage de l'argent (lot 2 de l'audit UI/UX du 2026-10-02,
 * REQ-UX-ARGENT-001).
 *
 * Avant : 39 petites fonctions locales (`fcfa`, `enF`, `fmt`, `k`…) et
 * 127 formatages écrits à la main donnaient « 24 000 F », « 215 000 FCFA »,
 * « 172k F » ou « 36.59 € » selon l'écran. Un client qui compare deux écrans
 * lit un changement d'unité comme une erreur.
 *
 * Règles :
 *  - francs CFA : « 24 000 F ». Espace insécable ordinaire (U+00A0) entre les
 *    milliers et avant « F » : l'espace fine d'Intl (U+202F) ne se voit
 *    presque pas après un « 1 », et le montant ne se coupe jamais en fin de ligne ;
 *  - un vrai signe moins (U+2212), jamais un tiret ;
 *  - jamais d'abréviation « k » : 172 000 F, pas 172k F ;
 *  - calcul manuel plutôt qu'Intl : même résultat sur le serveur et dans le
 *    navigateur, donc pas d'écart d'hydratation.
 */

const ESPACE = ' ';

function grouper(entier: number): string {
  return String(entier).replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE);
}

/** « 24 000 » : le nombre seul, quand l'unité est affichée à part (plus petite). */
export function formatNombre(valeur: number | null | undefined): string {
  if (valeur == null || !Number.isFinite(Number(valeur))) return '—';
  const arrondi = Math.round(Number(valeur));
  return `${arrondi < 0 ? '−' : ''}${grouper(Math.abs(arrondi))}`;
}

/** « 24 000 F ». Montant inconnu : « — » (jamais « NaN F » ni un faux 0). */
export function formatF(valeur: number | null | undefined): string {
  const nombre = formatNombre(valeur);
  return nombre === '—' ? nombre : `${nombre}${ESPACE}F`;
}

/**
 * Montant converti pour la diaspora (« 36,59 € », « 40,03 $ US »), avec la
 * virgule française. Convertir le TOTAL en une fois, pas chaque ligne : les
 * arrondis ligne à ligne faisaient un centime d'écart avec le bouton.
 */
export function formatDevise(valeur: number, devise: 'EUR' | 'USD'): string {
  if (!Number.isFinite(valeur)) return '—';
  const texte = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valeur);
  return texte.replace(/[  ]/g, ESPACE);
}

/**
 * Formats de date, à passer à `toLocaleDateString` / `toLocaleString`.
 * Avant : neuf variantes (« 1 oct., 05:53 », « 01/10/26 05:55 », « 01/10 05:19 »,
 * « 1 oct. 2026 », « 15/10/2026 »…). Deux familles suffisent :
 *  - dans une liste : `jour` (1 oct.) ou `jourHeure` (1 oct., 05:53) ;
 *  - dans un détail ou un document : `complet` (1 oct. 2026) ou
 *    `completHeure` (1 oct. 2026, 05:53).
 */
export const FORMAT_DATE = {
  jour: { day: 'numeric', month: 'short' },
  jourHeure: { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
  complet: { day: 'numeric', month: 'short', year: 'numeric' },
  completHeure: { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

/** Date lisible ; valeur absente ou illisible : « — ». */
export function formatDate(valeur: string | number | Date | null | undefined, format: keyof typeof FORMAT_DATE = 'jour'): string {
  if (valeur == null || valeur === '') return '—';
  const date = valeur instanceof Date ? valeur : new Date(valeur);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', FORMAT_DATE[format]);
}
