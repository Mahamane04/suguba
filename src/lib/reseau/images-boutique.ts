/**
 * Images qu'un revendeur peut poser sur SA boutique (lot 2 du chantier boutique,
 * 2026-10-03) — règle PURE, appliquée par PATCH /api/reseller/boutique.
 *
 * majBoutique ne vérifie que la forme d'une adresse (https, 600 caractères au
 * plus). Un revendeur pouvait donc enregistrer comme logo, couverture ou photo
 * de galerie n'importe quelle image d'Internet (marque d'un autre, image
 * choquante, pixel de pistage) : elle s'affichait sur une page signée Suguba.
 * Seules sont acceptées les images envoyées par /api/reseau/upload, qui les range
 * dans product-images/boutiques/<uid de la session>/, ou l'image DÉJÀ enregistrée
 * (les anciennes images ne doivent pas bloquer l'enregistrement du reste).
 */

/** Dossier public des images de boutique d'un compte (voir /api/reseau/upload). */
export function dossierImagesBoutique(uid: string, baseSupabase: string | null | undefined): string | null {
  const base = String(baseSupabase || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^\s/]+$/.test(base) || !uid) return null;
  return `${base}/storage/v1/object/public/product-images/boutiques/${uid}/`;
}

/**
 * Vrai si `url` est une image envoyée par ce compte (un seul nom de fichier
 * dans son dossier : ni « ../ », ni paramètre), ou une image déjà enregistrée
 * sur sa boutique.
 */
export function imageAutorisee(
  url: unknown,
  uid: string,
  baseSupabase: string | null | undefined,
  dejaEnregistrees: (string | null | undefined)[] = [],
): boolean {
  if (typeof url !== 'string') return false;
  const propre = url.trim();
  if (!propre) return false;
  if (dejaEnregistrees.some((d) => typeof d === 'string' && d.trim() === propre)) return true;
  const dossier = dossierImagesBoutique(uid, baseSupabase);
  if (!dossier || !propre.startsWith(dossier)) return false;
  return /^[A-Za-z0-9_-]{1,80}\.(webp|jpe?g|png)$/i.test(propre.slice(dossier.length));
}
