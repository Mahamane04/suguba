/**
 * Ce que le fournisseur doit faire maintenant (FOU-01, FOU-02, lot 4 de l'audit
 * UI/UX du 2026-10-02).
 *
 * Avant : l'accueil montrait des statistiques de catalogue pendant qu'un livreur
 * attendait au dépôt ; dans « Commandes », le seul colis urgent arrivait en
 * douzième position, et « À préparer (24) » comptait des commandes que le client
 * n'avait même pas encore confirmées (rien à faire pour le fournisseur).
 */

export interface CommandeAFaire {
  id: string;
  numero: string;
  produit: string;
  quantite: number;
  statut: string;
  modeRemise?: string | null;
  recupereeLe?: string | null;
  codeRamassage?: string | null;
  livreur?: string | null;
}

/**
 * 0 livreur en route : le code de ramassage est à donner ·
 * 1 colis à préparer, ou remise à organiser / à faire par le fournisseur ·
 * 2 récupérée, en livraison · 3 client pas encore confirmé (rien à faire) ·
 * 4 terminée (livrée, annulée, retournée).
 */
export type Priorite = 0 | 1 | 2 | 3 | 4;

export function prioriteCommande(c: CommandeAFaire): Priorite {
  if (['delivered', 'cancelled', 'returned'].includes(c.statut)) return 4;
  const remiseParMoi = Boolean(c.modeRemise) && c.modeRemise !== 'livreur';
  if (remiseParMoi && ['confirmed', 'dispatched', 'in_transit'].includes(c.statut)) return 1;
  if (c.recupereeLe || c.statut === 'in_transit') return 2;
  if (c.statut === 'dispatched') return c.codeRamassage ? 0 : 1;
  if (c.statut === 'confirmed') return 1;
  return 3;
}

/** Une action du fournisseur est-elle attendue sur cette commande ? */
export const demandeAction = (c: CommandeAFaire) => prioriteCommande(c) <= 1;

/** Tri stable : le plus urgent d'abord, puis l'ordre reçu (le plus récent). */
export function trierParUrgence<T extends CommandeAFaire>(commandes: T[]): T[] {
  return commandes.map((c, i) => ({ c, i })).sort((a, b) => prioriteCommande(a.c) - prioriteCommande(b.c) || a.i - b.i).map(({ c }) => c);
}

export function resumeAFaire(commandes: CommandeAFaire[]) {
  return {
    livreursEnRoute: commandes.filter((c) => prioriteCommande(c) === 0),
    aPreparer: commandes.filter((c) => prioriteCommande(c) === 1),
    enAttenteClient: commandes.filter((c) => prioriteCommande(c) === 3).length,
  };
}
