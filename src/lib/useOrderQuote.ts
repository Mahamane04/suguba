'use client';

import { useEffect, useState } from 'react';
import type { Devis } from './pricing';
import type { OrderInput } from './order-input';

type QuoteInput = Pick<OrderInput, 'productId' | 'quantity' | 'city' | 'pickupPointId' | 'promoCode' | 'resellerCode'>
  & { neighborhood?: string };
export type PublicOrderQuote = Pick<Devis, 'quantite' | 'prixUnitaire' | 'montantArticles' | 'modeLivraison' | 'ville' | 'pointRelais' | 'fraisLivraison' | 'distanceLivraisonKm' | 'codePromo' | 'remise' | 'avisPromo' | 'total'>;

/** Un changement de quantité/ville invalide immédiatement l'ancien devis. */
export function useOrderQuote(input: QuoteInput | null) {
  const key = input ? JSON.stringify(input) : null;
  const [result, setResult] = useState<{ key: string; devis: PublicOrderQuote | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/orders/quote', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key,
          signal: controller.signal,
        });
        const json = await response.json();
        if (!response.ok || !json.devis) throw new Error(json.error || 'Total indisponible.');
        if (!controller.signal.aborted) setResult({ key, devis: json.devis, error: null });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, devis: null, error: error instanceof Error ? error.message : 'Total indisponible.' });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key]);
  const current = result?.key === key ? result : null;
  return { devis: current?.devis || null, error: current?.error || null, loading: Boolean(key && !current) };
}
