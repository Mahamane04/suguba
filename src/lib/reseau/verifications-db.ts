/**
 * Vérifications et badges (§ 5) — accès base (SERVEUR).
 */
import { getSupabaseAdmin } from '../supabase-admin';
import { notifier } from './notifications';
import { VERIFICATIONS, badgesAutomatiques, type EtatVerification, type TypeVerification } from './badges';

export interface DemandeVerification {
  id: string;
  profileId: string;
  type: TypeVerification;
  statut: 'pending' | 'approved' | 'rejected';
  document: string | null;
  note: string | null;
  creeLe: string;
  examineLe: string | null;
}

function versDemande(r: any): DemandeVerification {
  return {
    id: r.id,
    profileId: r.profile_id,
    type: r.kind,
    statut: r.status,
    document: r.document_url || null,
    note: r.note || null,
    creeLe: r.created_at,
    examineLe: r.reviewed_at || null,
  };
}

export function estTypeVerification(valeur: unknown): valeur is TypeVerification {
  return VERIFICATIONS.some((v) => v.valeur === valeur);
}

/**
 * États de vérification d'un compte.
 *
 * L'e-mail est vérifié d'office : on ne se connecte que par lien magique ou
 * Google, qui prouvent tous deux l'adresse. Le TÉLÉPHONE, lui, est seulement
 * déclaré (aucun code SMS à la connexion) : il n'est vérifié qu'après une
 * demande approuvée par l'équipe, qui appelle le numéro.
 */
export async function etatsVerification(
  profileId: string,
  profil?: { phone?: string | null; email?: string | null },
): Promise<Partial<Record<TypeVerification, EtatVerification>>> {
  const a = getSupabaseAdmin();
  const etats: Partial<Record<TypeVerification, EtatVerification>> = {};
  if (profil?.email) etats.email = 'approved';
  if (!a) return etats;

  const { data, error } = await a
    .from('verification_requests')
    .select('kind, status, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: true });
  if (error || !data) return etats;

  // Ordre croissant : la demande la plus récente écrase la précédente, donc un
  // refus suivi d'un nouveau dépôt affiche bien « en cours d'examen ».
  for (const d of data) etats[d.kind as TypeVerification] = d.status as EtatVerification;
  return etats;
}

export async function deposerVerification(params: {
  profileId: string;
  type: TypeVerification;
  document?: string | null;
  donnees?: Record<string, unknown>;
}): Promise<{ ok: boolean; erreur?: string }> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.' };

  const { data: enCours } = await a
    .from('verification_requests')
    .select('id')
    .eq('profile_id', params.profileId)
    .eq('kind', params.type)
    .eq('status', 'pending')
    .maybeSingle();
  if (enCours) return { ok: false, erreur: 'Une demande est déjà en cours d’examen pour ce document.' };

  const { error } = await a.from('verification_requests').insert({
    profile_id: params.profileId,
    kind: params.type,
    document_url: params.document || null,
    data: params.donnees || {},
  });
  if (error) return { ok: false, erreur: error.message };
  return { ok: true };
}

export async function fileDattente(limite = 50): Promise<(DemandeVerification & { nom: string | null; telephone: string | null })[]> {
  const a = getSupabaseAdmin();
  if (!a) return [];
  const { data, error } = await a
    .from('verification_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limite);
  if (error || !data || data.length === 0) return [];

  const { data: profils } = await a
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', data.map((d: any) => d.profile_id));
  const index = new Map((profils || []).map((p: any) => [p.id, p]));

  // Pièces privées : une URL signée de dix minutes, générée à chaque
  // consultation. Jamais d'URL durable, même pour l'équipe.
  const signer = async (ref: string | null): Promise<string | null> => {
    if (!ref || !ref.startsWith('prive:')) return null;
    const { data: signe } = await a.storage.from('verification-docs').createSignedUrl(ref.slice('prive:'.length), 600);
    return signe?.signedUrl || null;
  };

  return Promise.all(data.map(async (d: any) => ({
    ...versDemande(d),
    document: await signer(d.document_url),
    nom: index.get(d.profile_id)?.full_name || null,
    telephone: index.get(d.profile_id)?.phone || null,
  })));
}

export async function deciderVerification(params: {
  demandeId: string;
  decision: 'approved' | 'rejected';
  note?: string | null;
  adminId: string;
}): Promise<{ ok: boolean; erreur?: string }> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.' };

  const { data: demande, error } = await a
    .from('verification_requests')
    .update({
      status: params.decision,
      note: params.note || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: params.adminId,
    })
    .eq('id', params.demandeId)
    .eq('status', 'pending')
    .select('profile_id')
    .maybeSingle();
  if (error) return { ok: false, erreur: error.message };
  if (!demande) return { ok: false, erreur: 'Demande déjà traitée.' };

  if (params.decision === 'approved') await reevaluerBadges(demande.profile_id);
  await notifier(demande.profile_id, {
    type: 'verification',
    titre: params.decision === 'approved' ? 'Document validé ✅' : 'Document à renvoyer',
    texte: params.decision === 'approved'
      ? 'Votre profil vérifié progresse.'
      : params.note || 'Le document n’a pas pu être validé. Envoyez une photo plus nette.',
    lien: '/reseller/verification',
  });
  return { ok: true };
}

export async function badgesDuCompte(profileId: string): Promise<string[]> {
  const a = getSupabaseAdmin();
  if (!a) return [];
  const { data, error } = await a.from('user_badges').select('badge').eq('profile_id', profileId);
  if (error || !data) return [];
  return data.map((b: any) => b.badge);
}

/**
 * Recalcule les badges AUTOMATIQUES d'un compte. Ne touche jamais aux badges
 * attribués à la main par un administrateur : ils ne seraient pas retrouvés
 * par la règle et disparaîtraient au premier recalcul.
 */
export async function reevaluerBadges(profileId: string): Promise<string[]> {
  const a = getSupabaseAdmin();
  if (!a) return [];

  const { data: profil } = await a.from('profiles').select('id, phone, email').eq('id', profileId).maybeSingle();
  const etats = await etatsVerification(profileId, profil || undefined);

  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);
  const { count: ventes } = await a
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('reseller_id', profileId)
    .gte('created_at', debutMois.toISOString());

  const merites = badgesAutomatiques({
    verifications: etats,
    ventesCeMois: ventes ?? 0,
    livraisonsReussies: 0,
    livraisonsTotales: 0,
  });

  for (const cle of merites) {
    await a.from('user_badges').upsert({ profile_id: profileId, badge: cle }, { onConflict: 'profile_id,badge' });
  }
  return merites;
}
