/**
 * Recherche R1 (2026-09-26) — règles de texte PURES, utilisables dans le
 * navigateur. Elles reproduisent celles de la base
 * (A-EXECUTER-2026-09-26-recherche.sql) : sans accents, en minuscules, les
 * petits mots (« de », « la »…) ignorés.
 */

/** Petits mots ignorés — même liste que la fonction rechercher_produits. */
const MOTS_VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'en', 'pour', 'avec', 'au', 'aux']);

/** « Réfrigérateur  ÉTÉ » → « refrigerateur ete ». */
export function normaliserRecherche(texte: string): string {
  return String(texte || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Mots utiles d'une requête, comme la base les découpe. */
export function motsUtiles(texte: string): string[] {
  return [...new Set(normaliserRecherche(texte).split(/[^a-z0-9]+/).filter((m) => m.length >= 2 && !MOTS_VIDES.has(m)))];
}

/** Mot tapé par les clients (synonyme) : un seul mot, 2 à 30 caractères. */
export function normaliserTerme(texte: string): string | null {
  const t = normaliserRecherche(texte);
  return /^[a-z0-9]{2,30}$/.test(t) ? t : null;
}

/** Mot du catalogue correspondant : un ou plusieurs mots (« micro-ondes »). */
export function normaliserEquivalent(texte: string): string | null {
  const t = normaliserRecherche(texte);
  return /^[a-z0-9]([a-z0-9 -]{0,58}[a-z0-9])?$/.test(t) ? t : null;
}

/**
 * Recherche de secours dans le navigateur (connexion coupée) : tous les mots
 * utiles doivent se trouver dans le nom, la description ou la catégorie.
 * Sans synonymes ni tolérance aux fautes — celles-ci restent côté serveur.
 */
export function correspondLocalement(p: { name: string; description?: string; category?: string }, requete: string): boolean {
  const mots = motsUtiles(requete);
  if (!mots.length) return true;
  const doc = normaliserRecherche(`${p.name} ${p.description || ''} ${p.category || ''}`);
  return mots.every((m) => doc.includes(m));
}
