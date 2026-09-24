'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Megaphone, ChevronRight } from 'lucide-react';

/**
 * « Ces boutiques recherchent actuellement des revendeurs » (§ 18).
 *
 * Le composant ne rend RIEN tant qu'aucune boutique ne recrute : une section
 * vide avec un titre prometteur sur une page d'adhésion donne l'impression
 * d'une plateforme déserte, l'inverse de l'effet recherché.
 */

interface BoutiqueRecrute {
  slug: string;
  nom: string;
  accroche: string | null;
  logo: string | null;
  abonnes: number;
}

export default function BoutiquesQuiRecrutent() {
  const [boutiques, setBoutiques] = useState<BoutiqueRecrute[]>([]);

  useEffect(() => {
    let annule = false;
    fetch('/api/reseau/boutiques')
      .then((r) => r.json())
      .then((data) => { if (!annule) setBoutiques(data.boutiques || []); })
      .catch(() => { /* section simplement absente */ });
    return () => { annule = true; };
  }, []);

  if (boutiques.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
          <Megaphone className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Ces boutiques recherchent des revendeurs</h2>
          <p className="text-xs text-slate-500">Choisissez leurs produits, vendez, touchez votre commission.</p>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {boutiques.map((b) => (
          <Link
            key={b.slug}
            href={`/boutique/${b.slug}`}
            className="flex items-center gap-3 bg-white rounded-3xl border border-slate-200 p-3 hover:border-slate-300 active:scale-[0.99] transition-all"
          >
            {b.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.logo} alt="" className="w-11 h-11 rounded-2xl object-cover shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-500 font-bold flex items-center justify-center shrink-0">
                {b.nom.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 truncate">{b.nom}</p>
              <p className="text-xs text-slate-500 truncate">
                {b.accroche || (b.abonnes > 0 ? `${b.abonnes} abonné${b.abonnes > 1 ? 's' : ''}` : 'Recrute des revendeurs')}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
          </Link>
        ))}
      </div>
    </section>
  );
}
