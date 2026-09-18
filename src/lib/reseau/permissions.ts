/**
 * Équipe administrative — RBAC (§ 23 et § D du cahier des charges).
 *
 * Logique PURE : cette liste est la référence unique de ce qu'un membre de
 * l'équipe a le droit de faire. Les routes API demandent une permission
 * nommée, jamais « est-ce un admin ? » — c'est ce qui permettra d'ouvrir un
 * compte Support ou Finance sans lui donner les clés de toute la plateforme.
 */

export const PERMISSIONS = [
  'commande.lire', 'commande.modifier',
  'produit.lire', 'produit.moderer', 'produit.prix',
  'boutique.lire', 'boutique.moderer',
  'utilisateur.lire', 'utilisateur.moderer', 'utilisateur.promouvoir',
  'finance.lire', 'finance.payer', 'commission.configurer',
  'marketing.lire', 'marketing.gerer',
  'mission.gerer', 'sponsorisation.gerer', 'publicite.gerer',
  'verification.lire', 'verification.decider',
  'livraison.lire', 'livraison.gerer',
  'plateforme.parametres', 'plateforme.equipe',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type RoleEquipe =
  | 'super_admin' | 'responsable_fournisseurs' | 'responsable_revendeurs'
  | 'support' | 'responsable_livraison' | 'finance' | 'marketing' | 'moderateur';

export const ROLES_EQUIPE: { valeur: RoleEquipe; libelle: string; description: string; permissions: Permission[] | 'toutes' }[] = [
  {
    valeur: 'super_admin', libelle: 'Super Admin',
    description: 'Accès complet, y compris la gestion de l’équipe.',
    permissions: 'toutes',
  },
  {
    valeur: 'responsable_fournisseurs', libelle: 'Responsable fournisseurs',
    description: 'Valide les fournisseurs, leurs boutiques et leurs produits.',
    permissions: ['produit.lire', 'produit.moderer', 'produit.prix', 'boutique.lire', 'boutique.moderer', 'utilisateur.lire', 'verification.lire', 'verification.decider'],
  },
  {
    valeur: 'responsable_revendeurs', libelle: 'Responsable revendeurs',
    description: 'Suit le réseau de revendeurs et leurs missions.',
    permissions: ['utilisateur.lire', 'utilisateur.moderer', 'mission.gerer', 'marketing.lire', 'marketing.gerer', 'verification.lire', 'commande.lire'],
  },
  {
    valeur: 'support', libelle: 'Support',
    description: 'Consulte les commandes et accompagne les clients.',
    permissions: ['commande.lire', 'commande.modifier', 'utilisateur.lire', 'livraison.lire'],
  },
  {
    valeur: 'responsable_livraison', libelle: 'Responsable livraison',
    description: 'Gère les livreurs et les courses.',
    permissions: ['commande.lire', 'livraison.lire', 'livraison.gerer', 'utilisateur.lire', 'verification.lire'],
  },
  {
    valeur: 'finance', libelle: 'Finance',
    description: 'Commissions, retraits et paiements.',
    permissions: ['finance.lire', 'finance.payer', 'commission.configurer', 'commande.lire'],
  },
  {
    valeur: 'marketing', libelle: 'Marketing',
    description: 'Campagnes, sponsorisation, publicités et missions.',
    permissions: ['marketing.lire', 'marketing.gerer', 'mission.gerer', 'sponsorisation.gerer', 'publicite.gerer', 'produit.lire'],
  },
  {
    valeur: 'moderateur', libelle: 'Modérateur',
    description: 'Modère le catalogue et les boutiques.',
    permissions: ['produit.lire', 'produit.moderer', 'boutique.lire', 'boutique.moderer', 'verification.lire'],
  },
];

export function permissionsDuRole(role: RoleEquipe): Permission[] {
  const trouve = ROLES_EQUIPE.find((r) => r.valeur === role);
  if (!trouve) return [];
  return trouve.permissions === 'toutes' ? [...PERMISSIONS] : trouve.permissions;
}

/**
 * Permissions effectives d'un membre : celles de son rôle, plus les
 * permissions ajoutées à la main. Un membre sans ligne d'équipe — cas de tous
 * les admins existants avant cette migration — garde TOUT : sinon la mise en
 * production aurait enfermé dehors les administrateurs actuels.
 */
export function permissionsEffectives(membre: { teamRole?: string | null; permissions?: string[] | null } | null): Permission[] {
  if (!membre || !membre.teamRole) return [...PERMISSIONS];
  const base = permissionsDuRole(membre.teamRole as RoleEquipe);
  const sup = (membre.permissions || []).filter((p): p is Permission => (PERMISSIONS as readonly string[]).includes(p));
  return Array.from(new Set([...base, ...sup]));
}

export function aLaPermission(
  membre: { teamRole?: string | null; permissions?: string[] | null } | null,
  permission: Permission,
): boolean {
  return permissionsEffectives(membre).includes(permission);
}
