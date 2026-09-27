/**
 * Tarifs SasPay tenus à jour AUTOMATIQUEMENT (2026-09-27) — SERVEUR UNIQUEMENT.
 *
 * Les frais SasPay ne sont écrits nulle part à la main : ils sont relus chez
 * SasPay (GET /pricing/my-rates) et enregistrés dans la colonne
 * `platform_settings.tarifs_saspay`, que chargerReglages() applique partout.
 *
 * ⚠️ SasPay met 10 à 30 secondes à répondre sur ce point (mesuré le
 * 2026-09-27). Il n'est donc JAMAIS interrogé pendant qu'un client paie : les
 * paiements lisent toujours les tarifs enregistrés, instantanément. La
 * relecture se fait APRÈS la réponse (`after()` de Next), dès que le dernier
 * relevé a plus de 6 heures, ou à la demande de l'équipe (« Relire maintenant »).
 *
 * Colonne à part, et pas dans `valeurs` : la relecture automatique ne peut
 * jamais écraser un réglage que l'équipe est en train d'enregistrer.
 */
import { after } from 'next/server';
import { lireMesTarifs } from './saspay';
import { getSupabaseAdmin } from './supabase-admin';
import type { ReglagesFraisPaiement, TarifsSasPay } from './frais-paiement';

/** Au-delà, le relevé est jugé ancien et relu en arrière-plan. */
export const DUREE_VALIDITE_RELEVE_MS = 6 * 60 * 60 * 1000;
/** Pas de nouvel essai avant 10 minutes sur ce serveur, réussi ou non. */
const PAUSE_ENTRE_ESSAIS_MS = 10 * 60 * 1000;
/** Délai laissé à SasPay pour répondre (il met jusqu'à 30 s). */
const DELAI_LECTURE_MS = 45000;

let dernierEssai = 0;

export function releveAncien(f: Pick<ReglagesFraisPaiement, 'saspay'>, maintenant = Date.now()): boolean {
  const le = f.saspay.releveLe ? Date.parse(f.saspay.releveLe) : NaN;
  return !Number.isFinite(le) || maintenant - le > DUREE_VALIDITE_RELEVE_MS;
}

/**
 * Relit les tarifs chez SasPay et les enregistre. Lent : à n'appeler que
 * hors du chemin d'un paiement (arrière-plan ou bouton de l'équipe).
 */
export async function actualiserTarifsSasPay(): Promise<{ ok: true; tarifs: TarifsSasPay; enregistre: boolean } | { ok: false; erreur: string }> {
  dernierEssai = Date.now();
  const lu = await lireMesTarifs(DELAI_LECTURE_MS);
  if (!lu.ok) return lu;
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: true, tarifs: lu.tarifs, enregistre: false };
  const { error } = await admin.from('platform_settings').update({ tarifs_saspay: lu.tarifs }).eq('id', 1);
  if (error) console.warn('[SASPAY] Tarifs relus mais non enregistrés (SQL du 2026-09-27 à lancer ?):', error.message);
  return { ok: true, tarifs: lu.tarifs, enregistre: !error };
}

/**
 * Relit les tarifs en arrière-plan, APRÈS la réponse, si le relevé est ancien.
 * N'attend rien et ne lève jamais : la requête en cours n'est pas ralentie.
 */
export function actualiserSiAncien(f: Pick<ReglagesFraisPaiement, 'saspay'>): void {
  const maintenant = Date.now();
  if (!releveAncien(f, maintenant) || maintenant - dernierEssai < PAUSE_ENTRE_ESSAIS_MS) return;
  dernierEssai = maintenant;
  try {
    after(async () => {
      const r = await actualiserTarifsSasPay().catch((e) => ({ ok: false as const, erreur: String(e) }));
      if (!r.ok) console.warn('[SASPAY] Relecture automatique des tarifs impossible :', r.erreur);
    });
  } catch {
    // Hors d'une requête Next (tests, scripts) : rien à planifier.
  }
}
