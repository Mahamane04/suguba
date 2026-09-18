'use client';

import { useEffect, useState } from 'react';

/**
 * Produits sponsorisés d'un emplacement, côté navigateur.
 *
 * Renvoie une table produit → sponsorisation. Les vues sont comptées UNE fois
 * par sponsorisation et par visite (sessionStorage) : revenir trois fois sur
 * l'accueil ne triple pas les chiffres montrés au fournisseur.
 */

const cache = new Map<string, Promise<Map<string, string>>>();

function charger(emplacement: string): Promise<Map<string, string>> {
  let p = cache.get(emplacement);
  if (!p) {
    p = fetch(`/api/reseau/sponsorises?emplacement=${encodeURIComponent(emplacement)}`)
      .then((r) => (r.ok ? r.json() : { sponsorises: [] }))
      .then((d) => new Map<string, string>((d.sponsorises || []).map((s: { id: string; productId: string }) => [s.productId, s.id])))
      .catch(() => new Map<string, string>());
    cache.set(emplacement, p);
  }
  return p;
}

export function useSponsorises(emplacement: string): Map<string, string> {
  const [table, setTable] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let annule = false;
    charger(emplacement).then((t) => { if (!annule) setTable(t); });
    return () => { annule = true; };
  }, [emplacement]);
  return table;
}

function envoyer(evenement: 'vue' | 'clic', ids: string[]) {
  if (ids.length === 0) return;
  const corps = JSON.stringify({ evenement, ids });
  try {
    // sendBeacon : le clic mène à une autre page, une requête fetch classique
    // serait coupée par la navigation.
    if (navigator.sendBeacon?.('/api/reseau/sponsorises', new Blob([corps], { type: 'application/json' }))) return;
  } catch { /* repli ci-dessous */ }
  fetch('/api/reseau/sponsorises', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corps, keepalive: true }).catch(() => undefined);
}

/** Compte une vue pour les sponsorisations affichées, une fois par visite. */
export function compterVues(ids: string[]) {
  let dejaVues: string[] = [];
  try { dejaVues = JSON.parse(sessionStorage.getItem('suguba_sponso_vues') || '[]'); } catch { /* vide */ }
  const nouvelles = ids.filter((id) => !dejaVues.includes(id));
  if (nouvelles.length === 0) return;
  try { sessionStorage.setItem('suguba_sponso_vues', JSON.stringify([...dejaVues, ...nouvelles].slice(-200))); } catch { /* ignoré */ }
  envoyer('vue', nouvelles);
}

export function compterClic(id: string) {
  envoyer('clic', [id]);
}
