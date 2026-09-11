import type { Order } from '@/types';
import { normaliserCommande, type OrderInput } from './order-input';

export interface OrderAttempt { key: string; input: OrderInput; }
export class OrderSubmissionError extends Error {
  constructor(message: string, public definitive: boolean) { super(message); }
}

type AttemptStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function nouvelleCle(): string {
  // Compatible aussi avec les téléphones sans crypto.randomUUID().
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Contrôleur partagé par les trois formulaires, testable sans réseau ni DOM. */
export class OrderCheckout {
  private attempt: OrderAttempt | null = null;
  private pending: Promise<Order> | null = null;
  constructor(
    private storageKey: string,
    private storage: AttemptStorage,
    private create: (input: OrderInput, key: string) => Promise<Order>,
  ) {}

  restore(): OrderAttempt | null {
    if (!this.attempt) {
      try {
        const saved = this.storage.getItem(this.storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.key !== 'string' || !/^[0-9a-f-]{36}$/i.test(parsed.key)) throw new Error('Clé invalide');
          this.attempt = { key: parsed.key, input: normaliserCommande(parsed.input) };
        }
      } catch { this.reset(); }
    }
    return this.attempt;
  }

  reset() {
    this.attempt = null;
    try { this.storage.removeItem(this.storageKey); } catch { /* Stockage bloqué. */ }
  }

  submit(value?: OrderInput): Promise<Order> {
    if (this.pending) return this.pending;
    this.restore();
    try {
      const input = value ? normaliserCommande(value) : this.attempt?.input;
      if (!input) throw new Error('Renseignez la commande.');
      if (this.attempt && JSON.stringify(input) !== JSON.stringify(this.attempt.input)) {
        throw new OrderSubmissionError('Une demande précédente attend confirmation. Utilisez « Reprendre ma commande » avant de modifier le formulaire.', false);
      }
      if (!this.attempt) this.attempt = { key: nouvelleCle(), input };
      try { this.storage.setItem(this.storageKey, JSON.stringify(this.attempt)); } catch { /* Mémoire seule. */ }
      this.pending = this.create(this.attempt.input, this.attempt.key)
        .catch((error) => {
          if (error instanceof OrderSubmissionError && error.definitive) this.reset();
          throw error;
        })
        .finally(() => { this.pending = null; });
      return this.pending;
    } catch (error) { return Promise.reject(error); }
  }
}

/**
 * Une tentative appartient au formulaire. Garder sa clé après une coupure :
 * le serveur peut avoir enregistré la commande malgré une réponse perdue.
 */
export async function soumettreCommande(attempt: OrderAttempt): Promise<Order> {
  let res: Response;
  let json;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    res = await fetch('/api/orders/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.key },
      body: JSON.stringify(normaliserCommande(attempt.input)),
      signal: controller.signal,
    });
    json = await res.json().catch(() => null);
  } catch {
    throw new OrderSubmissionError('Confirmation non reçue. Réessayez pour retrouver la même commande.', false);
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok || json?.success !== true || json.order?.creationConfirmed !== true || !json.order?.id || !json.order?.orderNumber || !/^\d{4}$/.test(json.order?.deliveryOtp || '')) {
    // Un 403/429 du proxy peut suivre une première réponse perdue. Il ne
    // prouve pas l'absence de commande : garder la clé pour la retrouver.
    throw new OrderSubmissionError(json?.error || 'Confirmation non reçue. Réessayez.',
      json?.definitive === true && (res.status === 400 || res.status === 409));
  }
  return json.order as Order;
}
