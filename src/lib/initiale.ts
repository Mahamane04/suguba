/**
 * Lettre d'un avatar (lot 7 de l'audit UI/UX du 2026-10-02) — règle PURE.
 *
 * Les avatars prenaient le premier caractère du nom : « [QA] Boutique Kadi »
 * donnait « [ », « « Chez Awa » » un guillemet. On prend la première lettre ou
 * le premier chiffre, en majuscule ; « · » si le nom n'en contient pas.
 */
export function initiale(nom: string | null | undefined): string {
  const m = String(nom || '').match(/[\p{L}\p{N}]/u);
  return m ? m[0].toLocaleUpperCase('fr') : '·';
}
