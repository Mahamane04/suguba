import { getSupabaseAdmin } from './supabase-admin';
import type { ProfileStatus, SugubaRole } from './session';

/**
 * Lecture des rôles détenus par un compte — serveur uniquement.
 *
 * Centralisé ici pour que les trois points d'entrée d'authentification
 * (téléphone, Google/email, connexion rapide de développement) construisent
 * la session de la même façon. Trois copies de cette logique finiraient par
 * diverger, et une divergence sur les rôles est une faille d'autorisation.
 */

export type CarteDesRoles = Partial<Record<SugubaRole, ProfileStatus>>;

/**
 * Rôles d'un profil, avec le statut propre à chacun.
 *
 * Repli volontaire sur le rôle principal du profil si la table est absente ou
 * vide : la migration multi-rôle peut ne pas encore être appliquée sur un
 * environnement donné, et l'authentification ne doit pas s'arrêter pour
 * autant. Personne ne gagne de droit par ce repli — il reproduit exactement
 * ce que faisait le modèle à rôle unique.
 */
export async function chargerRoles(
  profileId: string,
  roleParDefaut: SugubaRole,
  statutParDefaut: ProfileStatus
): Promise<CarteDesRoles> {
  const admin = getSupabaseAdmin();
  if (!admin) return { [roleParDefaut]: statutParDefaut } as CarteDesRoles;

  const { data, error } = await admin
    .from('profile_roles')
    .select('role, status')
    .eq('profile_id', profileId);

  if (error) {
    console.warn('[ROLES] Lecture impossible, repli sur le rôle principal:', error.message);
    return { [roleParDefaut]: statutParDefaut } as CarteDesRoles;
  }
  if (!data || data.length === 0) {
    return { [roleParDefaut]: statutParDefaut } as CarteDesRoles;
  }

  const carte: CarteDesRoles = {};
  for (const ligne of data) {
    carte[ligne.role as SugubaRole] = ligne.status as ProfileStatus;
  }
  return carte;
}

/**
 * Choisit le rôle sous lequel ouvrir la session.
 *
 * Priorité au rôle principal du profil s'il est actif ; sinon au premier rôle
 * actif trouvé — se retrouver connecté sur un rôle en attente de validation
 * alors qu'un autre est utilisable serait une impasse. En dernier recours, le
 * rôle principal, quitte à finir sur /pending-approval, qui est le bon écran
 * pour un compte dont rien n'est encore validé.
 */
export function choisirRoleActif(
  carte: CarteDesRoles,
  roleParDefaut: SugubaRole
): { role: SugubaRole; status: ProfileStatus } {
  if (carte[roleParDefaut] === 'active') {
    return { role: roleParDefaut, status: 'active' };
  }
  const actif = (Object.keys(carte) as SugubaRole[]).find((r) => carte[r] === 'active');
  if (actif) return { role: actif, status: 'active' };

  return { role: roleParDefaut, status: carte[roleParDefaut] ?? 'pending_approval' };
}
