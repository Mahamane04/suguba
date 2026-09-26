import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { DUREE_MAX_VISITE_S, DUREE_MIN_VISITE_S } from './resultats-constantes';

/**
 * Rémunération au résultat (2026-09-26, lot 3) — partie SERVEUR pure
 * (empreintes, jeton signé). Les constantes et règles sont dans
 * ./resultats-constantes, réexportées ici.
 */
export * from './resultats-constantes';

/**
 * Empreinte du RÉSEAU du visiteur (IPv4 /24, IPv6 /48), salée : sert à
 * repérer beaucoup de visites venues d'un même endroit, sans garder d'IP.
 */
export function empreinteReseau(ip: string | null | undefined, sel: string): string | null {
  const brut = String(ip || '').trim();
  if (!brut) return null;
  let prefixe: string;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(brut)) prefixe = brut.split('.').slice(0, 3).join('.');
  else if (brut.includes(':')) prefixe = brut.toLowerCase().split(':').slice(0, 3).join(':');
  else return null;
  return createHash('sha256').update(`${sel}|reseau|${prefixe}`).digest('hex').slice(0, 24);
}

// ── Jeton de début de visite ────────────────────────────────────────────────
// La page produit en reçoit un à l'ouverture ; elle ne peut qualifier la
// visite qu'en le rendant au moins DUREE_MIN_VISITE_S plus tard, depuis le
// même appareil (même empreinte visiteur).

export interface ContenuJeton { produit: string; code: string; visiteur: string; t: number }

export function signerJeton(c: ContenuJeton, secret: string): string {
  const corps = Buffer.from(JSON.stringify(c)).toString('base64url');
  const sig = createHmac('sha256', secret).update(corps).digest('base64url');
  return `${corps}.${sig}`;
}

export function lireJeton(
  jeton: unknown, secret: string, visiteur: string, maintenant = Date.now(),
): { ok: true; contenu: ContenuJeton } | { ok: false; raison: 'invalide' | 'trop_tot' | 'expire' } {
  if (typeof jeton !== 'string' || jeton.length > 600) return { ok: false, raison: 'invalide' };
  const [corps, sig] = jeton.split('.');
  if (!corps || !sig) return { ok: false, raison: 'invalide' };
  const attendu = Buffer.from(createHmac('sha256', secret).update(corps).digest('base64url'));
  const recu = Buffer.from(sig);
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return { ok: false, raison: 'invalide' };
  let c: ContenuJeton;
  try { c = JSON.parse(Buffer.from(corps, 'base64url').toString('utf8')); } catch { return { ok: false, raison: 'invalide' }; }
  if (!c || c.visiteur !== visiteur || typeof c.produit !== 'string' || typeof c.code !== 'string' || !Number.isFinite(c.t)) {
    return { ok: false, raison: 'invalide' };
  }
  const age = (maintenant - c.t) / 1000;
  if (age < DUREE_MIN_VISITE_S) return { ok: false, raison: 'trop_tot' };
  if (age > DUREE_MAX_VISITE_S) return { ok: false, raison: 'expire' };
  return { ok: true, contenu: c };
}

