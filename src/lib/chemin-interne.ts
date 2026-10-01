/**
 * Chemin interne sûr pour une redirection (`next=`, `suite=`, lien d'une
 * notification) — audit intégral du 2026-10-01 (REQ-SEC-REDIR-001).
 *
 * `startsWith('/') && !startsWith('//')` ne suffisait pas : un navigateur
 * retire tabulations et retours à la ligne d'une adresse, donc `/\t/site.com`
 * devenait `//site.com`, un autre site ; `/\site.com` aussi. On refuse tout
 * caractère de contrôle, espace ou barre inversée, puis on vérifie, adresse
 * résolue, que l'origine reste celle du site.
 */
export function cheminInterne(valeur: string | null | undefined): string | null {
  if (typeof valeur !== 'string' || !valeur.startsWith('/') || valeur.startsWith('//')) return null;
  if (/[\u0000- \u007F\\]/.test(valeur)) return null;
  try {
    const origine = 'https://suguba.invalid';
    const u = new URL(valeur, origine);
    if (u.origin !== origine) return null;
    return (u.pathname + u.search + u.hash).slice(0, 200);
  } catch {
    return null;
  }
}
