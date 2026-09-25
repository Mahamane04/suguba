import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/** La clé de reprise aléatoire du reçu ne circule jamais dans les feeds métier. */
export async function hasOrderReceiptAccess(admin: SupabaseClient, orderNumber: string, key: unknown): Promise<boolean> {
  if (typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return false;
  const hash = createHash('sha256').update(key.toLowerCase()).digest('hex');
  const { data, error } = await admin.from('order_creation_requests').select('receipt').eq('key_hash', hash).maybeSingle();
  if (error) return false;
  if (data?.receipt?.order_number === orderNumber) return true;
  const cart = await admin.from('cart_creation_requests').select('receipts').eq('key_hash', hash).maybeSingle();
  return !cart.error && Array.isArray(cart.data?.receipts) && cart.data.receipts.some((r: any) => r.order_number === orderNumber);
}
