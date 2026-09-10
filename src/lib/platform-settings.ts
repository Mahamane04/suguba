/**
 * Lecture des réglages de la plateforme — SERVEUR UNIQUEMENT.
 *
 * Les réglages vivent dans `platform_settings`, une table à une seule ligne,
 * accessible uniquement en service_role (voir migration-tarification.sql).
 * Ne jamais importer ce fichier depuis un composant 'use client'.
 */
import { getSupabaseAdmin } from './supabase-admin';
import { completerReglages, REGLAGES_PAR_DEFAUT, type ReglagesPlateforme } from './pricing';

export interface EtatReglages {
  reglages: ReglagesPlateforme;
  /**
   * Faux tant que l'admin n'a jamais enregistré ses propres valeurs. Les coûts
   * fixes par défaut sont une estimation provisoire : l'écran des réglages
   * doit le dire clairement, sans quoi des marges calculées sur des chiffres
   * inventés passeraient pour des marges réelles.
   */
  confirme: boolean;
  majLe: string | null;
}

export async function chargerReglages(): Promise<EtatReglages> {
  const admin = getSupabaseAdmin();
  if (!admin) return { reglages: REGLAGES_PAR_DEFAUT, confirme: false, majLe: null };

  const { data, error } = await admin
    .from('platform_settings')
    .select('valeurs, confirme, updated_at')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    // Table absente (migration pas encore appliquée) ou jamais renseignée :
    // les valeurs par défaut s'appliquent, clairement marquées non confirmées.
    if (error) console.warn('[REGLAGES] Lecture impossible, valeurs par défaut:', error.message);
    return { reglages: REGLAGES_PAR_DEFAUT, confirme: false, majLe: null };
  }

  return {
    reglages: completerReglages(data.valeurs as Partial<ReglagesPlateforme>),
    confirme: Boolean(data.confirme),
    majLe: data.updated_at || null,
  };
}
