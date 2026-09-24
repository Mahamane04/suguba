import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Prix du revendeur pour un article au prix de gros (2026-09-24) — SERVEUR.
 *
 * Ordre de priorité :
 *   1. le prix NÉGOCIÉ saisi dans « + Vente », accepté seulement quand la
 *      personne connectée EST le revendeur de la commande (sinon n'importe
 *      qui pourrait fixer le prix d'une commande attribuée à un autre) ;
 *   2. le prix que le revendeur a enregistré pour cet article
 *      (reseller_prices), utilisé par sa boutique et ses liens partagés ;
 *   3. rien : le calcul prend le prix conseillé.
 *
 * Le plancher (prix minimal) est vérifié ensuite par le calcul lui-même :
 * un prix trop bas donne le statut « sous_plancher » et la commande est refusée.
 */

export async function prixEnregistres(
  admin: SupabaseClient,
  resellerId: string | null | undefined,
  productIds: string[],
): Promise<Map<string, number>> {
  const prix = new Map<string, number>();
  if (!resellerId || productIds.length === 0) return prix;
  const { data, error } = await admin.from('reseller_prices')
    .select('product_id, price').eq('reseller_id', resellerId).in('product_id', productIds);
  // Table absente (base pas encore mise à jour) : aucun prix enregistré.
  if (error || !data) return prix;
  for (const l of data as any[]) if (Number(l.price) > 0) prix.set(l.product_id, Number(l.price));
  return prix;
}

export async function resoudrePrixRevendeur(opts: {
  admin: SupabaseClient;
  modePrix: string | null | undefined;
  productId: string;
  resellerId: string | null | undefined;
  sessionUid?: string | null;
  prixNegocie?: number | null;
}): Promise<number | null> {
  if (opts.modePrix !== 'gros' || !opts.resellerId) return null;
  if (opts.prixNegocie && opts.prixNegocie > 0 && opts.sessionUid && opts.sessionUid === opts.resellerId) {
    return Math.round(opts.prixNegocie);
  }
  const enregistres = await prixEnregistres(opts.admin, opts.resellerId, [opts.productId]);
  return enregistres.get(opts.productId) ?? null;
}
