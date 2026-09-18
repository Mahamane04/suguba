/**
 * Récompenses du réseau — SERVEUR.
 *
 * Une récompense est versée dans le grand-livre `commissions` (source
 * 'mission' ou 'parrainage') par la fonction SQL `verser_recompense`, qui
 * garantit qu'une même mission ou un même parrainage n'est payé qu'une fois.
 * Elle apparaît donc dans le solde retirable du revendeur, avec les garde-fous
 * de retrait déjà en place.
 */
import { getSupabaseAdmin } from '../supabase-admin';
import { normaliserReglagesReseau, primeDuParrainage, type ReglagesReseau } from './reglages';
import { notifier } from './notifications';

export async function lireReglagesReseau(): Promise<ReglagesReseau> {
  const a = getSupabaseAdmin();
  if (!a) return normaliserReglagesReseau({});
  const { data } = await a.from('reseau_reglages').select('valeurs').eq('id', 1).maybeSingle();
  return normaliserReglagesReseau(data?.valeurs || {});
}

export async function ecrireReglagesReseau(valeurs: unknown): Promise<ReglagesReseau | null> {
  const a = getSupabaseAdmin();
  if (!a) return null;
  const propres = normaliserReglagesReseau(valeurs);
  const { error } = await a
    .from('reseau_reglages')
    .upsert({ id: 1, valeurs: propres, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  return error ? null : propres;
}

async function verser(source: 'mission' | 'parrainage', ref: string, resellerId: string, montant: number, label: string) {
  const a = getSupabaseAdmin();
  if (!a || montant <= 0) return false;
  const { data, error } = await a.rpc('verser_recompense', {
    p_source: source, p_source_ref: ref, p_reseller_id: resellerId, p_montant: montant, p_label: label,
  });
  if (error) {
    console.error('[RECOMPENSE] versement impossible:', error.code);
    return false;
  }
  return Boolean(data);
}

export async function participationsAValider() {
  const a = getSupabaseAdmin();
  if (!a) return [];
  const { data, error } = await a
    .from('mission_participants')
    .select('id, mission_id, reseller_id, progress, completed_at, proof_url')
    .eq('status', 'completed')
    .order('completed_at', { ascending: true })
    .limit(100);
  if (error || !data || data.length === 0) return [];

  const [{ data: missions }, { data: profils }] = await Promise.all([
    a.from('missions').select('id, title, reward_amount, reward_label, objective').in('id', data.map((p: any) => p.mission_id)),
    a.from('profiles').select('id, full_name, reseller_code').in('id', data.map((p: any) => p.reseller_id)),
  ]);
  const m = new Map((missions || []).map((x: any) => [x.id, x]));
  const p = new Map((profils || []).map((x: any) => [x.id, x]));

  return data.map((x: any) => ({
    id: x.id,
    mission: m.get(x.mission_id)?.title || 'Mission',
    objectif: Number(m.get(x.mission_id)?.objective) || 0,
    avancement: Number(x.progress) || 0,
    recompense: Number(m.get(x.mission_id)?.reward_amount) || 0,
    revendeur: p.get(x.reseller_id)?.full_name || 'Revendeur',
    code: p.get(x.reseller_id)?.reseller_code || null,
    termineLe: x.completed_at,
  }));
}

/**
 * Valide ou refuse une mission atteinte. La validation passe la participation
 * en 'validated' PUIS verse la récompense : dans l'ordre inverse, un échec
 * d'écriture laisserait une récompense payée sur une mission non validée.
 * Le versement est de toute façon idempotent (index unique source/ref).
 */
export async function deciderParticipation(
  participationId: string,
  decision: 'validated' | 'rejected',
): Promise<{ ok: boolean; erreur?: string; verse?: number }> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.' };

  const { data: part, error } = await a
    .from('mission_participants')
    .update({ status: decision, validated_at: new Date().toISOString() })
    .eq('id', participationId)
    .eq('status', 'completed')
    .select('id, mission_id, reseller_id')
    .maybeSingle();
  if (error) return { ok: false, erreur: error.message };
  if (!part) return { ok: false, erreur: 'Participation déjà traitée ou pas encore terminée.' };

  const { data: mission } = await a.from('missions').select('title, reward_amount').eq('id', part.mission_id).maybeSingle();
  const montant = Number(mission?.reward_amount) || 0;

  if (decision === 'rejected') {
    await notifier(part.reseller_id, {
      type: 'mission', titre: 'Mission non validée',
      texte: `« ${mission?.title || 'Mission'} » n’a pas pu être validée. Contactez Suguba pour en savoir plus.`,
      lien: '/reseller/missions',
    });
    return { ok: true, verse: 0 };
  }

  const verse = await verser('mission', part.id, part.reseller_id, montant, `Mission : ${mission?.title || ''}`.slice(0, 120));
  await notifier(part.reseller_id, {
    type: 'mission', titre: 'Mission validée 🎉',
    texte: montant > 0
      ? `« ${mission?.title} » est validée : ${montant.toLocaleString('fr-FR')} F ajoutés à votre solde.`
      : `« ${mission?.title} » est validée.`,
    lien: montant > 0 ? '/reseller/payouts' : '/reseller/missions',
  });
  return { ok: true, verse: verse ? montant : 0 };
}

export async function parrainagesAValider() {
  const a = getSupabaseAdmin();
  if (!a) return [];
  const { data, error } = await a
    .from('referrals')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100);
  if (error || !data || data.length === 0) return [];
  const { data: profils } = await a
    .from('profiles')
    .select('id, full_name, reseller_code')
    .in('id', data.map((r: any) => r.referrer_id));
  const p = new Map((profils || []).map((x: any) => [x.id, x]));
  const reglages = await lireReglagesReseau();
  return data.map((r: any) => ({
    id: r.id,
    type: r.kind as 'customer' | 'reseller' | 'supplier',
    telephone: r.referred_phone || null,
    parrain: p.get(r.referrer_id)?.full_name || 'Revendeur',
    code: p.get(r.referrer_id)?.reseller_code || null,
    creeLe: r.created_at,
    primePrevue: primeDuParrainage(reglages, r.kind),
  }));
}

export async function deciderParrainage(
  parrainageId: string,
  decision: 'rewarded' | 'rejected',
): Promise<{ ok: boolean; erreur?: string; verse?: number }> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.' };

  const { data: ref } = await a.from('referrals').select('*').eq('id', parrainageId).maybeSingle();
  if (!ref || ref.status !== 'pending') return { ok: false, erreur: 'Parrainage déjà traité.' };

  const montant = decision === 'rewarded' ? primeDuParrainage(await lireReglagesReseau(), ref.kind) : 0;

  const { data: maj, error } = await a
    .from('referrals')
    .update({
      status: decision,
      reward_amount: montant,
      converted_at: new Date().toISOString(),
    })
    .eq('id', parrainageId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, erreur: error.message };
  if (!maj) return { ok: false, erreur: 'Parrainage déjà traité.' };

  if (decision === 'rejected') return { ok: true, verse: 0 };

  const verse = await verser('parrainage', ref.id, ref.referrer_id, montant, 'Prime de parrainage');
  if (montant > 0) {
    await notifier(ref.referrer_id, {
      type: 'parrainage', titre: 'Prime de parrainage versée',
      texte: `${montant.toLocaleString('fr-FR')} F ajoutés à votre solde. Merci de faire grandir Suguba !`,
      lien: '/reseller/payouts',
    });
  }
  return { ok: true, verse: verse ? montant : 0 };
}
