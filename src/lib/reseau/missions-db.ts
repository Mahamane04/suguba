/**
 * Missions — accès base (SERVEUR). La logique de progression est pure et vit
 * dans ./missions.ts ; ce fichier ne fait que lire et écrire.
 */
import { getSupabaseAdmin } from '../supabase-admin';
import { ouverteALaParticipation, type TypeMission } from './missions';
import { estTypeResultat } from './resultats-constantes';

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
  /**
   * Budget (lot 2a, 2026-09-26) : engagé = récompense × places (ou
   * participants s'il n'y a pas de plafond), versé = récompenses validées.
   */
  budget: { engage: number; verse: number; restant: number; aValider: number; plafonne: boolean; recu: number; recuLe: string | null; reference: string | null };
  /** Canal de publication demandé (lot 2b) : 'tous' ou un canal précis. */
  canal: string;
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

function versMission(r: any, participants = 0, validees = 0, aValider = 0): MissionRow {
  const recompense = Number(r.reward_amount) || 0;
  // Campagne au résultat (lot 3) : récompense = prix d'UN résultat,
  // objectif = nombre de résultats achetés, dépensé = budget consommé.
  const auResultat = estTypeResultat(r.mission_type);
  const places = auResultat ? (Number(r.objective) || 1) : r.max_participants ?? null;
  const engage = recompense * (places ?? participants);
  const verse = auResultat ? Number(r.budget_consomme) || 0 : recompense * validees;
  // Campagne fournisseur : le restant se compte sur ce qu'il a RÉELLEMENT réglé.
  const recu = Number(r.budget_recu) || 0;
  const base = r.supplier_id ? recu : engage;
  return {
    budget: {
      engage, verse, restant: Math.max(0, base - verse), aValider: recompense * aValider, plafonne: places !== null,
      recu, recuLe: r.budget_recu_le || null, reference: r.budget_reference || null,
    },
    canal: r.canal || 'tous',
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
    .select('mission_id, status')
    .in('mission_id', data.map((m: any) => m.id));
  const compte = new Map<string, number>();
  const validees = new Map<string, number>();
  const aValider = new Map<string, number>();
  for (const p of participations || []) {
    compte.set(p.mission_id, (compte.get(p.mission_id) || 0) + 1);
    if (p.status === 'validated') validees.set(p.mission_id, (validees.get(p.mission_id) || 0) + 1);
    if (p.status === 'completed') aValider.set(p.mission_id, (aValider.get(p.mission_id) || 0) + 1);
  }

  return data.map((m: any) => versMission(m, compte.get(m.id) || 0, validees.get(m.id) || 0, aValider.get(m.id) || 0));
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
  // Comptes liés (Protection Suguba, lot 3) : garde-fou en base.
  if (error && /COMPTE_LIE/.test(error.message)) {
    return { ok: false, erreur: 'Vous êtes lié à ce fournisseur (même compte, même équipe ou même numéro) : vous ne pouvez pas participer à sa campagne.' };
  }
  if (error) return { ok: false, erreur: error.message };
  return { ok: true };
}

/**
 * Fait avancer les missions d'un type donné pour un revendeur : visites de
 * ses liens (click), parrainages (referral), preuves de publication validées
 * (share, post). Les ventes passent par la fonction SQL `enregistrer_conversion`,
 * qui doit rester atomique avec la commande.
 *
 * Compteurs fiables (lot 2a, 2026-09-26) : chaque progression porte une CLÉ
 * (visiteur, parrainage, preuve…) qui ne compte qu'une fois par
 * participation, dans la fonction atomique `compter_evenement_mission` (qui
 * vérifie aussi que la mission est active et dans ses dates).
 */
export async function avancerMissions(
  resellerId: string,
  type: TypeMission,
  /** Identifiant unique de l'événement (ex. « visiteur:<empreinte> »). */
  cle: string,
  /**
   * Produit concerné par l'action. Une mission liée à un produit (campagne
   * fournisseur « partager la TV 55 pouces ») n'avance QUE pour ce produit ;
   * une mission générale (sans produit) avance pour tout partage.
   */
  productId: string | null = null,
): Promise<number> {
  const a = getSupabaseAdmin();
  if (!a) return 0;

  const { data: toutes } = await a
    .from('missions')
    .select('id, objective, product_id')
    .eq('mission_type', type)
    .eq('status', 'active');
  const missions = (toutes || []).filter((m: any) => !m.product_id || m.product_id === productId);
  if (missions.length === 0) return 0;

  const { data: participations } = await a
    .from('mission_participants')
    .select('id, mission_id, progress, status')
    .eq('reseller_id', resellerId)
    .eq('status', 'joined')
    .in('mission_id', missions.map((m: any) => m.id));
  if (!participations || participations.length === 0) return 0;

  let comptees = 0;
  const objectifs = new Map(missions.map((m: any) => [m.id, Number(m.objective) || 1]));
  for (const p of participations) {
    const { data, error } = await a.rpc('compter_evenement_mission', { p_participant_id: p.id, p_cle: cle.slice(0, 200) });
    if (!error) { if ((data as { compte?: boolean } | null)?.compte) comptees++; continue; }
    if (!['42883', 'PGRST202'].includes(String(error.code))) { console.error('[MISSIONS] progression non comptée:', error.code); continue; }
    // Base pas encore mise à jour : ancien comptage (sans dédoublonnage),
    // le temps que le SQL des compteurs soit exécuté.
    const avancement = (Number(p.progress) || 0) + 1;
    const atteint = avancement >= (objectifs.get(p.mission_id) || 1);
    await a.from('mission_participants').update({
      progress: avancement,
      ...(atteint ? { status: 'completed', completed_at: new Date().toISOString() } : {}),
    }).eq('id', p.id);
    comptees++;
  }
  return comptees;
}

/** Id d'un produit à partir de son adresse (les liens trackés portent l'adresse). */
export async function produitParSlug(slug: string | null): Promise<string | null> {
  const a = getSupabaseAdmin();
  if (!a || !slug) return null;
  const { data } = await a.from('products').select('id').eq('slug', slug).maybeSingle();
  return data?.id || null;
}
