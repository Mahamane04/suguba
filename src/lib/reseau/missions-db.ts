/**
 * Missions — accès base (SERVEUR). La logique de progression est pure et vit
 * dans ./missions.ts ; ce fichier ne fait que lire et écrire.
 */
import { getSupabaseAdmin } from '../supabase-admin';
import { ouverteALaParticipation, type TypeMission } from './missions';

export interface MissionRow {
  id: string;
  titre: string;
  description: string | null;
  type: TypeMission;
  objectif: number;
  recompense: number;
  recompenseLibelle: string | null;
  conditions: string | null;
  supplierId: string | null;
  productId: string | null;
  commenceLe: string;
  finitLe: string | null;
  maxParticipants: number | null;
  statut: 'draft' | 'active' | 'paused' | 'ended';
  participants: number;
}

export interface ParticipationRow {
  id: string;
  missionId: string;
  resellerId: string;
  avancement: number;
  statut: 'joined' | 'completed' | 'validated' | 'rejected';
  preuve: string | null;
  linkCode: string | null;
  rejointLe: string;
}

function versMission(r: any, participants = 0): MissionRow {
  return {
    id: r.id,
    titre: r.title,
    description: r.description || null,
    type: r.mission_type,
    objectif: Number(r.objective) || 1,
    recompense: Number(r.reward_amount) || 0,
    recompenseLibelle: r.reward_label || null,
    conditions: r.conditions || null,
    supplierId: r.supplier_id || null,
    productId: r.product_id || null,
    commenceLe: r.starts_at,
    finitLe: r.ends_at || null,
    maxParticipants: r.max_participants ?? null,
    statut: r.status,
    participants,
  };
}

function versParticipation(r: any): ParticipationRow {
  return {
    id: r.id,
    missionId: r.mission_id,
    resellerId: r.reseller_id,
    avancement: Number(r.progress) || 0,
    statut: r.status,
    preuve: r.proof_url || null,
    linkCode: r.link_code || null,
    rejointLe: r.joined_at,
  };
}

export async function listerMissions(options: { statut?: string; supplierId?: string } = {}): Promise<MissionRow[]> {
  const a = getSupabaseAdmin();
  if (!a) return [];
  let requete = a.from('missions').select('*').order('created_at', { ascending: false }).limit(100);
  if (options.statut) requete = requete.eq('status', options.statut);
  if (options.supplierId) requete = requete.eq('supplier_id', options.supplierId);
  const { data, error } = await requete;
  if (error || !data) return [];

  // Un seul aller-retour pour compter les participants de toutes les missions :
  // une requête par mission ferait exploser le temps de réponse de la liste.
  const { data: participations } = await a
    .from('mission_participants')
    .select('mission_id')
    .in('mission_id', data.map((m: any) => m.id));
  const compte = new Map<string, number>();
  for (const p of participations || []) compte.set(p.mission_id, (compte.get(p.mission_id) || 0) + 1);

  return data.map((m: any) => versMission(m, compte.get(m.id) || 0));
}

export async function mesParticipations(resellerId: string): Promise<ParticipationRow[]> {
  const a = getSupabaseAdmin();
  if (!a) return [];
  const { data, error } = await a.from('mission_participants').select('*').eq('reseller_id', resellerId);
  if (error || !data) return [];
  return data.map(versParticipation);
}

export async function rejoindreMission(
  missionId: string,
  resellerId: string,
): Promise<{ ok: boolean; erreur?: string }> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.' };

  const { data: m } = await a.from('missions').select('*').eq('id', missionId).maybeSingle();
  if (!m) return { ok: false, erreur: 'Mission introuvable.' };

  const { count } = await a
    .from('mission_participants')
    .select('id', { count: 'exact', head: true })
    .eq('mission_id', missionId);

  const verdict = ouverteALaParticipation(
    {
      id: m.id,
      type: m.mission_type,
      objectif: Number(m.objective) || 1,
      finitLe: m.ends_at,
      statut: m.status,
      maxParticipants: m.max_participants ?? null,
    },
    count ?? 0,
    new Date(),
  );
  if (!verdict.ouverte) return { ok: false, erreur: verdict.raison };

  const { error } = await a
    .from('mission_participants')
    .upsert({ mission_id: missionId, reseller_id: resellerId }, { onConflict: 'mission_id,reseller_id' });
  if (error) return { ok: false, erreur: error.message };
  return { ok: true };
}

/**
 * Fait avancer les missions d'un type donné pour un revendeur. Utilisé quand
 * il partage (share), quand son lien est cliqué (click) ou quand il parraine
 * (referral) — les ventes passent par la fonction SQL `enregistrer_conversion`,
 * qui doit rester atomique avec la commande.
 */
export async function avancerMissions(
  resellerId: string,
  type: TypeMission,
  pas = 1,
  /**
   * Produit concerné par l'action. Une mission liée à un produit (campagne
   * fournisseur « partager la TV 55 pouces ») n'avance QUE pour ce produit ;
   * une mission générale (sans produit) avance pour tout partage.
   */
  productId: string | null = null,
): Promise<void> {
  const a = getSupabaseAdmin();
  if (!a) return;

  const { data: toutes } = await a
    .from('missions')
    .select('id, objective, product_id')
    .eq('mission_type', type)
    .eq('status', 'active');
  const missions = (toutes || []).filter((m: any) => !m.product_id || m.product_id === productId);
  if (missions.length === 0) return;

  const { data: participations } = await a
    .from('mission_participants')
    .select('id, mission_id, progress, status')
    .eq('reseller_id', resellerId)
    .eq('status', 'joined')
    .in('mission_id', missions.map((m: any) => m.id));
  if (!participations || participations.length === 0) return;

  const objectifs = new Map(missions.map((m: any) => [m.id, Number(m.objective) || 1]));
  for (const p of participations) {
    const avancement = (Number(p.progress) || 0) + pas;
    const atteint = avancement >= (objectifs.get(p.mission_id) || 1);
    await a
      .from('mission_participants')
      .update({
        progress: avancement,
        ...(atteint ? { status: 'completed', completed_at: new Date().toISOString() } : {}),
      })
      .eq('id', p.id);
  }
}

/** Id d'un produit à partir de son adresse (les liens trackés portent l'adresse). */
export async function produitParSlug(slug: string | null): Promise<string | null> {
  const a = getSupabaseAdmin();
  if (!a || !slug) return null;
  const { data } = await a.from('products').select('id').eq('slug', slug).maybeSingle();
  return data?.id || null;
}
