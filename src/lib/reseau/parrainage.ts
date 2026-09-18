/**
 * Parrainage (§ 12) — accès base (SERVEUR).
 */
import { getSupabaseAdmin } from '../supabase-admin';
import { cleClient } from './attribution';

export type TypeFilleul = 'customer' | 'reseller' | 'supplier';

export interface Parrainage {
  id: string;
  parrainId: string;
  type: TypeFilleul;
  telephone: string | null;
  filleulId: string | null;
  linkCode: string | null;
  statut: 'pending' | 'converted' | 'rewarded' | 'rejected';
  recompense: number;
  creeLe: string;
  convertiLe: string | null;
}

function versParrainage(r: any): Parrainage {
  return {
    id: r.id,
    parrainId: r.referrer_id,
    type: r.kind,
    telephone: r.referred_phone || null,
    filleulId: r.referred_profile_id || null,
    linkCode: r.link_code || null,
    statut: r.status,
    recompense: Number(r.reward_amount) || 0,
    creeLe: r.created_at,
    convertiLe: r.converted_at || null,
  };
}

/**
 * Enregistre un parrainage. Idempotent sur (parrain, type, téléphone) :
 * recevoir deux fois le même filleul ne doit pas créer deux lignes, ni donc
 * deux récompenses.
 */
export async function enregistrerParrainage(params: {
  parrainId: string;
  type: TypeFilleul;
  telephone?: string | null;
  filleulId?: string | null;
  linkCode?: string | null;
}): Promise<Parrainage | null> {
  const a = getSupabaseAdmin();
  if (!a) return null;
  const tel = params.telephone ? cleClient(params.telephone) : null;

  if (tel) {
    const { data: deja } = await a
      .from('referrals')
      .select('*')
      .eq('referrer_id', params.parrainId)
      .eq('kind', params.type)
      .eq('referred_phone', tel)
      .maybeSingle();
    if (deja) return versParrainage(deja);
  }

  const { data, error } = await a
    .from('referrals')
    .insert({
      referrer_id: params.parrainId,
      kind: params.type,
      referred_phone: tel,
      referred_profile_id: params.filleulId || null,
      link_code: params.linkCode || null,
    })
    .select('*')
    .maybeSingle();
  if (error || !data) return null;
  return versParrainage(data);
}

export async function mesParrainages(parrainId: string): Promise<Parrainage[]> {
  const a = getSupabaseAdmin();
  if (!a) return [];
  const { data, error } = await a
    .from('referrals')
    .select('*')
    .eq('referrer_id', parrainId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data.map(versParrainage);
}

/** Passe un parrainage en « converti » — le filleul a fait ce qu'il fallait. */
export async function convertirParrainage(id: string, recompense: number): Promise<void> {
  const a = getSupabaseAdmin();
  if (!a) return;
  await a
    .from('referrals')
    .update({ status: 'converted', reward_amount: recompense, converted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending');
}

/**
 * Parrainage enregistré AUTOMATIQUEMENT à la fin d'une inscription (§ 12 :
 * « Suguba doit enregistrer automatiquement l'auteur, la date, le lien… »).
 *
 * Ne lève jamais d'exception : un parrainage impossible (code inconnu, base
 * indisponible) ne doit pas faire échouer une inscription.
 */
export async function parrainageAInscription(params: {
  filleulId: string;
  telephone: string | null;
  role: string;
  codeParrain: string | null | undefined;
}): Promise<void> {
  try {
    const a = getSupabaseAdmin();
    const code = String(params.codeParrain || '').trim().toUpperCase();
    if (!a || !/^[A-Z0-9-]{3,40}$/.test(code)) return;

    const { data: parrain } = await a.from('profiles').select('id').eq('reseller_code', code).maybeSingle();
    // On ne se parraine pas soi-même (un revendeur qui réutilise son propre lien).
    if (!parrain || parrain.id === params.filleulId) return;

    const type: TypeFilleul = params.role === 'reseller' ? 'reseller' : params.role === 'supplier' ? 'supplier' : 'customer';
    const enregistre = await enregistrerParrainage({
      parrainId: parrain.id,
      type,
      telephone: params.telephone,
      filleulId: params.filleulId,
    });
    if (!enregistre) return;

    // Un client parrainé devient aussi un client ATTRIBUÉ : ses commandes
    // reviennent à son parrain, selon la règle du premier contact.
    if (type === 'customer' && params.telephone) {
      const { attribuerClient } = await import('./db');
      await attribuerClient({ telephone: params.telephone, resellerId: parrain.id, source: 'parrainage' });
    }

    const { notifier } = await import('./notifications');
    await notifier(parrain.id, {
      type: 'parrainage',
      titre: 'Nouveau filleul 🎉',
      texte: type === 'reseller' ? 'Un nouveau revendeur s’est inscrit avec votre lien.' : 'Une nouvelle personne s’est inscrite avec votre lien.',
      lien: '/reseller/parrainages',
    });
  } catch (erreur) {
    console.warn('[PARRAINAGE] inscription non rattachée:', (erreur as Error).message);
  }
}
