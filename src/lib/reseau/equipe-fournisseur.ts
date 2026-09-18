/**
 * Équipe fournisseur (§ F) — droits par rôle, logique PURE.
 *
 * Le propriétaire a tout. Chaque collaborateur n'a que ce que son métier
 * exige : le magasinier met à jour le stock mais ne lance pas de
 * sponsorisation payante ; le commercial suit les revendeurs mais ne modifie
 * pas les prix.
 */

export type RoleCollaborateur = 'commercial' | 'stock' | 'marketing';
export type RoleEquipeFournisseur = 'proprietaire' | RoleCollaborateur;

export type DroitFournisseur =
  | 'catalogue'       // créer/modifier des produits, photos, stock
  | 'boutique'        // page publique, galerie, recrutement
  | 'revendeurs'      // voir le réseau de revendeurs
  | 'sponsorisation'  // demander une sponsorisation (dépense)
  | 'analyses'        // voir les chiffres
  | 'fiche'           // coordonnées officielles, quartier de l'entrepôt
  | 'equipe';         // inviter / retirer des collaborateurs

export const ROLES_COLLABORATEUR: { valeur: RoleCollaborateur; libelle: string; description: string; droits: DroitFournisseur[] }[] = [
  {
    valeur: 'commercial', libelle: 'Commercial',
    description: 'Suit les revendeurs et les ventes, anime la boutique.',
    droits: ['revendeurs', 'analyses', 'boutique'],
  },
  {
    valeur: 'stock', libelle: 'Gestion du stock',
    description: 'Ajoute les produits, les photos et met à jour le stock.',
    droits: ['catalogue'],
  },
  {
    valeur: 'marketing', libelle: 'Marketing',
    description: 'Boutique, galerie, sponsorisations et chiffres.',
    droits: ['boutique', 'sponsorisation', 'analyses'],
  },
];

const TOUS: DroitFournisseur[] = ['catalogue', 'boutique', 'revendeurs', 'sponsorisation', 'analyses', 'fiche', 'equipe'];

export function droitsDuRole(role: RoleEquipeFournisseur): DroitFournisseur[] {
  if (role === 'proprietaire') return TOUS;
  return ROLES_COLLABORATEUR.find((r) => r.valeur === role)?.droits ?? [];
}

export function estRoleCollaborateur(valeur: unknown): valeur is RoleCollaborateur {
  return ROLES_COLLABORATEUR.some((r) => r.valeur === valeur);
}

/** Nombre maximum de collaborateurs actifs ou invités par fournisseur. */
export const MAX_COLLABORATEURS = 10;
