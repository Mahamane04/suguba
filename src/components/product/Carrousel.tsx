'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import ProductImage from '@/components/common/ProductImage';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Carrousel de photos produit : on balaie du doigt sur téléphone (défilement
 * natif avec aimantation, donc fluide même sur un appareil modeste — aucune
 * bibliothèque), flèches au survol sur ordinateur, points pour savoir où l'on
 * en est. `miniatures` ajoute la rangée de vignettes de la page produit.
 */
export default function Carrousel({
  images,
  alt,
  href,
  className = 'aspect-square',
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
  priority = false,
  miniatures = false,
}: {
  images: string[];
  alt: string;
  href?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  miniatures?: boolean;
}) {
  const piste = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const photos = images.filter(Boolean).length > 0 ? images.filter(Boolean) : [''];
  const plusieurs = photos.length > 1;

  const allerA = (i: number) => {
    const el = piste.current;
    if (!el) return;
    const cible = Math.max(0, Math.min(photos.length - 1, i));
    el.scrollTo({ left: cible * el.clientWidth, behavior: 'smooth' });
  };

  const surDefilement = () => {
    const el = piste.current;
    if (el && el.clientWidth > 0) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="space-y-2">
      <div className={`relative group bg-slate-100 overflow-hidden ${className}`}>
        <div
          ref={piste}
          onScroll={surDefilement}
          className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory scrollbar-none overscroll-x-contain"
        >
          {photos.map((src, i) => {
            const image = (
              <ProductImage
                src={src}
                alt={plusieurs ? `${alt} — photo ${i + 1}` : alt}
                fill
                sizes={sizes}
                className="object-cover"
                priority={priority && i === 0}
                draggable={false}
              />
            );
            return (
              <div key={i} className="relative shrink-0 w-full h-full snap-center">
                {href ? <Link href={href} className="absolute inset-0" draggable={false}>{image}</Link> : image}
              </div>
            );
          })}
        </div>

        {plusieurs && (
          <>
            <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1 pointer-events-none">
              {photos.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full shadow transition-all ${i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => allerA(index - 1)}
              disabled={index === 0}
              aria-label="Photo précédente"
              className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow items-center justify-center text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity disabled:!hidden"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => allerA(index + 1)}
              disabled={index === photos.length - 1}
              aria-label="Photo suivante"
              className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow items-center justify-center text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity disabled:!hidden"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {miniatures && plusieurs && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {photos.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => allerA(i)}
              aria-label={`Voir la photo ${i + 1}`}
              className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                i === index ? 'border-suguba-brand' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <ProductImage src={src} alt="" fill sizes="64px" className="object-cover" compact />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
