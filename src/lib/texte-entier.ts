/**
 * Texte « entier » (relecture du lot 5 du chantier boutique, 2026-10-03) — règles
 * PURES, utilisables côté serveur comme dans un composant client.
 *
 * Un emoji occupe DEUX unités dans une chaîne JavaScript. Couper un texte avec
 * `.slice(0, 60)` peut tomber entre les deux et laisser une demi-paire isolée. Or :
 *  - `encodeURIComponent` la refuse (URIError). Le lien « Publier sur mon statut
 *    WhatsApp » étant composé au rendu, « Mes articles » et « Statistiques »
 *    tombaient au chargement pour tout revendeur dont un article récent portait
 *    un emoji à cheval sur la coupe — et ce nom vient du fournisseur ;
 *  - Postgres la refuse dans un texte : la notification n'était jamais écrite
 *    (« Vos abonnés n'ont pas pu être prévenus », à chaque essai).
 */

/**
 * Retire les demi-paires isolées ; un emoji entier est gardé. Avec le drapeau
 * `u`, une paire entière est UN seul caractère, hors de cette plage : seules les
 * demi-paires isolées correspondent.
 */
export function texteBienForme(texte: unknown): string {
  return String(texte ?? '').replace(/[\uD800-\uDFFF]/gu, '');
}

/** `max` unités au plus, sans jamais couper un emoji en deux (il part alors en entier). */
export function couperTexte(texte: unknown, max: number): string {
  return texteBienForme(texteBienForme(texte).slice(0, max));
}
