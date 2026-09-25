let generation = 0;
export function privateSessionGeneration() { return generation; }
const memory = new Map<string, string>();
const PREFIX = 'suguba_receipt_access:';
export function rememberOrderAccess(orderNumber: string, key: string) {
  memory.set(orderNumber, key);
  try { sessionStorage.setItem(PREFIX + orderNumber, key); } catch { /* Reçu utilisable en mémoire. */ }
}
export function orderAccessKey(orderNumber: string): string | undefined {
  try { return sessionStorage.getItem(PREFIX + orderNumber) || memory.get(orderNumber); } catch { return memory.get(orderNumber); }
}
export function clearPrivateSessionStorage() {
  generation++;
  memory.clear();
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(PREFIX) || key.startsWith('suguba_order_attempt:') || key.startsWith('suguba_cart') || key.startsWith('suguba_panier') || key === 'suguba_dernier_panier' || key.startsWith('suguba_payout_attempt:')) sessionStorage.removeItem(key);
    }
  } catch { /* Stockage indisponible. */ }
}
