import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Journal général des actions admin (A2, 2026-09-27) — SERVEUR UNIQUEMENT.
 *
 * Qui, quand, quelle action, sur quel dossier, avec quel motif et quels
 * changements (avant / après). Non modifiable depuis l'application (la base
 * refuse UPDATE et DELETE). Jamais de secret : les champs sensibles sont
 * retirés avant écriture.
 *
 * Écrire le journal ne doit JAMAIS faire échouer l'action elle-même : une
 * erreur d'écriture est remontée dans les logs du serveur, pas au client.
 */

export interface EntreeJournal {
  auteurId: string;
  action: string;
  dossier?: string | null;
  motif?: string | null;
  avant?: Record<string, unknown> | null;
  apres?: Record<string, unknown> | null;
}

const SENSIBLES = /(password|mot_?de_?passe|token|secret|otp|code_?remise|delivery_otp|cle|key|hash)/i;

/** Retire les champs sensibles et tronque les textes longs. */
export function nettoyerDetails(v: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!v) return null;
  const sortie: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    if (SENSIBLES.test(k)) { sortie[k] = '[masqué]'; continue; }
    sortie[k] = typeof val === 'string' && val.length > 300 ? `${val.slice(0, 300)}…` : val;
  }
  return sortie;
}

export async function journaliserAction(admin: SupabaseClient, e: EntreeJournal): Promise<void> {
  try {
    const { error } = await admin.from('journal_admin').insert({
      auteur_id: e.auteurId,
      action: e.action.slice(0, 80),
      dossier: e.dossier ? e.dossier.slice(0, 160) : null,
      motif: e.motif ? e.motif.slice(0, 500) : null,
      avant: nettoyerDetails(e.avant),
      apres: nettoyerDetails(e.apres),
    });
    if (error && !['42P01', 'PGRST205'].includes(String(error.code))) console.error('[journal_admin]', error.message);
  } catch (err) {
    console.error('[journal_admin]', (err as Error).message);
  }
}
