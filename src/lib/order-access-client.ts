let generation = 0;
export function privateSessionGeneration() { return generation; }
const memory = new Map<string, string>();
const PREFIX = 'suguba_receipt_access:';
/**
 * Reçu conservé sur l'appareil (2026-09-25) : la clé du reçu vivait seulement
 * dans l'onglet (sessionStorage). Fermer la page faisait perdre le code de
 * remise, d'où les appels au SAV. Elle est désormais aussi gardée dans le
 * navigateur (localStorage) pendant 90 jours — c'est ce qui permet
 * « Retrouver mon reçu » sur le même téléphone. Effacée à la déconnexion et
 * au changement de compte.
 */
const PREFIX_DURABLE = 'suguba_recu:';
const DUREE_MS = 90 * 24 * 3600_000;

export function rememberOrderAccess(orderNumber: string, key: string) {
  memory.set(orderNumber, key);
  try { sessionStorage.setItem(PREFIX + orderNumber, key); } catch { /* Reçu utilisable en mémoire. */ }
  try { localStorage.setItem(PREFIX_DURABLE + orderNumber, JSON.stringify({ k: key, t: Date.now() })); } catch { /* Navigation privée. */ }
}

function lireDurable(orderNumber: string): { k: string; t: number } | undefined {
  try {
    const brut = localStorage.getItem(PREFIX_DURABLE + orderNumber);
    if (!brut) return undefined;
    const { k, t } = JSON.parse(brut) as { k?: string; t?: number };
    if (typeof k !== 'string' || !t || Date.now() - t > DUREE_MS) {
      localStorage.removeItem(PREFIX_DURABLE + orderNumber);
      return undefined;
    }
    return { k, t };
  } catch { return undefined; }
}

export function orderAccessKey(orderNumber: string): string | undefined {
  let session: string | null = null;
  try { session = sessionStorage.getItem(PREFIX + orderNumber); } catch { /* indisponible */ }
  return session || memory.get(orderNumber) || lireDurable(orderNumber)?.k;
}

/** Commandes dont le reçu est gardé sur cet appareil, les plus récentes d'abord. */
export function recusSurCetAppareil(): { orderNumber: string; enregistreLe: number }[] {
  const liste: { orderNumber: string; enregistreLe: number }[] = [];
  try {
    for (const cle of Object.keys(localStorage)) {
      if (!cle.startsWith(PREFIX_DURABLE)) continue;
      const orderNumber = cle.slice(PREFIX_DURABLE.length);
      const entree = lireDurable(orderNumber);
      if (entree) liste.push({ orderNumber, enregistreLe: entree.t });
    }
  } catch { /* Stockage indisponible. */ }
  return liste.sort((a, b) => b.enregistreLe - a.enregistreLe);
}

/**
 * `effacerRecus` : vrai à la déconnexion ou quand un AUTRE compte prend la
 * main sur l'appareil. Faux au simple chargement d'une session (cette
 * fonction est aussi appelée à chaque démarrage d'un utilisateur connecté).
 */
export function clearPrivateSessionStorage(effacerRecus = false) {
  generation++;
  memory.clear();
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(PREFIX) || key.startsWith('suguba_order_attempt:') || key.startsWith('suguba_cart') || key.startsWith('suguba_panier') || key === 'suguba_dernier_panier' || key.startsWith('suguba_payout_attempt:')) sessionStorage.removeItem(key);
    }
  } catch { /* Stockage indisponible. */ }
  if (!effacerRecus) return;
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX_DURABLE)) localStorage.removeItem(key);
  } catch { /* Stockage indisponible. */ }
}
