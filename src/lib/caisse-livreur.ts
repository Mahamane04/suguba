import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReglagesPlateforme } from './pricing';
import { modeRemiseCommande } from './offre';

/**
 * Caisse livreurs (2026-09-25) — ce que chaque livreur doit remettre à
 * Suguba pour les commandes payées en espèces à la livraison.
 *
 * ⚠️ `payment_collected` ne sert PAS à distinguer espèces et Mobile Money :
 * la validation du code de remise le passe à vrai pour TOUTES les commandes.
 * Seul `payment_method` le dit : 'mobile_money' est posé par la confirmation
 * SasPay, tout le reste a été payé en main propre au livreur.
 *
 * Les montants gardés sont calculés avec la rémunération EN VIGUEUR au
 * moment du versement, puis figés sur le versement enregistré.
 */

export interface CommandeAVerser {
  id: string;
  orderNumber: string;
  productName: string;
  neighborhood: string | null;
  totalAmount: number;
  deliveredAt: string | null;
  /** Remise faite par le fournisseur (pas de rémunération de livreur gardée). */
  parFournisseur?: boolean;
}

export interface Versement {
  id: string;
  remittanceNumber: string;
  driverId: string;
  ordersCount: number;
  cashTotal: number;
  remunerationRetained: number;
  amountDue: number;
  amountReceived: number;
  difference: number;
  receivedByName: string | null;
  note: string | null;
  createdAt: string;
}

export interface CaisseLivreur {
  driverId: string;
  nom: string;
  telephone: string | null;
  commandes: CommandeAVerser[];
  especes: number;
  garde: number;
  aVerser: number;
  /** Somme des écarts des versements passés : négatif = le livreur doit encore cet argent. */
  ecartCumule: number;
  /** Livraison non versée la plus ancienne. */
  plusAncienne: string | null;
  versements: Versement[];
  /** Plafond d'espèces atteint (ajouté par les routes caisse). */
  bloque?: boolean;
  raison?: string | null;
}

export const estPayeEnEspeces = (paymentMethod: string | null | undefined) =>
  (paymentMethod || 'cash_on_delivery') !== 'mobile_money';

/** Rémunération retenue par course selon le réglage admin. */
export function remunerationRetenue(r: Pick<ReglagesPlateforme, 'remunerationLivreur' | 'livreurGardeRemuneration'>): number {
  if (r.livreurGardeRemuneration === false) return 0;
  return Math.max(0, Number(r.remunerationLivreur) || 0);
}

/**
 * Espèces encaissées, part gardée et montant à verser pour un lot de commandes.
 * `coursesLivreur` : combien de ces commandes ont été livrées par un livreur
 * Suguba (par défaut : toutes). Une remise faite par le fournisseur ne lui
 * laisse garder aucune rémunération de livreur (2026-09-26).
 */
export function calculerAVerser(montants: number[], parCourse: number, coursesLivreur = montants.length) {
  const especes = montants.reduce((t, m) => t + (Number(m) || 0), 0);
  const garde = Math.min(especes, Math.max(0, parCourse) * Math.max(0, coursesLivreur));
  return { especes, garde, aVerser: especes - garde };
}

/** Âge d'une dette, pour l'alerte : 'ok', 'retard' (> délai) ou 'grave' (> 2 × délai). */
export function niveauRetard(plusAncienne: string | null, delaiHeures: number, maintenant = Date.now()): 'ok' | 'retard' | 'grave' {
  if (!plusAncienne) return 'ok';
  const heures = (maintenant - Date.parse(plusAncienne)) / 3_600_000;
  if (!Number.isFinite(heures)) return 'ok';
  if (heures > 2 * delaiHeures) return 'grave';
  if (heures > delaiHeures) return 'retard';
  return 'ok';
}

/**
 * Plafond d'espèces (Protection Suguba, 2026-09-26) : au-delà du plafond, ou
 * avec des espèces en retard grave, le collecteur ne reçoit plus de NOUVELLE
 * commande payée en espèces. Terminer une course, le SAV et le versement
 * restent toujours possibles.
 */
export function blocageEspeces(
  du: number, plusAncienne: string | null,
  r: Pick<ReglagesPlateforme, 'plafondEspecesCollecteur' | 'delaiVersementEspecesHeures'>, maintenant = Date.now(),
): { bloque: boolean; raison: string | null } {
  const plafond = Math.max(0, Number(r.plafondEspecesCollecteur ?? 150000) || 0);
  const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
  if (plafond > 0 && du >= plafond) {
    return { bloque: true, raison: `Plafond d’encaissement atteint (${fcfa(du)} à verser, plafond ${fcfa(plafond)}).` };
  }
  if (du > 0 && niveauRetard(plusAncienne, r.delaiVersementEspecesHeures || 24, maintenant) === 'grave') {
    return { bloque: true, raison: `Espèces en retard de versement (${fcfa(du)} à verser).` };
  }
  return { bloque: false, raison: null };
}

/** Montant réellement dû par un collecteur : à verser + manques des versements passés. */
export const duParCollecteur = (c: Pick<CaisseLivreur, 'aVerser' | 'ecartCumule'>) => Math.max(0, c.aVerser - c.ecartCumule);

