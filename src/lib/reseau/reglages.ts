/**
 * Réglages du réseau — logique PURE (normalisation), testable seule.
 *
 * Tout montant venu de la base ou d'un formulaire admin passe ici : une prime
 * négative, un texte, ou un montant délirant (erreur de frappe « 200000 » au
 * lieu de « 2000 ») ne doivent jamais atteindre le grand-livre.
 */

export interface ReglagesReseau {
  /** Prime versée au parrain quand son filleul client est validé. */
  primeParrainageClient: number;
  /** Prime versée au parrain quand son filleul revendeur est validé. */
  primeParrainageRevendeur: number;

  // ── Profil « Priorité au réseau de revendeurs » (2026-09-26, lot C) ─────
  /** Boutiques fournisseurs visibles dans « près de chez moi » et la recherche. */
  annuaireFournisseurs: boolean;
  /** Achat direct depuis la boutique d'un fournisseur, pour TOUS les fournisseurs. */
  venteDirecteFournisseurs: boolean;
  /** Fournisseurs (id de profil) autorisés un par un à vendre depuis leur boutique. */
  fournisseursVenteDirecte: string[];
  /**
   * Article au prix de gros consulté sans revendeur : dès qu'un revendeur le
   * propose, le client choisit l'offre d'un revendeur (pas d'achat direct au
   * prix conseillé, qui court-circuiterait le réseau).
   */
  protectionPrixDeGros: boolean;
}

export const REGLAGES_RESEAU_DEFAUT: ReglagesReseau = {
  primeParrainageClient: 500,
  primeParrainageRevendeur: 2000,
  annuaireFournisseurs: false,
  venteDirecteFournisseurs: false,
  fournisseursVenteDirecte: [],
  protectionPrixDeGros: true,
};

/** Le client peut-il acheter directement depuis la boutique de ce fournisseur ? */
export function venteDirectePermise(r: ReglagesReseau, fournisseurId: string | null | undefined): boolean {
  return r.venteDirecteFournisseurs || Boolean(fournisseurId && r.fournisseursVenteDirecte.includes(fournisseurId));
}

/** Plafond d'une prime : au-delà, c'est une erreur de saisie, pas une décision. */
export const PRIME_MAX = 100000;

function montant(valeur: unknown, defaut: number): number {
  const n = typeof valeur === 'string' ? Number(valeur.replace(/\s/g, '')) : Number(valeur);
  if (!Number.isFinite(n) || n < 0) return defaut;
  return Math.min(PRIME_MAX, Math.round(n / 50) * 50);
}

export function normaliserReglagesReseau(brut: unknown): ReglagesReseau {
  const o = brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : {};
  const booleen = (v: unknown, defaut: boolean) => (typeof v === 'boolean' ? v : defaut);
  return {
    primeParrainageClient: montant(o.primeParrainageClient, REGLAGES_RESEAU_DEFAUT.primeParrainageClient),
    primeParrainageRevendeur: montant(o.primeParrainageRevendeur, REGLAGES_RESEAU_DEFAUT.primeParrainageRevendeur),
    annuaireFournisseurs: booleen(o.annuaireFournisseurs, REGLAGES_RESEAU_DEFAUT.annuaireFournisseurs),
    venteDirecteFournisseurs: booleen(o.venteDirecteFournisseurs, REGLAGES_RESEAU_DEFAUT.venteDirecteFournisseurs),
    fournisseursVenteDirecte: Array.isArray(o.fournisseursVenteDirecte)
      ? [...new Set(o.fournisseursVenteDirecte.filter((x): x is string => typeof x === 'string' && /^[\w-]{1,64}$/.test(x)))].slice(0, 500)
      : [],
    protectionPrixDeGros: booleen(o.protectionPrixDeGros, REGLAGES_RESEAU_DEFAUT.protectionPrixDeGros),
  };
}

export function primeDuParrainage(reglages: ReglagesReseau, type: 'customer' | 'reseller' | 'supplier'): number {
  if (type === 'reseller') return reglages.primeParrainageRevendeur;
  if (type === 'customer') return reglages.primeParrainageClient;
  // Parrainer un fournisseur se négocie au cas par cas : pas de prime automatique.
  return 0;
}
