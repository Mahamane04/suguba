'use client';

import { useEffect, useState } from 'react';
import type { Devis } from './pricing';
import type { OrderInput } from './order-input';

type QuoteInput = Pick<OrderInput, 'productId' | 'quantity' | 'city' | 'pickupPointId' | 'promoCode' | 'resellerCode' | 'prixNegocie'>
  & { neighborhood?: string; positionClient?: { lat: number; lng: number } | null };
export type PublicOrderQuote = Pick<Devis, 'quantite' | 'prixUnitaire' | 'montantArticles' | 'modeLivraison' | 'ville' | 'pointRelais' | 'fraisLivraison' | 'distanceLivraisonKm' | 'positionClientUtilisee' | 'codePromo' | 'remise' | 'avisPromo' | 'total'>;

/**
 * Réservé au revendeur de la vente (« + Vente ») : son gain réel et, pour un
 * article au prix de gros, les bornes de son prix (2026-09-24). Absent pour
 * un client.
 */
export interface InfosRevendeur {
  gain: number;
  modePrix: 'fixe' | 'gros';
  prixMinimal: number;
  prixConseille: number;
}

interface Resultat { key: string; devis: PublicOrderQuote | null; pourLeRevendeur: InfosRevendeur | null; error: string | null }

/** Un changement de quantité/ville invalide immédiatement l'ancien devis. */
export function useOrderQuote(input: QuoteInput | null) {
  const key = input ? JSON.stringify(input) : null;
  const [result, setResult] = useState<Resultat | null>(null);
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
        if (!controller.signal.aborted) setResult({ key, devis: json.devis, pourLeRevendeur: json.pourLeRevendeur || null, error: null });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, devis: null, pourLeRevendeur: null, error: error instanceof Error ? error.message : 'Total indisponible.' });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key]);
  const current = result?.key === key ? result : null;
  return {
    devis: current?.devis || null,
    pourLeRevendeur: current?.pourLeRevendeur || null,
    error: current?.error || null,
    loading: Boolean(key && !current),
  };
}
