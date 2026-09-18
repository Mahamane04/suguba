/**
 * Codes de liens trackés — logique PURE (aucun accès base, testable seul).
 *
 * Tout partage passe par un code court : `app.sugubaml.com/go/AB78X2`. Le QR
 * code n'est que le même code rendu en image — pas un second système (§ L du
 * cahier des charges).
 */

/**
 * Alphabet sans caractères confondables : ni O/0, ni I/1/L. Un code se lit à
 * voix haute au téléphone et se recopie à la main depuis un flyer ; deux
 * lettres qui se ressemblent coûtent un client.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LONGUEUR_CODE = 6;

export type CibleLien = 'product' | 'store' | 'referral' | 'campaign' | 'mission' | 'home';

export const CIBLES: CibleLien[] = ['product', 'store', 'referral', 'campaign', 'mission', 'home'];

export type CanalPartage = 'whatsapp' | 'facebook' | 'instagram' | 'tiktok' | 'qr' | 'sms' | 'autre';

export const CANAUX: { valeur: CanalPartage; libelle: string }[] = [
  { valeur: 'whatsapp', libelle: 'WhatsApp' },
  { valeur: 'facebook', libelle: 'Facebook' },
  { valeur: 'instagram', libelle: 'Instagram' },
  { valeur: 'tiktok', libelle: 'TikTok' },
  { valeur: 'qr', libelle: 'QR code' },
  { valeur: 'sms', libelle: 'SMS' },
  { valeur: 'autre', libelle: 'Autre' },
];

export function estCanal(valeur: unknown): valeur is CanalPartage {
  return CANAUX.some((c) => c.valeur === valeur);
}

export function estCible(valeur: unknown): valeur is CibleLien {
  return CIBLES.includes(valeur as CibleLien);
}

/** Code aléatoire cryptographique. Jamais Math.random : un code devinable permettrait de s'attribuer le trafic d'un autre. */
export function genererCodeLien(aleatoire: (n: number) => Uint8Array): string {
  const octets = aleatoire(LONGUEUR_CODE);
  let code = '';
  for (let i = 0; i < LONGUEUR_CODE; i++) code += ALPHABET[octets[i] % ALPHABET.length];
  return code;
}

/** Normalise un code venu d'une URL : majuscules, sans espace. */
export function normaliserCodeLien(brut: unknown): string | null {
  if (typeof brut !== 'string') return null;
  const code = brut.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return null;
  return code;
}

/**
 * Destination réelle d'un code, avec le code revendeur porté en paramètre.
 * Toujours un chemin interne : rediriger vers une URL fournie par la base
 * ouvrirait une redirection ouverte (un lien Suguba menant ailleurs).
 */
export function destinationDuLien(
  cible: CibleLien,
  ref: string | null,
  codeRevendeur: string | null,
  codeLien: string,
): string {
  const parametres = new URLSearchParams();
  if (codeRevendeur) parametres.set('ref', codeRevendeur);
  parametres.set('via', codeLien);
  const q = `?${parametres.toString()}`;

  switch (cible) {
    case 'product':
      return ref ? `/p/${encodeURIComponent(ref)}${q}` : `/${q}`;
    case 'store':
      return ref ? `/boutique/${encodeURIComponent(ref)}${q}` : `/${q}`;
    case 'referral':
      return `/rejoindre${q}`;
    case 'campaign':
    case 'mission':
      return `/${q}`;
    case 'home':
    default:
      return `/${q}`;
  }
}

/** Taux de conversion d'un lien, en pourcentage arrondi. 0 clic → 0. */
export function tauxConversion(clics: number, commandes: number): number {
  if (!clics || clics <= 0) return 0;
  return Math.round((commandes / clics) * 1000) / 10;
}
