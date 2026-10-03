'use client';

import { useEffect } from 'react';

/** Une visite n'est comptée qu'après 2 s de page VISIBLE (définition validée par le fondateur). */
export const DELAI_VISITE_MS = 2000;

/**
 * Mesure d'une visite de boutique (lot 4 du chantier boutique, 2026-10-03) — invisible.
 *
 * Monté par ShopView seulement pour un visiteur d'une boutique en ligne sur
 * /boutique/<adresse> (jamais pour son propriétaire, ni sur /r/ et /s/). Après
 * 2 s de page visible (document.visibilityState), un seul envoi, en keepalive :
 * il part même si le visiteur quitte la page juste après. Un onglet ouvert en
 * arrière-plan n'est pas une visite : le compte à rebours ne court que page
 * visible, et repart de zéro quand elle le redevient.
 *
 * Le serveur (/api/reseau/visite-boutique) écarte encore le propriétaire et les
 * robots d'aperçu, et ne compte qu'une visite par visiteur et par jour. Rien ne
 * s'affiche, rien ne bloque la page si la mesure échoue.
 */
export default function VisiteBoutique({ slug, via = null }: { slug: string; via?: string | null }) {
  useEffect(() => {
    if (!slug) return;
    let envoye = false;
    let minuteur: number | undefined;

    const envoyer = () => {
      if (envoye || document.visibilityState !== 'visible') return;
      envoye = true;
      fetch('/api/reseau/visite-boutique', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ slug, via: via || null }),
      }).catch(() => undefined);
    };
    const armer = () => {
      window.clearTimeout(minuteur);
      if (!envoye && document.visibilityState === 'visible') minuteur = window.setTimeout(envoyer, DELAI_VISITE_MS);
    };
    const surVisibilite = () => (document.visibilityState === 'visible' ? armer() : window.clearTimeout(minuteur));

    armer();
    document.addEventListener('visibilitychange', surVisibilite);
    return () => {
      window.clearTimeout(minuteur);
      document.removeEventListener('visibilitychange', surVisibilite);
    };
  }, [slug, via]);
  return null;
}
