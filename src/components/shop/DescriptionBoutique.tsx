'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Présentation d'une vitrine, avec « Lire la suite » sur téléphone (relecture du
 * lot 3 du chantier boutique, 2026-10-03).
 *
 * La présentation (jusqu'à 1 200 caractères) était coupée à 2 lignes sur
 * téléphone, sans moyen de lire la suite : le client ne voyait jamais ce que le
 * vendeur avait écrit pour le convaincre. Le bouton n'apparaît que si le texte
 * est vraiment coupé (mesuré dans le navigateur) ; à partir de 640 px, le texte
 * est entier et le bouton caché. Seul morceau interactif de l'en-tête, qui reste
 * un composant serveur.
 */
export default function DescriptionBoutique({ texte }: { texte: string }) {
  const id = useId();
  const paragraphe = useRef<HTMLParagraphElement>(null);
  const [deplie, setDeplie] = useState(false);
  const [coupe, setCoupe] = useState(false);

  useEffect(() => {
    const p = paragraphe.current;
    if (!p || deplie) return;
    const mesurer = () => setCoupe(p.scrollHeight > p.clientHeight + 1);
    mesurer();
    if (typeof ResizeObserver === 'undefined') return;
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(p);
    return () => observateur.disconnect();
  }, [deplie, texte]);

  return (
    <div className="max-w-2xl">
      <p id={id} ref={paragraphe} className={`text-sm text-slate-600 leading-relaxed ${deplie ? '' : 'line-clamp-2 sm:line-clamp-none'}`}>
        {texte}
      </p>
      {(coupe || deplie) && (
        <button
          type="button"
          onClick={() => setDeplie((v) => !v)}
          aria-expanded={deplie}
          aria-controls={id}
          className="sm:hidden min-h-10 -ml-1 px-1 inline-flex items-center gap-1 text-sm font-semibold text-suguba-brand-dark"
        >
          {deplie ? 'Réduire' : 'Lire la suite'}
          <ChevronDown className={`w-4 h-4 transition-transform ${deplie ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