/** Le collecteur peut-il recevoir une nouvelle commande payée en espèces ? */
export async function etatEspecesCollecteur(admin: SupabaseClient, r: ReglagesPlateforme, collecteurId: string) {
  // Caisse illisible : on ne bloque pas le travail sur une panne de lecture.
  const libre = { bloque: false, raison: null, du: 0 };
  const lu = await chargerCaisses(admin, r, [collecteurId]).catch(() => null);
  if (!lu) return libre;
  const { caisses, error, migrationRequise } = lu;
  if (error || migrationRequise || !caisses[0]) return libre;
  const du = duParCollecteur(caisses[0]);
  return { ...blocageEspeces(du, caisses[0].plusAncienne, r), du };
}

export const MESSAGE_PLAFOND = 'Régularisez votre versement à Suguba pour recevoir de nouvelles commandes payées en espèces.';

const versementDepuisLigne = (v: Record<string, unknown>): Versement => ({
  id: String(v.id),
  remittanceNumber: String(v.remittance_number),
  driverId: String(v.driver_id),
  ordersCount: Number(v.orders_count) || 0,
  cashTotal: Number(v.cash_total) || 0,
  remunerationRetained: Number(v.remuneration_retained) || 0,
  amountDue: Number(v.amount_due) || 0,
  amountReceived: Number(v.amount_received) || 0,
  difference: Number(v.difference) || 0,
  receivedByName: (v.received_by_name as string) || null,
  note: (v.note as string) || null,
  createdAt: String(v.created_at),
});

/** Table ou colonne absente : le SQL de la caisse n'a pas encore été exécuté. */
export const migrationManquante = (e: { code?: string } | null | undefined) =>
  Boolean(e && ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(String(e.code)));

/**
 * Caisse d'un livreur (driverIds = [uid]) ou de tous ceux qui ont des
 * espèces en attente ou des versements (driverIds = null, vue admin).
 */
export async function chargerCaisses(
  admin: SupabaseClient,
  r: ReglagesPlateforme,
  driverIds: string[] | null,
): Promise<{ caisses: CaisseLivreur[]; migrationRequise: boolean; error?: string }> {
  let qCommandes = admin
    .from('orders')
    .select('id, order_number, product_name, neighborhood, total_amount, delivered_at, assigned_driver_id, payment_method, pricing_snapshot')
    .eq('status', 'delivered')
    .is('cash_remittance_id', null)
    .not('assigned_driver_id', 'is', null)
    .order('delivered_at', { ascending: true })
    .limit(5000);
  let qVersements = admin.from('driver_remittances').select('*').order('created_at', { ascending: false }).limit(500);
  if (driverIds) {
    qCommandes = qCommandes.in('assigned_driver_id', driverIds);
    qVersements = qVersements.in('driver_id', driverIds);
  }

  const [c, v] = await Promise.all([qCommandes, qVersements]);
  if (migrationManquante(c.error) || migrationManquante(v.error)) return { caisses: [], migrationRequise: true };
  if (c.error || v.error) return { caisses: [], migrationRequise: false, error: (c.error || v.error)?.message };

  const parCourse = remunerationRetenue(r);
  const parLivreur = new Map<string, { commandes: CommandeAVerser[]; versements: Versement[] }>();
  const entree = (id: string) => {
    if (!parLivreur.has(id)) parLivreur.set(id, { commandes: [], versements: [] });
    return parLivreur.get(id)!;
  };

  for (const o of c.data || []) {
    if (!estPayeEnEspeces(o.payment_method)) continue;
    entree(String(o.assigned_driver_id)).commandes.push({
      id: String(o.id),
      orderNumber: String(o.order_number),
      productName: String(o.product_name || ''),
      neighborhood: o.neighborhood || null,
      totalAmount: Number(o.total_amount) || 0,
      deliveredAt: o.delivered_at || null,
      parFournisseur: modeRemiseCommande(o.pricing_snapshot) !== 'livreur',
    });
  }
  for (const ligne of v.data || []) entree(String(ligne.driver_id)).versements.push(versementDepuisLigne(ligne));

  const ids = [...parLivreur.keys()];
  const profils = new Map<string, { full_name: string | null; phone: string | null }>();
  if (ids.length) {
    const { data } = await admin.from('profiles').select('id, full_name, phone').in('id', ids);
    for (const p of data || []) profils.set(String(p.id), p);
  }

  const caisses = ids.map((driverId) => {
    const { commandes, versements } = parLivreur.get(driverId)!;
    const calc = calculerAVerser(commandes.map((o) => o.totalAmount), parCourse, commandes.filter((o) => !o.parFournisseur).length);
    const profil = profils.get(driverId);
    const tel = profil?.phone && !profil.phone.includes('@') ? profil.phone : null;
    return {
      driverId,
      nom: profil?.full_name || 'Livreur',
      telephone: tel,
      commandes,
      ...calc,
      ecartCumule: versements.reduce((t, x) => t + x.difference, 0),
      plusAncienne: commandes[0]?.deliveredAt || null,
      versements,
    };
  });
  // Les plus gros montants en attente d'abord.
  caisses.sort((a, b) => (b.aVerser - b.ecartCumule) - (a.aVerser - a.ecartCumule));
  return { caisses, migrationRequise: false };
}
