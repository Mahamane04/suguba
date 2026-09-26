import type { SupabaseClient } from '@supabase/supabase-js';
import { notifier } from './reseau/notifications';

/**
 * Paiements reçus des campagnes et sponsorisations (2026-09-26, Protection
 * Suguba — lot 1) — SERVEUR UNIQUEMENT.
 *
 * Un HISTORIQUE remplace la saisie d'un total qui s'écrasait : chaque
 * paiement reçu est une ligne (montant, référence, qui l'a constaté). Une
 * même référence ne sert qu'une fois ; une erreur se corrige en ANNULANT le
 * paiement avec un motif, jamais en l'effaçant. Le total reçu (budget_recu,
 * paid_amount) est recalculé par la base et ne s'écrit plus à la main.
 */

export type CiblePaiement = 'campagne' | 'sponsorisation';

export class PaiementError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export interface PaiementRecu {
  id: string; montant: number; reference: string; note: string | null;
  recuLe: string; annuleLe: string | null; motifAnnulation: string | null;
}

const tableAbsente = (code: unknown) => ['42P01', 'PGRST205'].includes(String(code));

export async function listerPaiements(admin: SupabaseClient, cible: CiblePaiement, cibleIds: string[]): Promise<Record<string, PaiementRecu[]>> {
  if (!cibleIds.length) return {};
  const { data, error } = await admin.from('paiements_recus').select('*')
    .eq('cible', cible).in('cible_id', cibleIds).order('created_at', { ascending: true });
  if (error) return {};
  const par: Record<string, PaiementRecu[]> = {};
  for (const p of data || []) {
    (par[p.cible_id] ||= []).push({
      id: p.id, montant: Number(p.montant) || 0, reference: p.reference, note: p.note || null,
      recuLe: p.created_at, annuleLe: p.annule_le || null, motifAnnulation: p.motif_annulation || null,
    });
  }
  return par;
}

export async function ajouterPaiement(
  admin: SupabaseClient, adminId: string,
  params: { cible: unknown; cibleId: unknown; montant: unknown; reference: unknown; note?: unknown },
) {
  const cible = params.cible === 'campagne' || params.cible === 'sponsorisation' ? params.cible : null;
  const cibleId = typeof params.cibleId === 'string' ? params.cibleId : '';
  const montant = Math.round(Number(params.montant));
  const reference = typeof params.reference === 'string' ? params.reference.trim().slice(0, 120) : '';
  const note = typeof params.note === 'string' ? params.note.trim().slice(0, 300) : '';
  if (!cible || !cibleId) throw new PaiementError('Paiement mal adressé.', 400);
  if (!Number.isFinite(montant) || montant <= 0 || montant > 100_000_000) throw new PaiementError('Indiquez le montant reçu.', 400);
  if (reference.length < 3) throw new PaiementError('Indiquez la référence du paiement (reçu, transaction Mobile Money…).', 400);

  // La cible doit exister : une campagne FOURNISSEUR, ou une sponsorisation.
  const { data: cibleLigne } = cible === 'campagne'
    ? await admin.from('missions').select('id, supplier_id').eq('id', cibleId).not('supplier_id', 'is', null).maybeSingle()
    : await admin.from('sponsorships').select('id, supplier_id').eq('id', cibleId).maybeSingle();
  if (!cibleLigne) throw new PaiementError(cible === 'campagne' ? 'Campagne fournisseur introuvable.' : 'Sponsorisation introuvable.', 404);

  const { error } = await admin.from('paiements_recus').insert({
    cible, cible_id: cibleId, montant, reference, note: note || null, recu_par: adminId,
  });
  if (error) {
    if (error.code === '23505') throw new PaiementError('Cette référence de paiement est déjà enregistrée : un même paiement ne peut financer qu’un seul engagement.', 409);
    if (tableAbsente(error.code)) throw new PaiementError('L’historique des paiements sera disponible après la mise à jour de la base.', 503);
    throw new PaiementError('Enregistrement impossible. Réessayez.', 503);
  }

  // Sponsorisation désormais réglée en entier : le fournisseur est prévenu.
  if (cible === 'sponsorisation' && cibleLigne.supplier_id) {
    const { data: s } = await admin.from('sponsorships').select('paid_amount, budget, label').eq('id', cibleId).maybeSingle();
    const paye = Number(s?.paid_amount) || 0;
    const prix = Number(s?.budget) || 0;
    if (s && paye >= prix && paye - montant < prix) {
      await notifier(cibleLigne.supplier_id, {
        type: 'sponsorisation', titre: 'Paiement de sponsorisation reçu',
        texte: `${paye.toLocaleString('fr-FR')} F reçus${s.label ? ` · ${s.label}` : ''}. Votre reçu est disponible.`,
        lien: '/supplier/sponsorisation',
      });
    }
  }
  return { ok: true };
}

export async function annulerPaiement(admin: SupabaseClient, adminId: string, params: { id: unknown; motif: unknown }) {
  const id = typeof params.id === 'string' ? params.id : '';
  const motif = typeof params.motif === 'string' ? params.motif.trim().slice(0, 300) : '';
  if (!id) throw new PaiementError('Paiement manquant.', 400);
  if (motif.length < 3) throw new PaiementError('Indiquez le motif de l’annulation.', 400);
  const { data, error } = await admin.from('paiements_recus')
    .update({ annule_le: new Date().toISOString(), annule_par: adminId, motif_annulation: motif })
    .eq('id', id).is('annule_le', null).select('id').maybeSingle();
  if (error) throw new PaiementError('Annulation impossible. Réessayez.', 503);
  if (!data) throw new PaiementError('Ce paiement est déjà annulé.', 409);
  return { ok: true };
}
