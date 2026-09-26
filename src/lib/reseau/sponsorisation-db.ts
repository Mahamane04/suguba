/**
 * Sponsorisation (§ 16, § 17) — accès base (SERVEUR).
 */
import { getSupabaseAdmin } from '../supabase-admin';
import { notifier } from './notifications';
import { finDuPack, sponsorisationActive, type Emplacement } from './sponsoring';

export interface Pack {
  id: string;
  nom: string;
  prix: number;
  partagesVises: number;
  maxRevendeurs: number;
  dureeJours: number;
  emplacements: string[];
  description: string | null;
  actif: boolean;
}

export interface Sponsorisation {
  id: string;
  packId: string | null;
  supplierId: string | null;
  sujetType: 'product' | 'store' | 'promotion' | 'campaign';
  sujetRef: string | null;
  libelle: string | null;
  emplacement: string;
  budget: number;
  statut: 'pending' | 'active' | 'paused' | 'ended' | 'rejected';
  commenceLe: string;
  finitLe: string | null;
  impressions: number;
  clics: number;
  /** Paiement (2026-09-26) : montant reçu, date, référence ; activation. */
  paiement: { recu: number; recuLe: string | null; reference: string | null; activeeLe: string | null };
}

function versPack(r: any): Pack {
  return {
    id: r.id,
    nom: r.name,
    prix: Number(r.price) || 0,
    partagesVises: Number(r.shares_target) || 0,
    maxRevendeurs: Number(r.max_resellers) || 0,
    dureeJours: Number(r.duration_days) || 7,
    emplacements: Array.isArray(r.slots) ? r.slots : [],
    description: r.description || null,
    actif: Boolean(r.active),
  };
}

function versSponsorisation(r: any): Sponsorisation {
  return {
    id: r.id,
    packId: r.plan_id || null,
    supplierId: r.supplier_id || null,
    sujetType: r.subject_type,
    sujetRef: r.subject_ref || null,
    libelle: r.label || null,
    emplacement: r.slot,
    budget: Number(r.budget) || 0,
    statut: r.status,
    commenceLe: r.starts_at,
    finitLe: r.ends_at || null,
    impressions: Number(r.impressions) || 0,
    clics: Number(r.clicks) || 0,
    paiement: {
      recu: Number(r.paid_amount) || 0, recuLe: r.paid_at || null,
      reference: r.payment_reference || null, activeeLe: r.activated_at || null,
    },
  };
}

export async function listerPacks(actifsSeulement = true): Promise<Pack[]> {
  const a = getSupabaseAdmin();
  if (!a) return [];
  let requete = a.from('sponsorship_plans').select('*').order('position', { ascending: true });
  if (actifsSeulement) requete = requete.eq('active', true);
  const { data, error } = await requete;
  if (error || !data) return [];
  return data.map(versPack);
}

/**
 * Demande de sponsorisation. Elle naît `pending` : c'est Suguba qui l'active
 * après encaissement. Un fournisseur ne s'affiche pas en une de l'accueil
 * simplement parce qu'il a cliqué sur un bouton.
 */
export async function demanderSponsorisation(params: {
  supplierId: string;
  packId: string | null;
  sujetType: Sponsorisation['sujetType'];
  sujetRef: string | null;
  libelle?: string | null;
  emplacement: Emplacement | string;
}): Promise<Sponsorisation | null> {
  const a = getSupabaseAdmin();
  if (!a) return null;

  let budget = 0;
  let fin: string | null = null;
  if (params.packId) {
    const { data: pack } = await a.from('sponsorship_plans').select('*').eq('id', params.packId).maybeSingle();
    if (pack) {
      budget = Number(pack.price) || 0;
      fin = finDuPack(new Date(), Number(pack.duration_days) || 7);
    }
  }

  const { data, error } = await a
    .from('sponsorships')
    .insert({
      plan_id: params.packId,
      supplier_id: params.supplierId,
      subject_type: params.sujetType,
      subject_ref: params.sujetRef,
      label: params.libelle || null,
      slot: params.emplacement,
      budget,
      ends_at: fin,
    })
    .select('*')
    .maybeSingle();
  if (error || !data) return null;
  return versSponsorisation(data);
}

export async function sponsorisationsDuFournisseur(supplierId: string): Promise<Sponsorisation[]> {
  const a = getSupabaseAdmin();
  if (!a) return [];
  const { data, error } = await a
    .from('sponsorships')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data.map(versSponsorisation);
}

export async function toutesLesSponsorisations(statut?: string): Promise<Sponsorisation[]> {
  const a = getSupabaseAdmin();
  if (!a) return [];
  let requete = a.from('sponsorships').select('*').order('created_at', { ascending: false }).limit(200);
  if (statut) requete = requete.eq('status', statut);
  const { data, error } = await requete;
  if (error || !data) return [];
  return data.map(versSponsorisation);
}

