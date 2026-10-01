import type { SupabaseClient } from '@supabase/supabase-js';
import { mayTransitionOrder } from '@/lib/order-transitions';
import { modeRemiseCommande } from '@/lib/offre';
import { chargerReglages } from '@/lib/platform-settings';
import { estPayeEnEspeces, etatEspecesCollecteur, MESSAGE_PLAFOND } from '@/lib/caisse-livreur';
import type { OrderStatus } from '@/types';

/**
 * Changer une commande côté serveur — SERVEUR UNIQUEMENT.
 *
 * Les contrôles de /api/orders/sync (remise par le fournisseur, livreur
 * actif, plafond d'espèces, modification concurrente) extraits le
 * 2026-09-27 (lot U2) pour servir AUSSI aux actions « Confirmer » et
 * « Attribuer un livreur » de la page Commandes : deux copies de ces règles
 * finiraient par diverger, et c'est l'argent des livreurs qui en dépend.
 */

export interface CommandeExistante {
  id: string;
  status: OrderStatus;
  assigned_driver_id: string | null;
  pricing_snapshot: unknown;
  payment_method: string | null;
}

export const COLONNES_COMMANDE_EXISTANTE = 'id, order_number, status, assigned_driver_id, product_id, reseller_id, pricing_snapshot, payment_method';

export type Resultat = { ok: true } | { ok: false; status: number; error: string };

const LIBELLE_STATUT: Record<string, string> = {
  pending_call: 'à confirmer', confirmed: 'confirmée', dispatched: 'livreur attribué', in_transit: 'en livraison',
  delivered: 'livrée', cancelled: 'annulée', returned: 'retournée',
};

export type ActionCommande = 'confirmer' | 'attribuer';

/**
 * Changement demandé par une action de l'équipe (règle PURE). « Attribuer »
 * vaut aussi pour changer de livreur tant que la course n'est pas partie.
 */
export function majPourAction(
  action: ActionCommande,
  statut: string,
  livreur?: { id: string; nom: string } | null,
): { maj: Record<string, unknown> } | { erreur: string; status: number } {
  if (action === 'confirmer') {
    if (statut !== 'pending_call') return { erreur: `Cette commande n’attend plus de confirmation (${LIBELLE_STATUT[statut] || statut}).`, status: 409 };
    return { maj: { status: 'confirmed' } };
  }
  if (statut !== 'confirmed' && statut !== 'dispatched') {
    return { erreur: `Impossible d’attribuer un livreur à une commande ${LIBELLE_STATUT[statut] || statut}.`, status: 409 };
  }
  if (!livreur?.id) return { erreur: 'Choisissez un livreur.', status: 400 };
  return { maj: { status: 'dispatched', assigned_driver_id: livreur.id, assigned_driver_name: livreur.nom } };
}

/** Contrôle puis applique `maj` à la commande ; refuse si elle a changé entre-temps. */
export async function appliquerMajCommande(
  admin: SupabaseClient,
  existing: CommandeExistante,
  maj: Record<string, unknown>,
  role = 'admin',
): Promise<Resultat> {
  const statut = maj.status as OrderStatus | undefined;
  if (statut && !mayTransitionOrder(role, existing.status, statut)) {
    return { ok: false, status: 403, error: 'Cette transition exige le parcours de validation approprié.' };
  }
  // Offre remise par le fournisseur (2026-09-26) : aucun livreur Suguba. Le
  // fournisseur l'organise lui-même depuis son espace (/api/supplier/remise).
  if (modeRemiseCommande(existing.pricing_snapshot) !== 'livreur'
      && (statut === 'dispatched' || (maj.assigned_driver_id && maj.assigned_driver_id !== existing.assigned_driver_id))) {
    return { ok: false, status: 409, error: 'Remise assurée par le fournisseur : aucun livreur Suguba à assigner.' };
  }
  if (statut === 'dispatched' && !(maj.assigned_driver_id ?? existing.assigned_driver_id)) {
    return { ok: false, status: 400, error: 'Choisissez un livreur avant le dispatch.' };
  }
  if (maj.assigned_driver_id) {
    const { data: driver, error: driverError } = await admin.from('drivers').select('active_status').eq('profile_id', maj.assigned_driver_id).maybeSingle();
    if (driverError || !driver?.active_status) return { ok: false, status: 403, error: 'Livreur non autorisé au dispatch.' };
    // Plafond d'espèces (Protection Suguba) : un livreur qui n'a pas reversé
    // ne reçoit pas de NOUVELLE course payée en espèces.
    if (maj.assigned_driver_id !== existing.assigned_driver_id && estPayeEnEspeces(existing.payment_method)) {
      const { reglages } = await chargerReglages();
      const etat = await etatEspecesCollecteur(admin, reglages, String(maj.assigned_driver_id));
      if (etat.bloque) return { ok: false, status: 409, error: `${etat.raison} ${MESSAGE_PLAFOND}` };
    }
  }
  const { data: updated, error } = await admin.from('orders').update(maj).eq('id', existing.id).eq('status', existing.status).select('id').maybeSingle();
  // Garde en base (2026-10-01) : une commande livrée garde son livreur (l'argent qu'il détient en dépend).
  if (error && /LIVREUR_FIGE/.test(String(error.message))) return { ok: false, status: 409, error: 'Le livreur d’une commande livrée ne peut plus être changé.' };
  if (error) return { ok: false, status: 500, error: 'Mise à jour non confirmée. Actualisez puis réessayez.' };
  if (!updated) return { ok: false, status: 409, error: 'Commande modifiée ailleurs. Actualisez.' };
  // Le trigger de la migration-audit-integrite effectue les effets métier atomiquement.
  return { ok: true };
}
