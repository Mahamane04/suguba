import type { SupabaseClient } from '@supabase/supabase-js';
import { chargerCaisses, niveauRetard } from '@/lib/caisse-livreur';
import { chargerReglages } from '@/lib/platform-settings';
import { TACHES, type Tache, type TypeTache } from './poste';

/**
 * File « À traiter » (lot A1, 2026-09-27) — SERVEUR UNIQUEMENT.
 *
 * Rassemble les dossiers qui attendent une décision humaine, source par
 * source. Seules les sources que le membre a le droit de voir sont lues. Une
 * source en panne est SIGNALÉE (`indisponibles`) : une liste vide ne doit
 * jamais passer pour « tout est traité » alors qu'on n'a pas pu lire.
 */

const LIMITE = 50;
const HEURES_DEVIS = 24;

type Lecteur = (admin: SupabaseClient) => Promise<Tache[]>;

const iso = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : new Date(0).toISOString());
const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

async function lignes<T = any>(requete: PromiseLike<{ data: T[] | null; error: { code?: string; message: string } | null }>): Promise<T[]> {
  const { data, error } = await requete;
  if (error) {
    // Table pas encore créée (SQL non exécuté) : rien à traiter de ce côté.
    if (['42P01', 'PGRST205'].includes(String(error.code))) return [];
    throw new Error(error.message);
  }
  return data || [];
}

