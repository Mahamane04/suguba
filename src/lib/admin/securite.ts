import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { jsonStable, validationRequise, type TypeValidation, LIBELLES_VALIDATION } from './securite-regles';

/**
 * Sécurité de l'équipe (A3, 2026-09-27) — SERVEUR UNIQUEMENT.
 * Réglages (double authentification obligatoire, seuil de double
 * validation) et double validation des opérations sensibles.
 */

export interface ReglagesSecurite { mfaObligatoire: boolean; seuilValidation: number; disponible: boolean; tableAbsente?: boolean }

/**
 * Table absente (SQL A3 non exécuté) : rien d'obligatoire, double validation désactivée.
 * Erreur de LECTURE (table présente) : `disponible: false` — l'appelant doit
 * refuser l'opération plutôt que de la laisser passer sans contrôle (2026-10-01).
 */
export async function lireSecurite(admin: SupabaseClient): Promise<ReglagesSecurite> {
  const { data, error } = await admin.from('securite_equipe').select('mfa_obligatoire, seuil_validation').eq('id', 1).maybeSingle();
  const tableAbsente = !!error && (['PGRST205', '42P01'].includes(String(error.code)) || /securite_equipe/.test(String(error.message)));
  if (error || !data) return { mfaObligatoire: false, seuilValidation: 0, disponible: !error, tableAbsente };
  return { mfaObligatoire: data.mfa_obligatoire === true, seuilValidation: Math.max(0, Number(data.seuil_validation) || 0), disponible: true };
}

export function empreinteOperation(p: { type: TypeValidation; dossier: string; montant: number | null; resume: Record<string, unknown> }): string {
  return createHash('sha256').update(jsonStable({ type: p.type, dossier: p.dossier, montant: p.montant, resume: p.resume })).digest('hex');
}

export type ResultatValidation =
  | { ok: true; validationId: string | null }
  | { ok: false; status: number; corps: { error: string; validationRequise?: boolean; validationId?: string } };

/**
 * Avant une opération sensible. Sous le seuil : ok. Au-dessus : il faut une
 * demande APPROUVÉE par un autre membre pour exactement cette opération
 * (même empreinte). Sinon une demande est créée (ou gardée) et l'opération
 * est refusée (409, jamais 2xx : les écrans existants prennent tout 2xx pour
 * un succès) jusqu'à l'approbation. Une demande dont le contenu a
 * changé devient caduque.
 */
export async function exigerValidation(admin: SupabaseClient, p: {
  type: TypeValidation; dossier: string; montant: number | null; resume: Record<string, unknown>; demandeurId: string;
}): Promise<ResultatValidation> {
  const securite = await lireSecurite(admin);
  // Réglage illisible (table présente) : on refuse plutôt que de payer sans double validation (FIN-06, 2026-10-01).
  if (!securite.disponible && !securite.tableAbsente) return { ok: false, status: 503, corps: { error: 'Contrôle de sécurité indisponible. Réessayez dans un instant.' } };
  const { seuilValidation } = securite;
  if (!validationRequise(p.type, p.montant, seuilValidation)) return { ok: true, validationId: null };
  const empreinte = empreinteOperation(p);

  const { data: ouverte, error } = await admin.from('validations_admin')
    .select('id, statut, empreinte').eq('type', p.type).eq('dossier', p.dossier)
    .in('statut', ['en_attente', 'approuvee']).maybeSingle();
  if (error) return { ok: false, status: 503, corps: { error: 'Double validation indisponible. Réessayez.' } };

  if (ouverte && ouverte.empreinte === empreinte) {
    if (ouverte.statut === 'approuvee') return { ok: true, validationId: ouverte.id };
    return { ok: false, status: 409, corps: { error: `${LIBELLES_VALIDATION[p.type]} : en attente d’approbation par un collègue (Équipe et sécurité → Validations).`, validationRequise: true, validationId: ouverte.id } };
  }
  if (ouverte) await admin.from('validations_admin').update({ statut: 'caduque' }).eq('id', ouverte.id);

  const { data: cree, error: e2 } = await admin.from('validations_admin').insert({
    type: p.type, dossier: p.dossier, montant: p.montant, resume: p.resume, empreinte, demandeur_id: p.demandeurId,
  }).select('id').maybeSingle();
  if (e2 || !cree) return { ok: false, status: 503, corps: { error: 'Double validation indisponible. Réessayez.' } };
  return { ok: false, status: 409, corps: { error: `${LIBELLES_VALIDATION[p.type]} au-dessus du seuil : demande envoyée à un collègue pour approbation (Équipe et sécurité → Validations).`, validationRequise: true, validationId: cree.id } };
}

/** Après l'opération réussie : la validation est consommée (non réutilisable). */
export async function marquerExecutee(admin: SupabaseClient, validationId: string | null): Promise<void> {
  if (!validationId) return;
  await admin.from('validations_admin').update({ statut: 'executee', execute_le: new Date().toISOString() }).eq('id', validationId).eq('statut', 'approuvee');
}
