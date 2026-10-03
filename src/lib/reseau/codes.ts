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
 * Lien d'un rayon de boutique (lot 4 du chantier boutique, 2026-10-03).
 *
 * La ref d'un lien de cible 'store' vaut « slug » (toute la boutique) ou
 * « slug~cle » (un rayon, ou les coups de cœur) : la colonne target_ref existe
 * déjà, aucune migration. La clé est contrôlée à la LECTURE (destinationDuLien)
 * comme à l'écriture : 1 à 40 caractères [a-z0-9-]. Une clé invalide est
 * ignorée, le lien ouvre alors toute la boutique — jamais une page d'erreur au
 * bout d'un lien partagé.
 */
export const SEPARATEUR_RAYON = '~';
/** Clé réservée : la section « Coups de cœur » de la vitrine (jamais un rayon maison). */
export const RAYON_COUPS_DE_COEUR = 'coups-de-coeur';

export function estCleRayon(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && /^[a-z0-9-]{1,40}$/.test(valeur);
}

/** « awa-mode » ou « awa-mode~pagnes ». */
export function refBoutique(slug: string, rayon?: string | null): string {
  return rayon && estCleRayon(rayon) ? `${slug}${SEPARATEUR_RAYON}${rayon}` : slug;
}

/** Adresse et rayon d'une ref de boutique ; rayon null si absent ou invalide. */
export function lireRefBoutique(ref: string | null | undefined): { slug: string; rayon: string | null } {
  const brute = String(ref || '');
  const i = brute.indexOf(SEPARATEUR_RAYON);
  if (i < 0) return { slug: brute, rayon: null };
  const cle = brute.slice(i + 1);
  return { slug: brute.slice(0, i), rayon: estCleRayon(cle) ? cle : null };
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
    case 'store': {
      // Lot 4 (2026-10-03) : « slug~cle » ouvre le rayon (?rayon=cle) en tête.
      const { slug, rayon } = lireRefBoutique(ref);
      if (!slug) return `/${q}`;
      const avecRayon = new URLSearchParams();
      if (rayon) avecRayon.set('rayon', rayon);
      parametres.forEach((valeur, cle) => avecRayon.set(cle, valeur));
      return `/boutique/${encodeURIComponent(slug)}?${avecRayon.toString()}`;
    }
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
