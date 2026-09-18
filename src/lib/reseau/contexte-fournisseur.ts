/**
 * Pour QUEL fournisseur la personne connectée travaille-t-elle ? — SERVEUR.
 *
 * Toutes les routes fournisseur passent par ici, au lieu de supposer
 * « fournisseur = personne connectée ». Deux cas :
 *   • elle possède une fiche fournisseur → elle est propriétaire ;
 *   • elle est collaboratrice active d'un fournisseur → elle agit pour lui,
 *     avec les seuls droits de son rôle.
 *
 * La propriété l'emporte toujours : un fournisseur invité par un autre ne
 * peut pas perdre l'accès à son propre catalogue.
 */
import type { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '../supabase-admin';
import { sessionAvecRole } from './route-session';
import { droitsDuRole, type DroitFournisseur, type RoleEquipeFournisseur } from './equipe-fournisseur';

export interface ContexteFournisseur {
  /** Id du profil PROPRIÉTAIRE : c'est lui qui porte `products.supplier_id`. */
  fournisseurId: string;
  /** Id de la personne connectée (propriétaire ou collaborateur). */
  personneId: string;
  role: RoleEquipeFournisseur;
  droits: DroitFournisseur[];
}

export async function contexteFournisseur(personneId: string): Promise<ContexteFournisseur | null> {
  const admin = getSupabaseAdmin();
  const proprietaire: ContexteFournisseur = {
    fournisseurId: personneId, personneId, role: 'proprietaire', droits: droitsDuRole('proprietaire'),
  };
  if (!admin) return proprietaire;

  const { data: fiche } = await admin.from('suppliers').select('profile_id').eq('profile_id', personneId).maybeSingle();
  if (fiche) return proprietaire;

  const { data: membre, error } = await admin
    .from('supplier_members')
    .select('supplier_id, member_role')
    .eq('member_id', personneId)
    .eq('status', 'active')
    .maybeSingle();

  // Table absente (migration pas appliquée) ou aucune adhésion : on garde le
  // comportement d'avant — la personne est traitée comme propriétaire d'une
  // fiche encore vide (écran « dossier fournisseur incomplet »).
  if (error || !membre) return proprietaire;

  const role = membre.member_role as RoleEquipeFournisseur;
  return { fournisseurId: membre.supplier_id, personneId, role, droits: droitsDuRole(role) };
}

/**
 * Session fournisseur + contexte + contrôle d'un droit, en un appel.
 * Renvoie soit le contexte, soit la réponse d'erreur à retourner telle quelle.
 */
export async function exigerDroitFournisseur(
  req: NextRequest,
  droit: DroitFournisseur | null,
): Promise<{ ok: true; contexte: ContexteFournisseur } | { ok: false; statut: number; erreur: string }> {
  const session = await sessionAvecRole(req, 'supplier');
  if (!session) return { ok: false, statut: 401, erreur: 'Session fournisseur requise.' };
  const contexte = await contexteFournisseur(session.uid);
  if (!contexte) return { ok: false, statut: 403, erreur: 'Aucun fournisseur associé à ce compte.' };
  if (droit && !contexte.droits.includes(droit)) {
    return { ok: false, statut: 403, erreur: 'Votre rôle dans l’équipe ne permet pas cette action.' };
  }
  return { ok: true, contexte };
}
