'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Sélecteur de variantes de la fiche produit (taille, capacité…). Chaque
 * pastille mène à la fiche de la variante — un vrai produit, avec son prix et
 * son stock — en conservant le code revendeur de la visite.
 */
interface Variante { slug: string; libelle: string; prix: number; enStock: boolean }

export default function SelecteurVariantes({ slug }: { slug: string }) {
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [suite, setSuite] = useState('');

  useEffect(() => {
    setSuite(window.location.search);
    fetch(`/api/products/variantes?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((d) => setVariantes(d.variantes || [])).catch(() => undefined);
  }, [slug]);

  if (variantes.length < 2) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-slate-700">Choisir</p>
      <div className="flex flex-wrap gap-2" role="list">
        {variantes.map((v) => {
          const actif = v.slug === slug;
          return (
            <Link
              key={v.slug}
              href={`/p/${v.slug}${suite}`}
              replace
              scroll={false}
              aria-current={actif ? 'true' : undefined}
              className={`min-h-[44px] px-3.5 rounded-2xl border text-left inline-flex flex-col justify-center ${
                actif ? 'border-suguba-brand ring-2 ring-suguba-brand bg-suguba-brand/5' : 'border-slate-200 bg-white'
              } ${v.enStock ? '' : 'opacity-50'}`}
            >
              <span className="text-xs font-black text-slate-900">{v.libelle}</span>
              <span className="text-[11px] text-slate-500 tabular-nums">{v.enStock ? `${v.prix.toLocaleString('fr-FR')} F` : 'Épuisé'}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
