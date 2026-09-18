/**
 * Équipe fournisseur — invitations, acceptation, retrait. SERVEUR.
 */
import { getSupabaseAdmin } from '../supabase-admin';
import { cleClient } from './attribution';
import { notifier } from './notifications';
import { MAX_COLLABORATEURS, ROLES_COLLABORATEUR, type RoleCollaborateur } from './equipe-fournisseur';

export interface Collaborateur {
  id: string;
  telephone: string;
  nom: string | null;
  /** E-mail du compte qui a accepté — pour que le propriétaire le reconnaisse. */
  email: string | null;
  role: RoleCollaborateur;
  statut: 'invited' | 'accepted' | 'active' | 'revoked';
  inviteLe: string;
  accepteLe: string | null;
}

function nomPublic(nom: string | null | undefined): string | null {
  const mots = String(nom || '').trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return null;
  return mots.length === 1 ? mots[0] : `${mots[0]} ${mots[mots.length - 1].charAt(0).toUpperCase()}.`;
}

export async function listerEquipe(fournisseurId: string): Promise<Collaborateur[] | null> {
  const a = getSupabaseAdmin();
  if (!a) return [];
  const { data, error } = await a
    .from('supplier_members')
    .select('*')
    .eq('supplier_id', fournisseurId)
    .neq('status', 'revoked')
    .order('invited_at', { ascending: true });
  if (error) return null; // table absente : migration non appliquée
  const ids = (data || []).map((m: any) => m.member_id).filter(Boolean);
  const { data: profils } = ids.length ? await a.from('profiles').select('id, full_name, email').in('id', ids) : { data: [] as any[] };
  const noms = new Map((profils || []).map((p: any) => [p.id, p.full_name]));
  const emails = new Map((profils || []).map((p: any) => [p.id, p.email]));
  return (data || []).map((m: any) => ({
    id: m.id,
    telephone: m.invited_phone,
    // Nom COMPLET à l'étape de confirmation : le propriétaire doit pouvoir
    // reconnaître la personne avant de lui ouvrir son catalogue.
    nom: m.status === 'accepted' ? (noms.get(m.member_id) || null) : nomPublic(noms.get(m.member_id)),
    email: m.status === 'accepted' ? (emails.get(m.member_id) || null) : null,
    role: m.member_role,
    statut: m.status,
    inviteLe: m.invited_at,
    accepteLe: m.accepted_at || null,
  }));
}

export async function inviter(params: {
  fournisseurId: string;
  telephone: string;
  role: RoleCollaborateur;
  invitePar: string;
  nomFournisseur: string;
}): Promise<{ ok: boolean; erreur?: string }> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.' };
  const tel = cleClient(params.telephone);
  if (!tel) return { ok: false, erreur: 'Numéro invalide.' };

  const { data: moi } = await a.from('profiles').select('phone').eq('id', params.fournisseurId).maybeSingle();
  if (moi?.phone && cleClient(moi.phone) === tel) return { ok: false, erreur: 'C’est votre propre numéro.' };

  const { count } = await a
    .from('supplier_members')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', params.fournisseurId)
    .neq('status', 'revoked');
  if ((count ?? 0) >= MAX_COLLABORATEURS) return { ok: false, erreur: `${MAX_COLLABORATEURS} collaborateurs au maximum.` };

  // Réinviter un numéro retiré réactive sa ligne plutôt que d'en créer une
  // seconde (contrainte d'unicité fournisseur + téléphone).
  const { error } = await a.from('supplier_members').upsert({
    supplier_id: params.fournisseurId,
    invited_phone: tel,
    member_role: params.role,
    status: 'invited',
    member_id: null,
    accepted_at: null,
    invited_by: params.invitePar,
    invited_at: new Date().toISOString(),
  }, { onConflict: 'supplier_id,invited_phone' });
  if (error) return { ok: false, erreur: error.message.includes('supplier_members') ? 'Équipe indisponible (migration à appliquer).' : error.message };

  // Si la personne a déjà un compte Suguba, elle est prévenue dans l'app.
  const { data: invite } = await a.from('profiles').select('id').eq('phone', tel).maybeSingle();
  if (invite?.id) {
    const role = ROLES_COLLABORATEUR.find((r) => r.valeur === params.role)?.libelle || params.role;
    await notifier(invite.id, {
      type: 'equipe',
      titre: `${params.nomFournisseur} vous invite dans son équipe`,
      texte: `Rôle proposé : ${role}. Acceptez pour gérer sa boutique sur Suguba.`,
      lien: '/equipe/invitation',
    });
  }
  return { ok: true };
}

