'use client';

/**
 * Code du parrain, gardé 30 jours dans un cookie lu par le serveur à la fin
 * de l'inscription (/api/auth/complete-profile). Un cookie plutôt qu'un
 * paramètre d'URL : il survit à l'aller-retour Google et au lien de connexion
 * reçu par e-mail, qui ne transportent pas nos paramètres.
 */
export function memoriserParrain(code: string | null | undefined) {
  const propre = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,40}$/.test(propre)) return;
  document.cookie = `suguba_parrain=${encodeURIComponent(propre)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}
