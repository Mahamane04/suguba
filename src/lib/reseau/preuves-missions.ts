import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assurerBucketPrive } from '../sav-photos';
import { notifier } from './notifications';

/**
 * Preuves de publication des missions « partager » et « publier »
 * (2026-09-26, lot 2a « Campagnes encadrées ») — SERVEUR UNIQUEMENT.
 *
 * Créer un lien n'est pas publier. Le revendeur envoie une capture de sa
 * publication (statut WhatsApp, groupe, Facebook…), l'équipe la vérifie, et
 * seule une preuve VALIDÉE fait avancer la mission — une fois, grâce à la
 * clé « preuve:<id> » de compter_evenement_mission. Une même capture ne peut
 * servir deux fois (empreinte de l'image), et on ne peut pas envoyer plus de
 * preuves qu'il n'en manque pour atteindre l'objectif.
 */

export const BUCKET_PREUVES = 'preuves-missions';
export const PREUVES_PAR_JOUR_MAX = 10;

export const CANAUX_PREUVE = [
  { valeur: 'whatsapp_statut', libelle: 'Statut WhatsApp' },
  { valeur: 'whatsapp_groupe', libelle: 'Groupe WhatsApp' },
  { valeur: 'facebook', libelle: 'Facebook' },
  { valeur: 'instagram', libelle: 'Instagram' },
  { valeur: 'tiktok', libelle: 'TikTok' },
  { valeur: 'autre', libelle: 'Autre' },
] as const;
export type CanalPreuve = (typeof CANAUX_PREUVE)[number]['valeur'];

export class PreuveError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const TYPES_AVEC_PREUVE = ['share', 'post'];
const tableAbsente = (code: unknown) => ['42P01', 'PGRST205'].includes(String(code));
const indisponible = (): never => { throw new PreuveError('Service indisponible. Réessayez.', 503); };

export const libelleCanal = (c: string) => CANAUX_PREUVE.find((x) => x.valeur === c)?.libelle || 'Autre';

