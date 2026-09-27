/**
 * Unité de vente (V2 vue client, 2026-09-27) — règles PURES, utilisables
 * partout (navigateur, serveur, tests).
 *
 * Une photo de quatre cartouches ne dit pas si le prix vaut pour une
 * cartouche ou pour les quatre : l'unité est écrite à côté du prix
 * (« 36 500 F / lot de 4 »). Sans unité renseignée (anciens produits), rien
 * n'est affiché plutôt qu'une unité devinée.
 */

export const UNITES_VENTE = ['unite', 'lot', 'paquet', 'carton', 'paire', 'kg', 'litre', 'metre'] as const;
export type UniteVente = (typeof UNITES_VENTE)[number];

/** Unités qui ont un contenu (« lot de 4 », « carton de 12 »). */
const AVEC_CONTENU: UniteVente[] = ['lot', 'paquet', 'carton'];

export const LIBELLES_UNITE: Record<UniteVente, string> = {
  unite: 'À l’unité',
  lot: 'Par lot',
  paquet: 'Par paquet',
  carton: 'Par carton',
  paire: 'Par paire',
  kg: 'Au kilo',
  litre: 'Au litre',
  metre: 'Au mètre',
};

export function uniteAvecContenu(unite: UniteVente | null | undefined): boolean {
  return Boolean(unite && AVEC_CONTENU.includes(unite));
}

/**
 * Valeurs saisies → valeurs enregistrées, ou message d'erreur.
 * null = unité non renseignée (on n'invente rien).
 */
export function normaliserUniteVente(unite: unknown, contenu: unknown):
  { ok: true; unite: UniteVente | null; contenu: number | null } | { ok: false; erreur: string } {
  if (unite === null || unite === undefined || unite === '') return { ok: true, unite: null, contenu: null };
  if (!UNITES_VENTE.includes(unite as UniteVente)) return { ok: false, erreur: 'Unité de vente inconnue.' };
  const u = unite as UniteVente;
  if (u === 'lot') {
    const n = Number(contenu);
    if (!Number.isInteger(n) || n < 2 || n > 10000) return { ok: false, erreur: 'Indiquez combien d’articles contient le lot (2 ou plus).' };
    return { ok: true, unite: u, contenu: n };
  }
  if (AVEC_CONTENU.includes(u)) {
    if (contenu === null || contenu === undefined || contenu === '') return { ok: true, unite: u, contenu: null };
    const n = Number(contenu);
    if (!Number.isInteger(n) || n < 2 || n > 10000) return { ok: false, erreur: 'Le contenu doit être un nombre entier de 2 ou plus.' };
    return { ok: true, unite: u, contenu: n };
  }
  return { ok: true, unite: u, contenu: null };
}

/** Texte à côté du prix : « / lot de 4 », « / kg »… ; vide si non renseignée. */
export function suffixeUnite(unite: UniteVente | null | undefined, contenu?: number | null): string {
  if (!unite) return '';
  switch (unite) {
    case 'unite': return '/ unité';
    case 'lot': return contenu ? `/ lot de ${contenu}` : '/ lot';
    case 'paquet': return contenu ? `/ paquet de ${contenu}` : '/ paquet';
    case 'carton': return contenu ? `/ carton de ${contenu}` : '/ carton';
    case 'paire': return '/ paire';
    case 'kg': return '/ kg';
    case 'litre': return '/ litre';
    case 'metre': return '/ mètre';
  }
}

/** Valeur lue en base → unité connue ou null. */
export function lireUniteVente(valeur: unknown): UniteVente | null {
  return UNITES_VENTE.includes(valeur as UniteVente) ? (valeur as UniteVente) : null;
}

/**
 * Peut-on ajouter l'article au panier directement depuis la carte ? Oui pour
 * une offre simple : en stock, achat direct (pas de devis), prix fixe (au prix
 * de gros, le client choisit l'offre d'un revendeur sur la fiche), sans
 * variantes à choisir, remise par Suguba (sans étapes de prestation).
 */
export function ajoutDirectPossible(p: {
  enStock: boolean; modeCommande?: string; modePrix?: string; variantes?: boolean; modeRemise?: string;
}): boolean {
  return p.enStock && p.modeCommande !== 'devis' && p.modePrix !== 'gros' && !p.variantes && (p.modeRemise ?? 'livreur') === 'livreur';
}