/** Références sponsorisées et RÉELLEMENT en cours pour un emplacement donné. */
export async function refsSponsorisees(emplacement: Emplacement | string): Promise<string[]> {
  const a = getSupabaseAdmin();
  if (!a) return [];
  const { data, error } = await a
    .from('sponsorships')
    .select('*')
    .eq('slot', emplacement)
    .eq('status', 'active')
    .limit(20);
  if (error || !data) return [];
  const maintenant = new Date();
  return data
    .map(versSponsorisation)
    .filter((s) =>
      sponsorisationActive(
        { id: s.id, sujetRef: s.sujetRef, emplacement: s.emplacement, statut: s.statut, commenceLe: s.commenceLe, finitLe: s.finitLe },
        maintenant,
      ),
    )
    .map((s) => s.sujetRef)
    .filter((r): r is string => Boolean(r));
}

export async function changerStatutSponsorisation(
  id: string,
  statut: Sponsorisation['statut'],
): Promise<{ ok: boolean; erreur?: string }> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.' };

  const maj: Record<string, unknown> = { status: statut };
  if (statut === 'active') {
    const { data: s } = await a.from('sponsorships').select('*').eq('id', id).maybeSingle();
    if (!s) return { ok: false, erreur: 'Sponsorisation introuvable.' };
    // Paiement (2026-09-26) : pas d'activation sans le prix réglé en entier.
    if ('paid_amount' in s && (Number(s.paid_amount) || 0) < (Number(s.budget) || 0)) {
      return { ok: false, erreur: `Pack pas encore réglé en entier (${(Number(s.budget) || 0).toLocaleString('fr-FR')} F attendus) : enregistrez le paiement reçu avant d’activer.` };
    }
    // La durée du pack démarre à la PREMIÈRE activation, pas à la demande :
    // un pack payé tard ne perd pas de jours.
    if ('activated_at' in s && !s.activated_at) {
      const { data: pack } = s.plan_id ? await a.from('sponsorship_plans').select('duration_days').eq('id', s.plan_id).maybeSingle() : { data: null };
      const maintenant = new Date();
      maj.activated_at = maintenant.toISOString();
      maj.starts_at = maintenant.toISOString();
      if (pack) maj.ends_at = finDuPack(maintenant, Number(pack.duration_days) || 7);
    }
  }
  const { data, error } = await a.from('sponsorships').update(maj).eq('id', id).select('supplier_id, label').maybeSingle();
  if (error && /SPONSORISATION_NON_REGLEE/.test(error.message)) return { ok: false, erreur: 'Pack pas encore réglé en entier : enregistrez le paiement reçu avant d’activer.' };
  if (error) return { ok: false, erreur: error.message };
  if (data?.supplier_id && (statut === 'active' || statut === 'rejected')) {
    await notifier(data.supplier_id, {
      type: 'sponsorisation',
      titre: statut === 'active' ? 'Sponsorisation en ligne' : 'Sponsorisation refusée',
      texte: data.label || null,
      lien: '/supplier/sponsorisation',
    });
  }
  return { ok: true };
}

/**
 * Paiement reçu d'une sponsorisation (2026-09-26) : montant TOTAL reçu à ce
 * jour et sa référence (reçu, transaction Mobile Money…).
 */
export async function enregistrerPaiementSponsorisation(
  id: string,
  adminId: string,
  montantBrut: unknown,
  referenceBrute: unknown,
): Promise<{ ok: boolean; erreur?: string }> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.' };
  const montant = Math.round(Number(montantBrut));
  const reference = typeof referenceBrute === 'string' ? referenceBrute.trim().slice(0, 120) : '';
  if (!Number.isFinite(montant) || montant < 0 || montant > 100_000_000) return { ok: false, erreur: 'Montant invalide.' };
  if (montant > 0 && reference.length < 3) return { ok: false, erreur: 'Indiquez la référence du paiement (reçu, transaction…).' };
  const { data, error } = await a.from('sponsorships').update({
    paid_amount: montant, paid_at: new Date().toISOString(), payment_reference: reference || null, paid_by: adminId,
  }).eq('id', id).select('supplier_id, label, budget').maybeSingle();
  if (error) return { ok: false, erreur: /paid_amount/.test(error.message) ? 'Le suivi du paiement sera disponible après la mise à jour de la base.' : 'Enregistrement impossible.' };
  if (data?.supplier_id && montant >= (Number(data.budget) || 0) && montant > 0) {
    await notifier(data.supplier_id, {
      type: 'sponsorisation', titre: 'Paiement de sponsorisation reçu',
      texte: `${montant.toLocaleString('fr-FR')} F reçus${data.label ? ` · ${data.label}` : ''}. Votre reçu est disponible.`,
      lien: '/supplier/sponsorisation',
    });
  }
  return { ok: true };
}
