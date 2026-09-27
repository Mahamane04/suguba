/**
 * Sécurité de l'équipe (A3, 2026-09-27) — règles PURES (navigateur, serveur,
 * tests). Voir src/lib/admin/securite.ts pour la partie serveur.
 */

export type TypeValidation = 'retrait' | 'avance_commission' | 'part_suguba';

export const LIBELLES_VALIDATION: Record<TypeValidation, string> = {
  retrait: 'Paiement d’un retrait',
  avance_commission: 'Avance d’une commission',
  part_suguba: 'Baisse de la part Suguba',
};

/** Permission nécessaire pour APPROUVER (la même que pour exécuter). */
export const PERMISSION_VALIDATION: Record<TypeValidation, 'finance.payer' | 'marge.reduire'> = {
  retrait: 'finance.payer',
  avance_commission: 'finance.payer',
  part_suguba: 'marge.reduire',
};

/**
 * Double authentification à la connexion d'un MEMBRE de l'équipe :
 *   - déjà inscrite (facteur vérifié) → le code est exigé à chaque connexion ;
 *   - pas encore inscrite et rendue obligatoire → inscription imposée ;
 *   - sinon → rien.
 * Un non-membre n'est jamais concerné.
 */
export function decisionMfa(p: { estMembre: boolean; facteursVerifies: number; aal: string | null; obligatoire: boolean }): 'ok' | 'verifier' | 'inscrire' {
  if (!p.estMembre) return 'ok';
  if (p.facteursVerifies > 0) return p.aal === 'aal2' ? 'ok' : 'verifier';
  return p.obligatoire ? 'inscrire' : 'ok';
}

/** Niveau d'assurance (aal) lu dans un jeton Supabase DÉJÀ vérifié par getUser. */
export function aalDuJeton(jeton: string): string | null {
  try {
    const partie = jeton.split('.')[1];
    if (!partie) return null;
    // atob plutôt que Buffer : ce module est aussi chargé par le middleware (Edge).
    const b64 = partie.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
    return typeof json.aal === 'string' ? json.aal : null;
  } catch {
    return null;
  }
}

/** Faut-il une double validation ? Seuil 0 = désactivée. La part Suguba n'a pas de montant : dès que la double validation est active. */
export function validationRequise(type: TypeValidation, montant: number | null, seuil: number): boolean {
  if (!(seuil > 0)) return false;
  if (type === 'part_suguba') return true;
  return Number(montant) >= seuil;
}

/** JSON stable (clés triées) : même contenu → même empreinte. */
export function jsonStable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonStable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${jsonStable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** Session émise avant une révocation (« Déconnecter partout ») : refusée. iat en secondes. */
export function sessionRevoquee(iat: number, revoqueeAvant: string | null | undefined): boolean {
  if (!revoqueeAvant) return false;
  const t = Date.parse(revoqueeAvant);
  return Number.isFinite(t) && iat * 1000 < t;
}