export async function retirer(fournisseurId: string, ligneId: string): Promise<{ ok: boolean; erreur?: string }> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.' };
  const { data: ligne } = await a
    .from('supplier_members')
    .update({ status: 'revoked' })
    .eq('id', ligneId)
    .eq('supplier_id', fournisseurId)
    .select('member_id')
    .maybeSingle();
  if (!ligne) return { ok: false, erreur: 'Collaborateur introuvable.' };

  // On ne retire QUE l'accès accordé par cette équipe (approved_by = ce
  // fournisseur) : si la personne avait obtenu le rôle fournisseur par
  // ailleurs, elle le garde.
  if (ligne.member_id) {
    await a.from('profile_roles')
      .update({ status: 'suspended' })
      .eq('profile_id', ligne.member_id)
      .eq('role', 'supplier')
      .eq('approved_by', fournisseurId);
  }
  return { ok: true };
}

export async function invitationsPour(telephone: string) {
  const a = getSupabaseAdmin();
  const tel = cleClient(telephone);
  if (!a || !tel) return [];
  const { data, error } = await a
    .from('supplier_members')
    .select('id, supplier_id, member_role, invited_at')
    .eq('invited_phone', tel)
    .eq('status', 'invited');
  if (error || !data || data.length === 0) return [];
  const { data: fiches } = await a
    .from('suppliers')
    .select('profile_id, company_name, shop_display_name')
    .in('profile_id', data.map((d: any) => d.supplier_id));
  const noms = new Map((fiches || []).map((f: any) => [f.profile_id, f.shop_display_name || f.company_name]));
  return data.map((d: any) => ({
    id: d.id,
    fournisseur: noms.get(d.supplier_id) || 'Un fournisseur',
    role: d.member_role as RoleCollaborateur,
    libelleRole: ROLES_COLLABORATEUR.find((r) => r.valeur === d.member_role)?.libelle || d.member_role,
    inviteLe: d.invited_at,
  }));
}

