'use client';

import { useEffect, useState } from 'react';

/**
 * Vrai pendant qu'un champ de saisie a le focus — donc, sur téléphone, pendant
 * que le clavier est ouvert (2026-09-11).
 *
 * Pourquoi : sur iPhone, Safari repositionne mal les éléments `position: fixed`
 * collés en bas quand le clavier s'ouvre puis se ferme. La barre de navigation
 * du bas restait « flottante » au milieu de l'écran, décalée exactement de la
 * hauteur du clavier (constaté sur /admin après saisie dans les réglages
 * économiques). Masquer ces éléments pendant la saisie — ce que font les
 * grandes applications — libère de la place pour taper, et les réafficher à
 * la fermeture force Safari à recalculer leur position.
 */
function estChampDeSaisie(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(el.type);
  }
  return false;
}

export function useClavierOuvert(): boolean {
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    const surFocus = (e: FocusEvent) => {
      if (estChampDeSaisie(e.target as Element)) {
        clearTimeout(minuteur);
        setOuvert(true);
      }
    };
    // La saisie est finie si le focus ne part pas vers un autre champ.
    // `relatedTarget` (l'élément qui reçoit le focus) est fiable partout ;
    // `document.activeElement`, lu juste après la perte de focus, ne l'est
    // pas — selon le navigateur il désigne encore l'ancien champ, et la barre
    // restait masquée pour de bon après la fermeture du clavier.
    const surPerteFocus = (e: FocusEvent) => {
      const suivant = e.relatedTarget as Element | null;
      if (estChampDeSaisie(suivant)) return;
      clearTimeout(minuteur);
      // Court délai : un focusin qui suivrait aussitôt (autre champ, sans
      // relatedTarget sur certains mobiles) annule la réapparition.
      minuteur = setTimeout(() => setOuvert(false), 80);
    };

    document.addEventListener('focusin', surFocus);
    document.addEventListener('focusout', surPerteFocus);
    return () => {
      clearTimeout(minuteur);
      document.removeEventListener('focusin', surFocus);
      document.removeEventListener('focusout', surPerteFocus);
    };
  }, []);

  return ouvert;
}
