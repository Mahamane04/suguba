/**
 * Connexion par e-mail avec code (2026-09-26) — règles PURES.
 *
 * L'e-mail contient un lien ET un code à 6 chiffres. Le code se tape sur la
 * page d'où la demande est partie : il marche même quand le lien s'ouvre
 * dans un autre navigateur (appli Yahoo, Gmail…) et ne connecte pas.
 * Même chemin pour une adresse inconnue : Supabase crée le compte, puis le
 * profil se choisit sur /register/complete.
 */

/** Chiffres seulement (un code collé avec des espaces reste valable). */
export function nettoyerCode(saisie: string): string {
  return String(saisie || '').replace(/\D/g, '').slice(0, 10);
}

/** 6 chiffres attendus ; jusqu'à 10 si la longueur est changée dans Supabase. */
export function codeComplet(code: string): boolean {
  return /^\d{6,10}$/.test(code);
}

/** Messages Supabase (anglais, techniques) → phrases pour le client. */
export function messageErreurEmail(message: string | undefined | null): string {
  const m = String(message || '').toLowerCase();
  if (m.includes('security purposes') || m.includes('rate limit') || m.includes('too many')) {
    return 'Trop de demandes. Attendez une minute avant de redemander un code.';
  }
  if (m.includes('sending') || m.includes('smtp')) {
    return 'L’e-mail n’a pas pu partir. Réessayez dans un instant, ou continuez avec Google.';
  }
  if (m.includes('expired') || m.includes('token')) {
    return 'Code incorrect ou expiré. Vérifiez les chiffres, ou demandez un nouveau code.';
  }
  if (m.includes('email') && m.includes('invalid')) return 'Adresse e-mail invalide.';
  if (m.includes('invalid')) return 'Code incorrect ou expiré. Vérifiez les chiffres, ou demandez un nouveau code.';
  return 'Connexion impossible pour le moment. Réessayez, ou continuez avec Google.';
}

/** Délai avant de pouvoir redemander un code (réglage Supabase : 60 s). */
export const DELAI_RENVOI_S = 60;

/**
 * Mot de passe (2026-09-26) : l'adresse est vérifiée UNE fois, à
 * l'inscription (code ou lien) ; ensuite, e-mail + mot de passe, sans
 * attendre d'e-mail. 8 caractères au moins, avec au moins une lettre et un
 * chiffre ; 72 au plus (limite de Supabase).
 */
export function problemeMotDePasse(mdp: string, confirmation?: string): string | null {
  if (mdp.length < 8) return 'Le mot de passe doit faire au moins 8 caractères.';
  if (mdp.length > 72) return 'Le mot de passe doit faire 72 caractères au plus.';
  if (!/[a-zA-Z]/.test(mdp) || !/\d/.test(mdp)) return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  if (confirmation !== undefined && confirmation !== mdp) return 'Les deux mots de passe ne sont pas identiques.';
  return null;
}

/** Messages Supabase liés au mot de passe → phrases pour le client. */
export function messageErreurMotDePasse(message: string | undefined | null): string {
  const m = String(message || '').toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'E-mail ou mot de passe incorrect. Vous vous connectiez jusqu’ici avec Google ou un code ? Choisissez « Mot de passe oublié ? » pour créer votre mot de passe.';
  }
  if (m.includes('email not confirmed')) return 'Adresse pas encore confirmée : tapez le code reçu à l’inscription, ou demandez-en un nouveau.';
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Un compte existe déjà avec cette adresse : connectez-vous, ou choisissez « Mot de passe oublié ? ».';
  }
  if (m.includes('different from the old')) return 'Choisissez un mot de passe différent de l’ancien.';
  if (m.includes('password') && (m.includes('weak') || m.includes('at least') || m.includes('should'))) {
    return 'Mot de passe trop faible : 8 caractères au moins, avec une lettre et un chiffre.';
  }
  return messageErreurEmail(message);
}
