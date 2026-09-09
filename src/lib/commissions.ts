import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Règles de commission — serveur uniquement.
 *
 * Centralisé ici parce que le délai de sécurité doit être identique aux deux
 * endroits où une livraison est confirmée (/api/orders/sync et
 * /api/driver/verify-delivery-otp). Deux copies finiraient par diverger, et
 * une divergence sur ce délai, c'est de l'argent versé trop tôt.
 */

export type PalierRevendeur = 'new' | 'verified' | 'vip';

/** Réputation Suguba : nouveau = 14 jours, vérifié = 7, VIP = 3. */
export function joursDeSecurite(palier: PalierRevendeur): number {
  if (palier === 'vip') return 3;
  if (palier === 'verified') return 7;
  return 14;
}

export function palierDepuisVentes(ventesLivrees: number): PalierRevendeur {
  if (ventesLivrees >= 30) return 'vip';
  if (ventesLivrees >= 10) return 'verified';
  return 'new';
}

/**
 * Passe la commission d'une commande livrée de `pending` à `locked`, avec la
 * date à laquelle elle deviendra retirable.
 *
 * Le palier est recalculé sur les ventes réellement livrées : il n'est stocké
 * nulle part, précisément pour ne pas pouvoir diverger du compte réel.
 */
export async function verrouillerCommissionDeLivraison(
  admin: SupabaseClient,
  orderId: string,
  resellerId: string | null
): Promise<void> {
  if (!resellerId) return;

  const { count } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('reseller_id', resellerId)
    .eq('status', 'delivered');

  const jours = joursDeSecurite(palierDepuisVentes(count || 0));
  const unlockAt = new Date(Date.now() + jours * 24 * 60 * 60 * 1000).toISOString();

  await admin
    .from('commissions')
    .update({ status: 'locked', unlock_at: unlockAt })
    .eq('order_id', orderId)
    .eq('status', 'pending');
}

/**
 * Libère les commissions dont le délai est écoulé. À appeler avant toute
 * lecture de solde ou demande de retrait — voir la fonction SQL du même nom
 * dans supabase/migration-commission-safety-window.sql.
 */
export async function libererCommissionsEchues(admin: SupabaseClient): Promise<void> {
  const { error } = await admin.rpc('liberer_commissions_echues');
  if (error) {
    // Non bloquant : si la migration n'est pas encore appliquée sur cet
    // environnement, les soldes restent simplement ceux d'avant.
    console.warn('[COMMISSIONS] liberer_commissions_echues indisponible:', error.message);
  }
}
