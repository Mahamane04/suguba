import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SugubaSession } from './session';
import { hasOrderReceiptAccess } from './order-access';
import { devisAccessible } from './devis';

/**
 * Compte client — C1 (2026-09-26) — SERVEUR UNIQUEMENT.
 *
 * Acheter reste possible sans compte. Connecté, l'acheteur retrouve ses
 * commandes et ses devis sur n'importe quel téléphone. Règles :
 *   • une commande est rattachée au compte de l'ACHETEUR : jamais à un admin
 *     ni au revendeur qui saisit la vente pour son client ;
 *   • une ancienne commande ne se rattache qu'avec la clé de son reçu ;
 *   • sur un nouveau téléphone, le propriétaire reçoit une NOUVELLE clé
 *     (seul son hash est gardé) : le reste du reçu fonctionne comme avant.
 * Le compte ne change rien aux prix, au revendeur rattaché ni aux services.
 */

export class CompteError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const hash = (cle: string) => createHash('sha256').update(cle.toLowerCase()).digest('hex');
const tableAbsente = (code: unknown) => ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(String(code));

/** La personne connectée est-elle l'acheteur de cette commande ? */
export function estAcheteur(session: Pick<SugubaSession, 'uid' | 'role'> | null, resellerId: string | null | undefined): boolean {
  if (!session?.uid) return false;
  if (session.role === 'admin' || session.role === 'driver') return false;
  // Un revendeur qui enregistre une vente pour son client n'est pas l'acheteur.
  return session.uid !== resellerId;
}

/** Rattache au compte les commandes qu'il vient de passer (après création). */
export async function rattacherCommandes(
  admin: SupabaseClient | null, session: Pick<SugubaSession, 'uid' | 'role'> | null,
  commandes: { id: string; resellerId?: string | null }[],
) {
  if (!admin || !session) return;
  const ids = commandes.filter((c) => estAcheteur(session, c.resellerId)).map((c) => c.id);
  if (!ids.length) return;
  const { error } = await admin.from('orders').update({ customer_profile_id: session.uid }).in('id', ids).is('customer_profile_id', null);
  if (error && !tableAbsente(error.code)) console.error('[COMPTE CLIENT] rattachement commande', error.code);
}

export async function rattacherDevis(admin: SupabaseClient | null, session: Pick<SugubaSession, 'uid' | 'role'> | null, quoteNumber: string) {
  if (!admin || !session) return;
  const { data: q } = await admin.from('quote_requests').select('id, reseller_id').eq('quote_number', quoteNumber).maybeSingle();
  if (!q || !estAcheteur(session, q.reseller_id)) return;
  const { error } = await admin.from('quote_requests').update({ customer_profile_id: session.uid }).eq('id', q.id).is('customer_profile_id', null);
  if (error && !tableAbsente(error.code)) console.error('[COMPTE CLIENT] rattachement devis', error.code);
}

// ── Mes commandes ───────────────────────────────────────────────────────────
export async function mesAchats(admin: SupabaseClient, uid: string) {
  const [commandes, devis] = await Promise.all([
    admin.from('orders').select('order_number, product_name, product_image, quantity, total_amount, status, created_at, delivered_at')
      .eq('customer_profile_id', uid).order('created_at', { ascending: false }).limit(200),
    admin.from('quote_requests').select('quote_number, product_id, status, created_at, order_number')
      .eq('customer_profile_id', uid).order('created_at', { ascending: false }).limit(100),
  ]);
  if (commandes.error) {
    if (tableAbsente(commandes.error.code)) return { migrationRequise: true, commandes: [], devis: [] };
    throw new CompteError('Vos commandes sont indisponibles. Réessayez.', 503);
  }
  const idsProduits = [...new Set((devis.data || []).map((q) => q.product_id))];
  const { data: produits } = idsProduits.length
    ? await admin.from('products').select('id, name').in('id', idsProduits)
    : { data: [] as any[] };
  const noms = new Map((produits || []).map((p: any) => [p.id, p.name]));
  return {
    migrationRequise: false,
    commandes: (commandes.data || []).map((o) => ({
      numero: o.order_number as string, produit: o.product_name as string, image: o.product_image || null,
      quantite: Number(o.quantity) || 1, total: Number(o.total_amount) || 0, statut: o.status as string,
      creeLe: o.created_at as string, livreeLe: o.delivered_at || null,
    })),
    devis: (devis.data || []).map((q) => ({
      numero: q.quote_number as string, produit: (noms.get(q.product_id) as string) || 'Offre', statut: q.status as string,
      creeLe: q.created_at as string, commande: q.order_number || null,
    })),
  };
}

/**
 * Nouvelle clé pour ouvrir, sur ce téléphone, un reçu ou un devis du compte.
 * Refusée si la commande n'appartient pas à ce compte.
 */
export async function delivrerCle(admin: SupabaseClient, uid: string, type: unknown, ref: unknown) {
  if ((type !== 'commande' && type !== 'devis') || typeof ref !== 'string' || !ref.trim() || ref.length > 60) {
    throw new CompteError('Demande invalide.', 400);
  }
  const { data } = type === 'commande'
    ? await admin.from('orders').select('order_number').eq('order_number', ref.trim()).eq('customer_profile_id', uid).maybeSingle()
    : await admin.from('quote_requests').select('quote_number').eq('quote_number', ref.trim()).eq('customer_profile_id', uid).maybeSingle();
  if (!data) throw new CompteError(type === 'commande' ? 'Cette commande n’est pas dans votre compte.' : 'Ce devis n’est pas dans votre compte.', 404);
  const cle = randomUUID();
  const { error } = await admin.from('acces_cles').insert({ key_hash: hash(cle), type, ref: ref.trim(), profile_id: uid });
  if (error) throw new CompteError(tableAbsente(error.code) ? 'Le compte client sera disponible après la mise à jour de la base.' : 'Ouverture impossible. Réessayez.', 503);
  return { cle };
}

/**
 * Ajoute au compte des commandes et devis passés sans compte, avec la PREUVE
 * de leur clé (gardée sur ce téléphone). Un élément déjà rattaché à un autre
 * compte n'est pas déplacé.
 */
export async function rattacherAnciens(
  admin: SupabaseClient, uid: string,
  params: { commandes?: unknown; devis?: unknown },
) {
  const liste = (v: unknown) => (Array.isArray(v) ? v : []).slice(0, 50)
    .filter((x): x is { numero: string; cle: string } => !!x && typeof x.numero === 'string' && typeof x.cle === 'string');
  let ajoutes = 0;
  for (const c of liste(params.commandes)) {
    if (!(await hasOrderReceiptAccess(admin, c.numero, c.cle))) continue;
    const { data } = await admin.from('orders').update({ customer_profile_id: uid })
      .eq('order_number', c.numero).is('customer_profile_id', null).select('id');
    ajoutes += (data || []).length;
  }
  for (const d of liste(params.devis)) {
    const q = await devisAccessible(admin, d.numero, d.cle).catch(() => null);
    if (!q) continue;
    const { data } = await admin.from('quote_requests').update({ customer_profile_id: uid })
      .eq('id', q.id).is('customer_profile_id', null).select('id');
    ajoutes += (data || []).length;
    // La commande née du devis suit.
    if (q.order_id) await admin.from('orders').update({ customer_profile_id: uid }).eq('id', q.order_id).is('customer_profile_id', null);
  }
  return { ajoutes };
}
