'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Liste de choix du design system (2026-09-13) — remplace le `<select>`
 * natif, dont la roue ou la bulle système iOS ignore totalement le style de
 * l'application (signalé par capture sur la ville de livraison).
 *
 * Même gabarit que les champs (Field.tsx) : 48 px, rayon 2xl, texte 16 px sur
 * téléphone, focus au vert de marque. Clavier : Entrée/Espace ouvre, flèches
 * pour se déplacer, Échap ferme.
 */
export interface Choix {
  valeur: string;
  libelle: string;
  detail?: string;
}

export default function ChoicePicker({
  id,
  valeur,
  choix,
  onChange,
  placeholder = 'Choisir…',
  invalide = false,
}: {
  id?: string;
  valeur: string;
  choix: Choix[];
  onChange: (valeur: string) => void;
  placeholder?: string;
  invalide?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const selection = choix.find((c) => c.valeur === valeur);

  useEffect(() => {
    if (!ouvert) return;
    const surClic = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', surClic);
    return () => document.removeEventListener('mousedown', surClic);
  }, [ouvert]);

  const ouvrir = () => {
    setActif(Math.max(0, choix.findIndex((c) => c.valeur === valeur)));
    setOuvert(true);
  };

  const choisir = (v: string) => {
    onChange(v);
    setOuvert(false);
  };

  const surTouche = (e: React.KeyboardEvent) => {
    if (!ouvert) {
      if (['Enter', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); ouvrir(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOuvert(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActif((i) => Math.min(choix.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActif((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (choix[actif]) choisir(choix[actif].valeur); }
  };

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => (ouvert ? setOuvert(false) : ouvrir())}
        onKeyDown={surTouche}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-invalid={invalide}
        className={`w-full h-12 flex items-center justify-between gap-2 bg-white border rounded-2xl px-3.5 text-base sm:text-sm text-left focus:outline-none focus:ring-2 focus:ring-suguba-brand/30 focus:border-suguba-brand ${
          invalide ? 'border-rose-400' : 'border-slate-200'
        }`}
      >
        <span className={`truncate ${selection ? 'text-slate-900' : 'text-slate-400'}`}>
          {selection ? selection.libelle : placeholder}
          {selection?.detail && <span className="text-slate-500"> · {selection.detail}</span>}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${ouvert ? 'rotate-180' : ''}`} />
      </button>

      {ouvert && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1.5 w-full max-h-72 overflow-y-auto bg-white border border-slate-100 rounded-2xl shadow-float p-1.5 animate-slide-down"
        >
          {choix.map((c, i) => {
            const choisi = c.valeur === valeur;
            return (
              <li key={c.valeur} role="option" aria-selected={choisi}>
                <button
                  type="button"
                  onClick={() => choisir(c.valeur)}
                  onMouseEnter={() => setActif(i)}
                  className={`w-full min-h-[44px] px-3 rounded-xl flex items-center justify-between gap-3 text-left text-sm transition-colors ${
                    i === actif ? 'bg-slate-50' : ''
                  } ${choisi ? 'text-suguba-brand font-bold' : 'text-slate-800'}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{c.libelle}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {c.detail && <span className={`text-xs ${choisi ? 'text-suguba-brand' : 'text-slate-500'}`}>{c.detail}</span>}
                    {choisi ? <Check className="w-4 h-4" strokeWidth={3} /> : <span className="w-4" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
