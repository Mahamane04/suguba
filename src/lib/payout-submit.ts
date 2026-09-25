export interface PayoutInput { amount: number; payoutProvider: string; payoutPhone: string }
interface Attempt { key: string; input: PayoutInput }
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
export class PayoutCheckout {
  private attempt: Attempt | null = null;
  private pending: Promise<any> | null = null;
  constructor(private name: string, private storage: Storage, private send: typeof fetch = (...args) => fetch(...args)) {}
  restore(): Attempt | null {
    if (this.attempt) return this.attempt;
    try {
      const value = JSON.parse(this.storage.getItem(this.name) || 'null');
      if (typeof value?.key === 'string' && typeof value?.input?.amount === 'number' && typeof value.input.payoutProvider === 'string' && typeof value.input.payoutPhone === 'string') this.attempt = value;
    } catch { /* Clé en mémoire si le stockage est bloqué. */ }
    return this.attempt;
  }
  submit(input?: PayoutInput): Promise<any> {
    if (this.pending) return this.pending;
    const previous = this.restore();
    if (previous && input && JSON.stringify(input) !== JSON.stringify(previous.input)) return Promise.reject(new Error('Reprenez la demande précédente avant de modifier ses informations.'));
    if (!previous && !input) return Promise.reject(new Error('Aucune demande à reprendre.'));
    const attempt = previous || { key: crypto.randomUUID(), input: input! };
    this.attempt = attempt;
    try { this.storage.setItem(this.name, JSON.stringify(attempt)); } catch { /* mémoire conservée */ }
    this.pending = this.execute(attempt).finally(() => { this.pending = null; });
    return this.pending;
  }
  private async execute(attempt: Attempt) {
    const response = await this.send('/api/payouts/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...attempt.input, withdrawalCode: attempt.key }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success || typeof result.withdrawalCode !== 'string') {
      // Un proxy peut renvoyer un 400 après une réponse perdue : seule une
      // réponse métier explicitement définitive autorise une nouvelle clé.
      if (result?.definitive) this.reset();
      throw new Error(result?.error || 'Confirmation non reçue. Reprenez cette demande.');
    }
    this.reset();
    return result;
  }
  private reset() {
    this.attempt = null;
    try { this.storage.removeItem(this.name); } catch { /* facultatif */ }
  }
}
export const payoutSessionStorage: Storage = {
  getItem: key => sessionStorage.getItem(key), setItem: (key, value) => sessionStorage.setItem(key, value), removeItem: key => sessionStorage.removeItem(key),
};
