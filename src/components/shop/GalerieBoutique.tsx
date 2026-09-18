'use client';

import React, { useRef, useState } from 'react';

/**
 * Diaporama de la galerie d'une boutique, sur la page publique. Défilement
 * natif avec aimantation (scroll-snap) : fluide au doigt, sans bibliothèque,
 * et utilisable au clavier.
 */
export default function GalerieBoutique({ images, nom }: { images: string[]; nom: string }) {
  const piste = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  if (images.length === 0) return null;

  return (
    <div className="space-y-2">
      <div
        ref={piste}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label={`Photos de ${nom}`}
        tabIndex={0}
      >
        {images.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={url} alt={`${nom} — photo ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'}
            className="w-full shrink-0 snap-center aspect-[16/10] object-cover" />
        ))}
      </div>
      {images.length > 1 && (
        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {images.map((url, i) => (
            <span key={url} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`} />
          ))}
        </div>
      )}
    </div>
  );
}
