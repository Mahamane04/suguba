import type { SupabaseClient } from '@supabase/supabase-js';
import { lireQrRemise } from './qr-remise';

/**
 * Préparation d'une remise par QR — SERVEUR UNIQUEMENT (2026-09-25, partagée
 * livreur / fournisseur le 2026-09-26).
 *
 * `intervenantId` = celui à qui la commande est assignée : le livreur Suguba,
 * ou le fournisseur qui remet lui-même (« Organiser la remise »). Être
 * connecté ne suffit pas : la commande doit lui être assignée.
 *
 * Le scan NE livre PAS : il vérifie la preuve et renvoie ce qui va être remis
 * (articles, paiement). La livraison n'est enregistrée qu'à « Confirmer la
 * remise », par verify_delivery_atomic — même voie que la saisie du code,
 * donc mêmes protections (3 essais partagés, aucun double traitement).
 * Aucun code n'est renvoyé.
 */

const COLONNES = 'id, order_number, cart_id, pricing_snapshot, assigned_driver_id, status, picked_up_at, delivery_otp, failed_otp_attempts, payment_method, payment_collected, product_name, quantity, total_amount';

type Ligne = Record<string, any>;
const cleLivraison = (o: Ligne) => {
  const groupe = o.pricing_snapshot?.panier?.groupeLivraison;
  return o.cart_id && groupe != null ? `${o.cart_id}:${groupe}` : String(o.id);
};

export type ResultatPreparation =
  | { ok: true; corps: { orderNumber: string; commandes: unknown[] } }
  | { ok: false; status: number; error: string };

export async function preparerRemise(admin: SupabaseClient, intervenantId: string, orderId: unknown, qr: unknown): Promise<ResultatPreparation> {
  const lu = lireQrRemise(qr);
  if (typeof orderId !== 'string' || !orderId) return { ok: false, status: 400, error: 'Commande manquante.' };
  if (!lu) return { ok: false, status: 400, error: 'Ce QR n’est pas un reçu de remise Suguba.' };

  const [{ data: course, error: e1 }, { data: scannee, error: e2 }] = await Promise.all([
    admin.from('orders').select(COLONNES).eq('id', orderId).maybeSingle(),
    admin.from('orders').select(COLONNES).eq('order_number', lu.orderNumber).maybeSingle(),
  ]);
  if (e1 || e2) return { ok: false, status: 503, error: 'Base indisponible. Réessayez.' };
  if (!course) return { ok: false, status: 404, error: 'Commande introuvable.' };
  if (course.assigned_driver_id !== intervenantId) return { ok: false, status: 403, error: 'Cette commande ne vous est pas assignée.' };
  if (!scannee || cleLivraison(scannee) !== cleLivraison(course)) {
    return { ok: false, status: 409, error: `Ce QR correspond à une autre commande (#${lu.orderNumber}). Vérifiez que c’est le bon client.` };
  }
  if (course.status === 'delivered') return { ok: false, status: 409, error: 'Cette commande est déjà livrée.' };
  if (Number(course.failed_otp_attempts) >= 3) return { ok: false, status: 423, error: 'Commande bloquée après trois essais. Contactez Suguba.' };

  if (course.delivery_otp !== lu.code) {
    // Code faux (ancien reçu, QR régénéré…) : compté comme un essai raté,
    // exactement comme une saisie manuelle erronée.
    const { data } = await admin.rpc('verify_delivery_atomic', { p_order_id: course.id, p_driver_id: intervenantId, p_code: lu.code });
    const r = (data || {}) as { error?: string; http?: number };
    return { ok: false, status: r.http || 400, error: r.error || 'Ce QR n’est plus valable. Demandez au client de rouvrir son reçu.' };
  }

  // Tous les articles de cette livraison assignés à cet intervenant.
  let lignes: Ligne[] = [course];
  if (course.cart_id) {
    const { data } = await admin.from('orders').select(COLONNES).eq('cart_id', course.cart_id).eq('assigned_driver_id', intervenantId);
    const memes = (data || []).filter((o) => cleLivraison(o) === cleLivraison(course));
    if (memes.length) lignes = memes;
  }

  return {
    ok: true,
    corps: {
      orderNumber: lu.orderNumber,
      commandes: lignes
        .filter((o) => !['cancelled', 'returned'].includes(o.status))
        .map((o) => ({
          id: o.id,
          orderNumber: o.order_number,
          productName: o.product_name,
          quantity: Number(o.quantity) || 1,
          totalAmount: Math.round(Number(o.total_amount) || 0),
          status: o.status,
          pretARemettre: o.status === 'in_transit' && Boolean(o.picked_up_at),
          payeEnLigne: o.payment_method === 'mobile_money' && Boolean(o.payment_collected),
        })),
    },
  };
}
