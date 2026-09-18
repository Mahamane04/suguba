'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

/**
 * Bloc d'accès aux écrans du réseau, posé sur les tableaux de bord.
 *
 * Il n'est PAS ajouté à la barre du bas : elle est déjà pleine (cinq onglets
 * sur un écran de 390 px), et un sixième onglet tronquerait tous les libellés.
 * Un bloc sur le tableau de bord est plus lisible et se laisse enrichir sans
 * casser la navigation principale.
 */

export interface AccesReseau {
  libelle: string;
  href: string;
  icone: React.ElementType;
  aide: string;
}

export default function CarteAccesReseau({ titre, entrees }: { titre: string; entrees: AccesReseau[] }) {
  return (
    <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-sm font-black text-slate-900">{titre}</p>
      </div>
      <div className="divide-y divide-slate-100">
        {entrees.map((entree) => {
          const Icone = entree.icone;
          return (
            <Link
              key={entree.href}
              href={entree.href}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              <div className="w-9 h-9 rounded-2xl bg-suguba-brand/10 text-suguba-brand flex items-center justify-center shrink-0">
                <Icone className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">{entree.libelle}</p>
                <p className="text-[11px] text-slate-500 truncate">{entree.aide}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
