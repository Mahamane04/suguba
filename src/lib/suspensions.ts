import type { SupabaseClient } from '@supabase/supabase-js';
import { notifier } from './reseau/notifications';

/**
 * Suspension d'un partenaire (2026-09-26, Protection Suguba — lot 3) —
 * SERVEUR UNIQUEMENT.
 *
 * Une suspension a toujours un MOTIF, que le partenaire voit et peut
 * CONTESTER (/compte/suspension). Elle ferme son espace pour ce rôle, rien
 * de plus : ses commandes en cours, ses gains et son historique restent ; la
 * réponse donne à l'admin ce qui est en cours, à traiter à part.
 */

export class SuspensionError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const LIBELLE_ROLE: Record<string, string> = { reseller: 'revendeur', supplier: 'fournisseur', driver: 'livreur' };
const EN_COURS = ['pending_call', 'confirmed', 'dispatched', 'in_transit'];

export interface Engagements { commandesEnCours: number; gainsEnAttente: number; gainsDisponibles: number }

async function engagements(admin: SupabaseClient, profileId: string, role: string): Promise<Engagements> {
  const e: Engagements = { commandesEnCours: 0, gainsEnAttente: 0, gainsDisponibles: 0 };
  if (role === 'reseller') {
    const [{ count }, { data: com }] = await Promise.all([
      admin.from('orders').select('id', { count: 'exact', head: true }).eq('reseller_id', profileId).in('status', EN_COURS),
      admin.from('commissions').select('amount, status').eq('reseller_id', profileId).in('status', ['pending', 'locked', 'available']),
    ]);
    e.commandesEnCours = count || 0;
    for (const c of com || []) {
      if (c.status === 'available') e.gainsDisponibles += Number(c.amount) || 0;
      else e.gainsEnAttente += Number(c.amount) || 0;
    }
  } else if (role === 'driver') {
    const { count } = await admin.from('orders').select('id', { count: 'exact', head: true }).eq('assigned_driver_id', profileId).in('status', EN_COURS);
    e.commandesEnCours = count || 0;
  } else if (role === 'supplier') {
    const { data: produits } = await admin.from('products').select('id').eq('supplier_id', profileId).limit(2000);
    const ids = (produits || []).map((p: any) => p.id);
    if (ids.length) {
      const { count } = await admin.from('orders').select('id', { count: 'exact', head: true }).in('product_id', ids).in('status', EN_COURS);
      e.commandesEnCours = count || 0;
    }
  }
  return e;
}

export async function suspendre(admin: SupabaseClient, adminId: string, profileId: string, role: string, motifBrut: unknown) {
  const motif = typeof motifBrut === 'string' ? motifBrut.trim().slice(0, 500) : '';
  if (motif.length < 5) throw new SuspensionError('Indiquez le motif de la suspension : le partenaire le verra et pourra le contester.', 400);
  const { error: e1 } = await admin.from('suspensions').insert({ profile_id: profileId, role, motif, suspendu_par: adminId });
  if (e1) {
    if (e1.code === '23505') throw new SuspensionError('Ce rôle est déjà suspendu.', 409);
    if (['42P01', 'PGRST205'].includes(String(e1.code))) throw new SuspensionError('Les suspensions motivées seront disponibles après la mise à jour de la base.', 503);
    throw new SuspensionError('Suspension impossible. Réessayez.', 503);
  }
  const { error: e2 } = await admin.from('profile_roles').update({ status: 'suspended' }).eq('profile_id', profileId).eq('role', role);
  if (e2) {
    await admin.from('suspensions').update({ levee_le: new Date().toISOString(), levee_par: adminId, decision: 'Annulée : échec de la suspension' })
      .eq('profile_id', profileId).eq('role', role).is('levee_le', null);
    throw new SuspensionError('Suspension impossible. Réessayez.', 503);
  }
  await notifier(profileId, {
    type: 'info', titre: `Espace ${LIBELLE_ROLE[role] || ''} suspendu`.trim(),
    texte: `${motif} — Vous pouvez contester cette décision.`, lien: '/compte/suspension',
  });
  return { engagements: await engagements(admin, profileId, role) };
}

export async function reactiver(admin: SupabaseClient, adminId: string, profileId: string, role: string, decisionBrute: unknown) {
  const decision = typeof decisionBrute === 'string' ? decisionBrute.trim().slice(0, 500) : '';
  const { error } = await admin.from('profile_roles').update({ status: 'active' }).eq('profile_id', profileId).eq('role', role);
  if (error) throw new SuspensionError('Réactivation impossible. Réessayez.', 503);
  await admin.from('suspensions').update({ levee_le: new Date().toISOString(), levee_par: adminId, decision: decision || 'Réactivé' })
    .eq('profile_id', profileId).eq('role', role).is('levee_le', null);
  await notifier(profileId, {
    type: 'info', titre: `Espace ${LIBELLE_ROLE[role] || ''} réactivé`.trim(), texte: decision || 'Votre espace est de nouveau ouvert.', lien: '/',
  });
  return { ok: true };
}

/** Suspension en cours de chaque compte d'une liste (vue admin). */
export async function suspensionsEnCours(admin: SupabaseClient, ids: string[], role: string) {
  const par = new Map<string, { motif: string; depuis: string; contestation: string | null; contesteeLe: string | null }>();
  if (!ids.length) return par;
  const { data, error } = await admin.from('suspensions').select('profile_id, motif, suspendu_le, contestation, contestee_le')
    .eq('role', role).is('levee_le', null).in('profile_id', ids.slice(0, 2000));
  if (error) return par;
  for (const s of data || []) par.set(s.profile_id, { motif: s.motif, depuis: s.suspendu_le, contestation: s.contestation || null, contesteeLe: s.contestee_le || null });
  return par;
}

// ── Côté partenaire ─────────────────────────────────────────────────────────
export async function mesSuspensions(admin: SupabaseClient, profileId: string) {
  const { data, error } = await admin.from('suspensions').select('id, role, motif, suspendu_le, contestation, contestee_le, levee_le, decision')
    .eq('profile_id', profileId).order('suspendu_le', { ascending: false }).limit(10);
  if (error) return [];
  return (data || []).map((s) => ({
    id: s.id, espace: LIBELLE_ROLE[s.role] || s.role, motif: s.motif, depuis: s.suspendu_le,
    contestation: s.contestation || null, contesteeLe: s.contestee_le || null, leveeLe: s.levee_le || null, decision: s.decision || null,
  }));
}

export async function contester(admin: SupabaseClient, profileId: string, params: { id: unknown; texte: unknown }) {
  const id = typeof params.id === 'string' ? params.id : '';
  const texte = typeof params.texte === 'string' ? params.texte.trim().slice(0, 1500) : '';
  if (!id) throw new SuspensionError('Suspension manquante.', 400);
  if (texte.length < 10) throw new SuspensionError('Expliquez en quelques phrases pourquoi vous contestez.', 400);
  const { data, error } = await admin.from('suspensions').update({ contestation: texte, contestee_le: new Date().toISOString() })
    .eq('id', id).eq('profile_id', profileId).is('levee_le', null).is('contestation', null).select('id').maybeSingle();
  if (error) throw new SuspensionError('Envoi impossible. Réessayez.', 503);
  if (!data) throw new SuspensionError('Cette suspension est déjà contestée ou levée.', 409);
  return { ok: true };
}
