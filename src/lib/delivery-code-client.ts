import { orderAccessKey } from './order-access-client';

export interface DeliveryCodeResult { code?: string; error?: string }

/** Code de remise lu avec la clé du reçu (voir /api/orders/code-livraison). */
export async function fetchDeliveryCode(orderNumber: string, send: typeof fetch = fetch): Promise<DeliveryCodeResult> {
  const accessKey = orderAccessKey(orderNumber);
  if (!accessKey) return { error: 'Le code s’affiche sur l’appareil qui a passé la commande. Sinon, contactez Suguba.' };
  try {
    const response = await send('/api/orders/code-livraison', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, accessKey }),
    });
    const result = await response.json().catch(() => null);
    if (response.ok && typeof result?.code === 'string') return { code: result.code };
    return { error: result?.error || 'Code indisponible. Réessayez ou contactez Suguba.' };
  } catch {
    return { error: 'Connexion interrompue. Réessayez.' };
  }
}
