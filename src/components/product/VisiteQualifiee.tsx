'use client';

import { useEffect } from 'react';
import { DUREE_MIN_VISITE_S } from '@/lib/reseau/resultats-constantes';

/**
 * Mesure d'une visite qualifiée (2026-09-26, lot 3) — invisible.
 *
 * Page produit ouverte par le lien d'un revendeur (?ref=CODE) : on demande un
 * jeton à l'ouverture, puis on le rend quand le visiteur est resté au moins
 * 20 s ET a touché ou fait défiler l'écran. Rien ne s'affiche, rien ne
 * bloque la page si la mesure échoue.
 */
export default function VisiteQualifiee({ produitId, code }: { produitId: string; code: string | null }) {
  useEffect(() => {
    if (!produitId || !code) return;
    let jeton: string | null = null;
    let geste = false;
    let tempsEcoule = false;
    let envoye = false;
    let annule = false;

    const envoyer = () => {
      if (envoye || !jeton || !geste || !tempsEcoule) return;
      envoye = true;
      fetch('/api/reseau/visite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ etape: 'fin', jeton }),
      }).catch(() => undefined);
    };
    const surGeste = () => { geste = true; envoyer(); };
    const evenements = ['pointerdown', 'touchstart', 'scroll', 'keydown'] as const;
    evenements.forEach((e) => window.addEventListener(e, surGeste, { passive: true, once: true }));

    fetch('/api/reseau/visite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etape: 'debut', produitId, code }),
    }).then((r) => r.json()).then((d) => { if (!annule) { jeton = d?.jeton || null; envoyer(); } }).catch(() => undefined);

    // Une seconde de marge : le serveur refuse un jeton rendu trop tôt.
    const minuteur = window.setTimeout(() => { tempsEcoule = true; envoyer(); }, (DUREE_MIN_VISITE_S + 1) * 1000);
    return () => {
      annule = true;
      window.clearTimeout(minuteur);
      evenements.forEach((e) => window.removeEventListener(e, surGeste));
    };
  }, [produitId, code]);
  return null;
}