export const LECTEURS: Record<TypeTache, Lecteur> = {
  commande_a_confirmer: async (a) => (await lignes(a.from('orders')
    .select('id, order_number, customer_name, product_name, total_amount, created_at')
    .eq('status', 'pending_call').order('created_at', { ascending: true }).limit(LIMITE)))
    .map((o: any) => ({
      type: 'commande_a_confirmer', id: o.id, titre: `Commande ${o.order_number}`,
      detail: [o.customer_name, o.product_name].filter(Boolean).join(' · '), depuis: iso(o.created_at),
      lien: `/admin/commandes?q=${encodeURIComponent(o.order_number)}`, montant: Number(o.total_amount) || null,
    })),

  livraison_a_attribuer: async (a) => (await lignes(a.from('orders')
    .select('id, order_number, neighborhood, city, total_amount, payment_method, created_at')
    .eq('status', 'confirmed').is('assigned_driver_id', null).order('created_at', { ascending: true }).limit(LIMITE)))
    .map((o: any) => ({
      type: 'livraison_a_attribuer', id: o.id, titre: `Commande ${o.order_number}`,
      detail: [o.neighborhood, o.city].filter(Boolean).join(', ') + (o.payment_method === 'cash' ? ' · espèces à encaisser' : ''),
      depuis: iso(o.created_at), lien: `/admin/commandes?q=${encodeURIComponent(o.order_number)}`, montant: Number(o.total_amount) || null,
    })),

  retrait_a_payer: async (a) => (await lignes(a.from('payouts')
    .select('id, reseller_name, amount, payment_method, created_at')
    .in('status', ['pending', 'processing']).order('created_at', { ascending: true }).limit(LIMITE)))
    .map((p: any) => ({
      type: 'retrait_a_payer', id: p.id, titre: `Retrait de ${p.reseller_name || 'un partenaire'}`,
      detail: p.payment_method ? String(p.payment_method) : 'Mobile Money', depuis: iso(p.created_at),
      lien: '/admin#retraits', montant: Number(p.amount) || null,
    })),

  versement_en_retard: async (a) => {
    const { reglages } = await chargerReglages();
    const { caisses, error } = await chargerCaisses(a, reglages, null);
    if (error) throw new Error(error);
    const delai = reglages.delaiVersementEspecesHeures || 24;
    return caisses
      .filter((c) => c.aVerser > 0 && niveauRetard(c.plusAncienne, delai) !== 'ok')
      .map((c) => ({
        type: 'versement_en_retard' as const, id: c.driverId, titre: `Espèces chez ${c.nom}`,
        detail: `${fcfa(c.aVerser)} à verser`, depuis: iso(c.plusAncienne),
        lien: '/admin/caisse-livreurs', montant: c.aVerser,
      }));
  },

  prestation_contestee: async (a) => {
    const etapes = await lignes(a.from('order_steps').select('order_id, created_at').eq('statut', 'contestee').limit(LIMITE));
    const ids = [...new Set(etapes.map((e: any) => e.order_id))];
    if (!ids.length) return [];
    const commandes = await lignes(a.from('orders').select('id, order_number, product_name').in('id', ids));
    const depuis = new Map(etapes.map((e: any) => [e.order_id, e.created_at]));
    return commandes.map((o: any) => ({
      type: 'prestation_contestee' as const, id: o.id, titre: `Prestation ${o.order_number}`,
      detail: o.product_name || '', depuis: iso(depuis.get(o.id)), lien: '/admin/prestations',
    }));
  },

  message_a_verifier: async (a) => (await lignes(a.from('messages')
    .select('id, created_at').eq('statut', 'en_attente').order('created_at', { ascending: true }).limit(LIMITE)))
    .map((m: any) => ({
      type: 'message_a_verifier', id: m.id, titre: 'Message retenu',
      detail: 'Numéro, lien ou proposition hors Suguba repéré', depuis: iso(m.created_at), lien: '/admin/messages',
    })),

  verification_en_attente: async (a) => (await lignes(a.from('verification_requests')
    .select('id, kind, created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(LIMITE)))
    .map((v: any) => ({
      type: 'verification_en_attente', id: v.id, titre: 'Pièce à vérifier',
      detail: ({ identity: 'Pièce d’identité', selfie: 'Selfie', location: 'Localisation', business: 'Entreprise', phone: 'Téléphone', email: 'E-mail' } as Record<string, string>)[v.kind] || v.kind,
      depuis: iso(v.created_at), lien: '/admin/verifications',
    })),

  produit_a_verifier: async (a) => (await lignes(a.from('products')
    .select('id, name, supplier_name, created_at').in('status', ['submitted', 'pending']).order('created_at', { ascending: true }).limit(LIMITE)))
    .map((p: any) => ({
      type: 'produit_a_verifier', id: p.id, titre: p.name || 'Produit',
      detail: p.supplier_name || '', depuis: iso(p.created_at), lien: '/admin/products',
    })),

  sav_ouvert: async (a) => (await lignes(a.from('sav_tickets')
    .select('id, ticket_number, order_number, customer_name, created_at').in('status', ['open', 'courier_dispatched']).order('created_at', { ascending: true }).limit(LIMITE)))
    .map((t: any) => ({
      type: 'sav_ouvert', id: t.id, titre: `SAV ${t.ticket_number || ''}`.trim(),
      detail: [t.order_number, t.customer_name].filter(Boolean).join(' · '), depuis: iso(t.created_at), lien: '/admin/sav',
    })),

  devis_sans_reponse: async (a) => (await lignes(a.from('quote_requests')
    .select('id, created_at').eq('status', 'demande')
    .lt('created_at', new Date(Date.now() - HEURES_DEVIS * 3_600_000).toISOString())
    .order('created_at', { ascending: true }).limit(LIMITE)))
    .map((d: any) => ({
      type: 'devis_sans_reponse', id: d.id, titre: 'Demande de devis',
      detail: `Sans réponse du fournisseur depuis plus de ${HEURES_DEVIS} h`, depuis: iso(d.created_at), lien: '/admin/devis',
    })),

  validation_a_decider: async (a) => (await lignes(a.from('validations_admin')
    .select('id, type, montant, cree_le').eq('statut', 'en_attente').order('cree_le', { ascending: true }).limit(LIMITE)))
    .map((v: any) => ({
      type: 'validation_a_decider', id: v.id,
      titre: ({ retrait: 'Paiement d’un retrait', avance_commission: 'Avance d’une commission', part_suguba: 'Baisse de la part Suguba' } as Record<string, string>)[v.type] || v.type,
      detail: 'Préparé par un collègue : à approuver par un autre membre', depuis: iso(v.cree_le), lien: '/admin/validations',
      montant: v.montant == null ? null : Number(v.montant),
    })),

  sponsorisation_a_examiner: async (a) => (await lignes(a.from('sponsorships')
    .select('id, label, budget, created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(LIMITE)))
    .map((s: any) => ({
      type: 'sponsorisation_a_examiner', id: s.id, titre: s.label || 'Sponsorisation',
      detail: 'En attente de décision', depuis: iso(s.created_at), lien: '/admin/sponsorisations', montant: Number(s.budget) || null,
    })),
};

/** Lit les sources autorisées ; renvoie les tâches et les sources illisibles. */
export async function chargerTaches(
  admin: SupabaseClient,
  permissions: readonly string[],
  lecteurs: Record<TypeTache, Lecteur> = LECTEURS,
): Promise<{ taches: Tache[]; indisponibles: string[] }> {
  const types = (Object.keys(lecteurs) as TypeTache[]).filter((t) => permissions.includes(TACHES[t].permission));
  const resultats = await Promise.allSettled(types.map((t) => lecteurs[t](admin)));
  const taches: Tache[] = [];
  const indisponibles: string[] = [];
  resultats.forEach((r, i) => {
    if (r.status === 'fulfilled') taches.push(...r.value);
    else indisponibles.push(TACHES[types[i]].libelle);
  });
  return { taches, indisponibles };
}

/** Responsables actuels des dossiers : « type:id » → membre. Table absente = aucun. */
export async function chargerAffectations(admin: SupabaseClient): Promise<Map<string, { id: string; nom: string; version: string }>> {
  const { data, error } = await admin.from('admin_affectations').select('dossier, membre_id, updated_at').limit(2000);
  if (error || !data?.length) return new Map();
  const ids = [...new Set(data.map((d: any) => d.membre_id))];
  const { data: profils } = await admin.from('profiles').select('id, full_name').in('id', ids);
  const noms = new Map((profils || []).map((p: any) => [p.id, p.full_name || 'Membre']));
  return new Map(data.map((d: any) => [d.dossier, { id: d.membre_id, nom: noms.get(d.membre_id) || 'Membre', version: d.updated_at }]));
}