export async function repondreInvitation(params: {
  invitationId: string;
  personneId: string;
  telephone: string;
  accepter: boolean;
}): Promise<{ ok: boolean; erreur?: string }> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.' };
  const tel = cleClient(params.telephone);
  if (!tel) return { ok: false, erreur: 'Connectez-vous avec votre numéro de téléphone pour accepter.' };

  const { data: inv } = await a.from('supplier_members').select('*').eq('id', params.invitationId).maybeSingle();
  // Le numéro du compte doit être celui invité : connaître l'identifiant
  // d'une invitation ne suffit pas à la prendre. Ce numéro n'étant pas
  // vérifié, l'accès n'est ouvert qu'après confirmation du propriétaire.
  if (!inv || inv.status !== 'invited' || inv.invited_phone !== tel) {
    return { ok: false, erreur: 'Invitation introuvable ou déjà traitée.' };
  }

  if (!params.accepter) {
    await a.from('supplier_members').update({ status: 'revoked' }).eq('id', inv.id);
    return { ok: true };
  }

  const { data: ficheAMoi } = await a.from('suppliers').select('profile_id').eq('profile_id', params.personneId).maybeSingle();
  if (ficheAMoi) return { ok: false, erreur: 'Vous avez déjà votre propre compte fournisseur : il ne peut pas rejoindre une autre équipe.' };

  const { data: deja } = await a
    .from('supplier_members')
    .select('id')
    .eq('member_id', params.personneId)
    .in('status', ['accepted', 'active'])
    .maybeSingle();
  if (deja) return { ok: false, erreur: 'Vous faites déjà partie d’une autre équipe fournisseur. Quittez-la d’abord.' };

  const { error } = await a
    .from('supplier_members')
    .update({ member_id: params.personneId, status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', inv.id)
    .eq('status', 'invited');
  if (error) return { ok: false, erreur: error.message };

  // AUCUN droit à ce stade : le propriétaire confirme d'abord (voir
  // confirmerCollaborateur). Le numéro n'étant pas vérifié, accepter une
  // invitation ne doit pas suffire à ouvrir un catalogue.
  await notifier(inv.supplier_id, {
    type: 'equipe', titre: 'Un collaborateur attend votre confirmation',
    texte: 'Vérifiez son nom et son e-mail, puis confirmez pour lui ouvrir l’accès.', lien: '/supplier/equipe',
  });
  return { ok: true };
}

/** Le propriétaire confirme la personne qui a accepté : l'accès s'ouvre. */
export async function confirmerCollaborateur(fournisseurId: string, ligneId: string): Promise<{ ok: boolean; erreur?: string }> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.' };
  const { data: ligne } = await a.from('supplier_members').select('*')
    .eq('id', ligneId).eq('supplier_id', fournisseurId).maybeSingle();
  if (!ligne || ligne.status !== 'accepted' || !ligne.member_id) return { ok: false, erreur: 'Rien à confirmer.' };

  // Revérifié au moment de confirmer : la situation a pu changer entre-temps.
  const { data: fiche } = await a.from('suppliers').select('profile_id').eq('profile_id', ligne.member_id).maybeSingle();
  if (fiche) return { ok: false, erreur: 'Cette personne a désormais son propre compte fournisseur.' };

  const { error } = await a.from('supplier_members')
    .update({ status: 'active' }).eq('id', ligne.id).eq('status', 'accepted');
  if (error) {
    return { ok: false, erreur: error.code === '23505' ? 'Cette personne fait déjà partie d’une autre équipe.' : error.message };
  }

  // Rôle fournisseur ACTIF, marqué comme accordé par ce fournisseur : c'est
  // ce qui ouvre l'espace /supplier, et ce que le retrait saura révoquer.
  const { error: erreurRole } = await a.from('profile_roles').upsert({
    profile_id: ligne.member_id, role: 'supplier', status: 'active',
    approved_at: new Date().toISOString(), approved_by: fournisseurId,
  }, { onConflict: 'profile_id,role' });
  if (erreurRole) {
    await a.from('supplier_members').update({ status: 'accepted' }).eq('id', ligne.id);
    return { ok: false, erreur: 'Accès impossible à accorder. Réessayez.' };
  }

  await notifier(ligne.member_id, {
    type: 'equipe', titre: 'Accès confirmé 🎉',
    texte: 'Vous pouvez maintenant gérer la boutique du fournisseur.', lien: '/equipe/invitation',
  });
  return { ok: true };
}

/** Adhésion de la personne connectée (en attente ou active), s'il y en a une. */
export async function monAdhesion(personneId: string) {
  const a = getSupabaseAdmin();
  if (!a) return null;
  const { data, error } = await a.from('supplier_members')
    .select('supplier_id, member_role, status')
    .eq('member_id', personneId)
    .in('status', ['accepted', 'active'])
    .maybeSingle();
  if (error || !data) return null;
  const { data: fiche } = await a.from('suppliers').select('company_name, shop_display_name').eq('profile_id', data.supplier_id).maybeSingle();
  return {
    fournisseur: fiche?.shop_display_name || fiche?.company_name || 'Un fournisseur',
    libelleRole: ROLES_COLLABORATEUR.find((r) => r.valeur === data.member_role)?.libelle || data.member_role,
    statut: data.status as 'accepted' | 'active',
  };
}

/** Un collaborateur quitte l'équipe de lui-même. */
export async function quitterEquipe(personneId: string): Promise<{ ok: boolean; erreur?: string }> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.' };
  const { data: ligne } = await a
    .from('supplier_members')
    .select('id, supplier_id')
    .eq('member_id', personneId)
    .eq('status', 'active')
    .maybeSingle();
  if (!ligne) return { ok: false, erreur: 'Vous ne faites partie d’aucune équipe.' };
  return retirer(ligne.supplier_id, ligne.id);
}
