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
}

export const REGLAGES_RESEAU_DEFAUT: ReglagesReseau = {
  primeParrainageClient: 500,
  primeParrainageRevendeur: 2000,
};

/** Plafond d'une prime : au-delà, c'est une erreur de saisie, pas une décision. */
export const PRIME_MAX = 100000;

function montant(valeur: unknown, defaut: number): number {
  const n = typeof valeur === 'string' ? Number(valeur.replace(/\s/g, '')) : Number(valeur);
  if (!Number.isFinite(n) || n < 0) return defaut;
  return Math.min(PRIME_MAX, Math.round(n / 50) * 50);
}

export function normaliserReglagesReseau(brut: unknown): ReglagesReseau {
  const o = brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : {};
  return {
    primeParrainageClient: montant(o.primeParrainageClient, REGLAGES_RESEAU_DEFAUT.primeParrainageClient),
    primeParrainageRevendeur: montant(o.primeParrainageRevendeur, REGLAGES_RESEAU_DEFAUT.primeParrainageRevendeur),
  };
}

export function primeDuParrainage(reglages: ReglagesReseau, type: 'customer' | 'reseller' | 'supplier'): number {
  if (type === 'reseller') return reglages.primeParrainageRevendeur;
  if (type === 'customer') return reglages.primeParrainageClient;
  // Parrainer un fournisseur se négocie au cas par cas : pas de prime automatique.
  return 0;
}
