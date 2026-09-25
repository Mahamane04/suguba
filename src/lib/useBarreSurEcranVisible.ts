'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * Garde une barre `position: fixed; bottom: 0` collée au bas de l'écran
 * RÉELLEMENT visible sur iPhone (2026-09-25).
 *
 * Sur iOS, surtout dans l'application installée sur l'écran d'accueil,
 * l'écran visible (visualViewport) se décale parfois de la zone de mise en
 * page — après la fermeture du clavier, pendant un défilement rapide : la
 * barre, accrochée au bas de la zone de mise en page, se retrouvait au
 * milieu de l'écran. On mesure l'écart et on le compense par une
 * translation, image par image.
 *
 * Renvoie aussi `clavier` : vrai quand le clavier occupe l'écran (l'écran
 * visible a perdu plus d'un quart de sa hauteur), pour masquer la barre.
 */
export function useBarreSurEcranVisible(ref: RefObject<HTMLElement | null>): { clavier: boolean; mesure: boolean } {
  const [clavier, setClavier] = useState(false);
  // Faux sur les navigateurs sans visualViewport : l'appelant retombe alors
  // sur la détection par champ sélectionné (useClavierOuvert).
  const [mesure, setMesure] = useState(false);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const el = ref.current;
    if (!vv || !el) return;
    setMesure(true);

    let image = 0;
    const appliquer = () => {
      image = 0;
      // Zoom au pincement : on laisse la barre à sa place normale.
      if (vv.scale > 1.01) {
        el.style.transform = '';
        return;
      }
      const ecart = vv.offsetTop + vv.height - window.innerHeight;
      el.style.transform = Math.abs(ecart) > 1 ? `translateY(${Math.round(ecart)}px)` : '';
      setClavier(vv.height < window.innerHeight * 0.75);
    };
    const planifier = () => { if (!image) image = requestAnimationFrame(appliquer); };

    appliquer();
    vv.addEventListener('resize', planifier);
    vv.addEventListener('scroll', planifier);
    window.addEventListener('scroll', planifier, { passive: true });
    return () => {
      if (image) cancelAnimationFrame(image);
      vv.removeEventListener('resize', planifier);
      vv.removeEventListener('scroll', planifier);
      window.removeEventListener('scroll', planifier);
      el.style.transform = '';
    };
  }, [ref]);

  return { clavier, mesure };
}
