/**
 * Session serveur signée — Suguba SaaS
 *
 * Remplace l'ancien modèle où le rôle de l'utilisateur était décidé uniquement
 * par le navigateur (sugubaStore.switchRole côté client). Le cookie émis ici
 * est HttpOnly, signé par HMAC-SHA256 avec SESSION_SECRET (jamais exposé au
 * client) et vérifié aussi bien dans le middleware (Edge) que dans les routes
 * API (Node) via Web Crypto — d'où l'usage de crypto.subtle plutôt que le
 * module "crypto" de Node, qui n'existe pas en runtime Edge.
 */

export type ProfileStatus = 'pending_approval' | 'active' | 'suspended' | 'rejected';

export interface SugubaSession {
  uid: string;
  phone: string;
  role: 'admin' | 'supplier' | 'reseller' | 'driver' | 'customer' | 'diaspora';
  status: ProfileStatus;
  iat: number;
  exp: number;
}

export const SESSION_COOKIE_NAME = 'suguba_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 jours

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'SESSION_SECRET manquant ou trop court (>=16 caractères). ' +
      'Défini-le dans .env.local avant de démarrer le serveur — sans lui, aucune session ne peut être signée en confiance.'
    );
  }
  return secret;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + ((4 - (str.length % 4)) % 4), '=');
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

/** Construit et signe un jeton de session. Ne contient jamais rien de plus que uid/phone/role/status. */
export async function createSessionToken(params: { uid: string; phone: string; role: SugubaSession['role']; status: ProfileStatus }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SugubaSession = {
    uid: params.uid,
    phone: params.phone,
    role: params.role,
    status: params.status,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSign(payloadB64, getSecret());
  return `${payloadB64}.${signature}`;
}

/** Vérifie la signature ET l'expiration. Ne fait JAMAIS confiance à un jeton non vérifié. */
export async function verifySessionToken(token: string | undefined | null): Promise<SugubaSession | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  let expectedSignature: string;
  try {
    expectedSignature = await hmacSign(payloadB64, getSecret());
  } catch {
    return null;
  }

  if (expectedSignature.length !== signature.length) return null;
  // Comparaison en temps constant (évite une attaque par timing sur la signature).
  let diff = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    diff |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  if (diff !== 0) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as SugubaSession;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.uid || !payload.phone || !payload.role || !payload.status) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
};
