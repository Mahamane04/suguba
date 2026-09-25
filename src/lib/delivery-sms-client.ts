import { orderAccessKey, privateSessionGeneration } from './order-access-client';
export interface DeliverySmsResult { success: boolean; error?: string }
const pending = new Map<string, Promise<DeliverySmsResult>>();
const accepted = new Set<string>();
let cacheGeneration = privateSessionGeneration();
/** Une demande en vol par reçu ; le succès signifie accepté par le service SMS. */
export function requestDeliverySms(orderNumber: string, retry = false, send: typeof fetch = fetch): Promise<DeliverySmsResult> {
  const generation = privateSessionGeneration();
  if (cacheGeneration !== generation) { pending.clear(); accepted.clear(); cacheGeneration = generation; }
  const accessKey = orderAccessKey(orderNumber);
  if (!accessKey) return Promise.resolve({ success: false, error: 'Ouvrez le reçu d’origine ou contactez Suguba pour demander le SMS au destinataire.' });
  const key = `${generation}:${orderNumber}`;
  const existing = pending.get(key);
  if (existing) return existing;
  if (!retry && accepted.has(key)) return Promise.resolve({ success: true });
  const promise = (async () => {
    try {
      const response = await send('/api/sms/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNumber, accessKey }) });
      const result = await response.json().catch(() => null);
      if (generation !== privateSessionGeneration()) return { success: false, error: 'Votre session a changé. Rouvrez le reçu pour vérifier la transmission.' };
      if (response.ok && result?.success === true) { accepted.add(key); return { success: true }; }
      return { success: false, error: result?.error || 'Envoi non confirmé. Réessayez ou contactez Suguba ; votre commande reste enregistrée.' };
    } catch { return { success: false, error: 'Connexion interrompue. Réessayez pour transmettre le code au destinataire.' }; }
  })().finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