// ── Revendeur : envoyer une preuve ───────────────────────────────────────────
export async function soumettrePreuve(
  admin: SupabaseClient,
  resellerId: string,
  params: { missionId: unknown; canal: unknown; lien?: unknown; note?: unknown; image: Buffer },
) {
  const missionId = typeof params.missionId === 'string' ? params.missionId : '';
  const canal = CANAUX_PREUVE.find((c) => c.valeur === params.canal)?.valeur;
  const lien = typeof params.lien === 'string' ? params.lien.trim().slice(0, 500) : '';
  const note = typeof params.note === 'string' ? params.note.trim().slice(0, 500) : '';
  if (!missionId) throw new PreuveError('Mission manquante.', 400);
  if (!canal) throw new PreuveError('Choisissez où vous avez publié.', 400);
  if (lien && !/^https:\/\/[^\s"'<>]+$/.test(lien)) throw new PreuveError('Le lien de la publication doit commencer par https://', 400);

  // `*` : la colonne canal (lot 2b) n'existe qu'après le SQL des campagnes.
  const { data: mission, error: e1 } = await admin.from('missions').select('*').eq('id', missionId).maybeSingle();
  if (e1) indisponible();
  if (!mission || !TYPES_AVEC_PREUVE.includes(mission.mission_type)) throw new PreuveError('Cette mission ne demande pas de preuve.', 400);
  const maintenant = Date.now();
  if (mission.status !== 'active' || (mission.ends_at && Date.parse(mission.ends_at) < maintenant)) throw new PreuveError('Cette mission est terminée.', 409);
  // Campagne à canal imposé (lot 2b) : le fournisseur a payé pour CE canal.
  if (mission.canal && mission.canal !== 'tous' && canal !== mission.canal) {
    throw new PreuveError(`Cette campagne demande une publication sur : ${libelleCanal(mission.canal)}.`, 400);
  }

  const { data: part, error: e2 } = await admin.from('mission_participants').select('id, progress, status')
    .eq('mission_id', missionId).eq('reseller_id', resellerId).maybeSingle();
  if (e2) indisponible();
  if (!part) throw new PreuveError('Rejoignez d’abord la mission.', 403);
  if (part.status !== 'joined') throw new PreuveError('Objectif déjà atteint pour cette mission.', 409);

  const { data: miennes, error: e3 } = await admin.from('mission_proofs').select('status, created_at').eq('participant_id', part.id);
  if (e3) { if (tableAbsente(e3.code)) throw new PreuveError('Les preuves seront disponibles après la mise à jour de la base par Suguba.', 503); indisponible(); }
  const enAttente = (miennes || []).filter((p) => p.status === 'pending').length;
  const manque = Math.max(0, (Number(mission.objective) || 1) - (Number(part.progress) || 0));
  if (enAttente >= manque) throw new PreuveError('Vous avez déjà envoyé assez de preuves : attendez leur vérification.', 409);
  const aujourdHui = (miennes || []).filter((p) => maintenant - Date.parse(p.created_at) < 86_400_000).length;
  if (aujourdHui >= PREUVES_PAR_JOUR_MAX) throw new PreuveError('Trop de preuves aujourd’hui. Réessayez demain.', 429);

  const hash = createHash('sha256').update(params.image).digest('hex');
  const id = randomUUID();
  try {
    await assurerBucketPrive(admin, BUCKET_PREUVES);
    const { error } = await admin.storage.from(BUCKET_PREUVES).upload(`${id}.webp`, params.image, { contentType: 'image/webp', upsert: false });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error('[PREUVES] photo', (e as Error).message);
    throw new PreuveError('Envoi de la capture impossible. Réessayez.', 503);
  }

  const { error } = await admin.from('mission_proofs').insert({
    id, mission_id: missionId, participant_id: part.id, reseller_id: resellerId,
    canal, lien_publication: lien || null, image_hash: hash, note: note || null,
  });
  if (error) {
    await admin.storage.from(BUCKET_PREUVES).remove([`${id}.webp`]);
    if (error.code === '23505') throw new PreuveError('Cette capture a déjà été envoyée. Envoyez celle d’une autre publication.', 409);
    indisponible();
  }
  return { id, statut: 'pending' as const };
}

export async function mesPreuves(admin: SupabaseClient, resellerId: string) {
  const { data, error } = await admin.from('mission_proofs').select('id, mission_id, canal, status, motif_rejet, created_at')
    .eq('reseller_id', resellerId).order('created_at', { ascending: false }).limit(100);
  if (error) return [];
  return (data || []).map((p) => ({
    id: p.id, missionId: p.mission_id, canal: libelleCanal(p.canal), statut: p.status as 'pending' | 'validated' | 'rejected',
    motifRejet: p.motif_rejet || null, envoyeeLe: p.created_at,
  }));
}

// ── Admin : vérifier ─────────────────────────────────────────────────────────
export async function preuvesAVerifier(admin: SupabaseClient) {
  const { data, error } = await admin.from('mission_proofs').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(100);
  if (error) {
    if (tableAbsente(error.code)) return { preuves: [], migrationRequise: true };
    indisponible();
  }
  const lignes = data || [];
  const [missions, profils, signes] = await Promise.all([
    lignes.length ? admin.from('missions').select('id, title, objective').in('id', [...new Set(lignes.map((p) => p.mission_id))]) : { data: [] },
    lignes.length ? admin.from('profiles').select('id, full_name, reseller_code').in('id', [...new Set(lignes.map((p) => p.reseller_id))]) : { data: [] },
    lignes.length ? admin.storage.from(BUCKET_PREUVES).createSignedUrls(lignes.map((p) => `${p.id}.webp`), 600) : { data: [] },
  ]);
  const m = new Map(((missions as any).data || []).map((x: any) => [x.id, x]));
  const r = new Map(((profils as any).data || []).map((x: any) => [x.id, x]));
  const photos = ((signes as any).data || []) as { signedUrl: string | null }[];
  return {
    migrationRequise: false,
    preuves: lignes.map((p, i) => ({
      id: p.id,
      mission: (m.get(p.mission_id) as any)?.title || 'Mission',
      revendeur: { nom: (r.get(p.reseller_id) as any)?.full_name || 'Revendeur', code: (r.get(p.reseller_id) as any)?.reseller_code || null },
      canal: libelleCanal(p.canal),
      lien: p.lien_publication || null,
      note: p.note || null,
      photo: photos[i]?.signedUrl || null,
      envoyeeLe: p.created_at,
    })),
  };
}

export async function deciderPreuve(
  admin: SupabaseClient,
  adminId: string,
  params: { preuveId: unknown; decision: unknown; motif?: unknown },
) {
  const preuveId = typeof params.preuveId === 'string' ? params.preuveId : '';
  const motif = typeof params.motif === 'string' ? params.motif.trim().slice(0, 300) : '';
  if (!preuveId) throw new PreuveError('Preuve manquante.', 400);
  if (params.decision !== 'valider' && params.decision !== 'refuser') throw new PreuveError('Décision inconnue.', 400);
  if (params.decision === 'refuser' && motif.length < 3) throw new PreuveError('Indiquez le motif du refus (le revendeur le verra).', 400);

  const { data: preuve, error } = await admin.from('mission_proofs').update({
    status: params.decision === 'valider' ? 'validated' : 'rejected',
    motif_rejet: params.decision === 'refuser' ? motif : null,
    reviewed_by: adminId, reviewed_at: new Date().toISOString(),
  }).eq('id', preuveId).eq('status', 'pending').select('*').maybeSingle();
  if (error) indisponible();
  if (!preuve) throw new PreuveError('Cette preuve a déjà été traitée.', 409);

  let comptee = false;
  if (params.decision === 'valider') {
    const { data, error: e2 } = await admin.rpc('compter_evenement_mission', { p_participant_id: preuve.participant_id, p_cle: `preuve:${preuve.id}` });
    if (e2) console.error('[PREUVES] progression', e2.code);
    comptee = Boolean((data as { compte?: boolean } | null)?.compte);
  }
  await notifier(preuve.reseller_id, params.decision === 'valider'
    ? { type: 'mission', titre: comptee ? 'Publication validée ✅' : 'Publication validée', texte: comptee ? 'Elle compte pour votre mission.' : 'La mission était terminée : elle ne compte plus.', lien: '/reseller/missions' }
    : { type: 'mission', titre: 'Publication refusée', texte: motif, lien: '/reseller/missions' });
  return { statut: preuve.status, comptee };
}
