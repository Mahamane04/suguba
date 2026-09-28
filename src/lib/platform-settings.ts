/**
 * Lecture des réglages de la plateforme — SERVEUR UNIQUEMENT.
 *
 * Les réglages vivent dans `platform_settings`, une table à une seule ligne,
 * accessible uniquement en service_role (voir migration-tarification.sql).
 * Ne jamais importer ce fichier depuis un composant 'use client'.
 */
import { getSupabaseAdmin } from './supabase-admin';
import { completerReglages, REGLAGES_PAR_DEFAUT, type ReglagesPlateforme } from './pricing';
import { completerFraisPaiement } from './frais-paiement';

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

export async function chargerReglages(strict = false): Promise<EtatReglages> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    if (strict) throw new Error('Réglages indisponibles. Réessayez.');
    return { reglages: REGLAGES_PAR_DEFAUT, confirme: false, majLe: null };
  }

  // `*` : inclut `tarifs_saspay` dès que la base l'a (SQL du 2026-09-27), sans casser avant.
  const { data, error } = await admin
    .from('platform_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error && strict) throw new Error('Réglages indisponibles. Réessayez.');
  if (error || !data) {
    // Table absente (migration pas encore appliquée) ou jamais renseignée :
    // les valeurs par défaut s'appliquent, clairement marquées non confirmées.
    if (error) console.warn('[REGLAGES] Lecture impossible, valeurs par défaut:', error.message);
    return { reglages: REGLAGES_PAR_DEFAUT, confirme: false, majLe: null };
  }

  return {
    reglages: avecTarifsReleves(completerReglages(data.valeurs as Partial<ReglagesPlateforme>), data.tarifs_saspay),
    confirme: Boolean(data.confirme),
    majLe: data.updated_at || null,
  };
}

/**
 * Tarifs SasPay relus automatiquement (colonne `tarifs_saspay`, voir
 * tarifs-saspay.ts) : ils priment sur ceux gardés dans les réglages. Un réseau
 * absent du relevé garde sa valeur enregistrée.
 */
function avecTarifsReleves(r: ReglagesPlateforme, brut: unknown): ReglagesPlateforme {
  const b: any = brut && typeof brut === 'object' ? brut : null;
  if (!b || !b.reseaux || typeof b.reseaux !== 'object' || Object.keys(b.reseaux).length === 0) return r;
  const f = completerFraisPaiement(r.fraisPaiement);
  const lus = completerFraisPaiement({ saspay: b }).saspay;
  return { ...r, fraisPaiement: { ...f, saspay: { releveLe: lus.releveLe, reseaux: { ...f.saspay.reseaux, ...lus.reseaux } } } };
}
