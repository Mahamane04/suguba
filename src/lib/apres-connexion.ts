'use client';

/**
 * Page à rouvrir après la connexion (`/login?next=/equipe/invitation`).
 *
 * Gardée sur l'appareil 30 minutes, et PAS ajoutée à l'adresse de retour de
 * l'e-mail de connexion : Supabase n'accepte que des adresses de retour
 * enregistrées à l'avance, et une adresse modifiée pourrait faire échouer la
 * connexion elle-même.
 *
 * Seuls les chemins internes sont acceptés : `//site.com` ou `https://…`
 * transformeraient ce paramètre en redirection vers un site tiers.
 */

const CLE = 'suguba_apres_connexion';
const DUREE = 30 * 60 * 1000;

export function cheminInterne(valeur: string | null | undefined): string | null {
  if (!valeur || !valeur.startsWith('/') || valeur.startsWith('//') || valeur.includes('\\')) return null;
  return valeur.slice(0, 200);
}

export function memoriserApresConnexion(valeur: string | null) {
  const chemin = cheminInterne(valeur);
  if (!chemin) return;
  try { localStorage.setItem(CLE, JSON.stringify({ chemin, le: Date.now() })); } catch { /* stockage bloqué */ }
}

/** Lit ET efface : la destination ne sert qu'une fois. */
export function prendreApresConnexion(): string | null {
  try {
    const brut = localStorage.getItem(CLE);
    localStorage.removeItem(CLE);
    if (!brut) return null;
    const { chemin, le } = JSON.parse(brut);
    if (typeof le !== 'number' || Date.now() - le > DUREE) return null;
    return cheminInterne(chemin);
  } catch { return null; }
}
