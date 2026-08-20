/**
 * Stockage serveur des défis OTP de connexion — Suguba SaaS
 *
 * Le code n'est JAMAIS renvoyé au client (contrairement à l'ancien
 * auth-service.ts). Seul son empreinte HMAC est conservée, avec expiration
 * et compteur de tentatives, exactement comme pour l'OTP de livraison.
 *
 * Persistance : si SUPABASE_SERVICE_ROLE_KEY est configurée, les défis sont
 * stockés dans la table public.otp_challenges (survit aux redémarrages et
 * fonctionne sur plusieurs instances serverless). Sinon, repli en mémoire
 * process — suffisant en développement local, mais NE PAS déployer ainsi :
 * un redémarrage ou une deuxième instance invalide tous les codes en vol.
 */

import { getSupabaseAdmin } from './supabase-admin';

const MAX_ATTEMPTS = 5;
const TTL_SECONDS = 5 * 60;

interface Challenge {
  phone: string;
  codeHash: string;
  attempts: number;
  expiresAt: number;
}

const memoryChallenges = new Map<string, Challenge>();

async function hash(value: string): Promise<string> {
  const pepper = process.env.OTP_PEPPER || process.env.SESSION_SECRET || 'suguba-otp-pepper-dev-only';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createOtpChallenge(phone: string, code: string): Promise<void> {
  const codeHash = await hash(code);
  const expiresAt = Date.now() + TTL_SECONDS * 1000;

  const admin = getSupabaseAdmin();
  if (admin) {
    await admin.from('otp_challenges').upsert({
      phone,
      code_hash: codeHash,
      attempts: 0,
      expires_at: new Date(expiresAt).toISOString(),
    });
    return;
  }

  memoryChallenges.set(phone, { phone, codeHash, attempts: 0, expiresAt });
}

export async function verifyOtpChallenge(phone: string, code: string): Promise<{ ok: boolean; reason?: string }> {
  const admin = getSupabaseAdmin();

  if (admin) {
    const { data } = await admin.from('otp_challenges').select('*').eq('phone', phone).maybeSingle();
    if (!data) return { ok: false, reason: 'Aucun code demandé pour ce numéro.' };
    if (new Date(data.expires_at).getTime() < Date.now()) return { ok: false, reason: 'Code expiré, redemandez-en un.' };
    if (data.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'Trop de tentatives, redemandez un code.' };

    const codeHash = await hash(code);
    if (codeHash !== data.code_hash) {
      await admin.from('otp_challenges').update({ attempts: data.attempts + 1 }).eq('phone', phone);
      return { ok: false, reason: 'Code invalide.' };
    }

    await admin.from('otp_challenges').delete().eq('phone', phone);
    return { ok: true };
  }

  const challenge = memoryChallenges.get(phone);
  if (!challenge) return { ok: false, reason: 'Aucun code demandé pour ce numéro.' };
  if (challenge.expiresAt < Date.now()) {
    memoryChallenges.delete(phone);
    return { ok: false, reason: 'Code expiré, redemandez-en un.' };
  }
  if (challenge.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'Trop de tentatives, redemandez un code.' };

  const codeHash = await hash(code);
  if (codeHash !== challenge.codeHash) {
    challenge.attempts += 1;
    return { ok: false, reason: 'Code invalide.' };
  }

  memoryChallenges.delete(phone);
  return { ok: true };
}
