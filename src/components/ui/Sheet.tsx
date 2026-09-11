'use client';

import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';

/**
 * Fenêtre commune (2026-09-11) : feuille qui monte du bas sur téléphone, là
 * où tombe le pouce ; boîte centrée sur ordinateur. Remplace les fenêtres
 * écrites à la main dans chaque écran (dix variantes, toutes différentes).
 *
 * Échap et clic sur le fond ferment ; le défilement de la page est bloqué
 * pendant l'ouverture ; titre relié à la boîte pour les lecteurs d'écran.
 */
export default function Sheet({
  ouvert,
  onFermer,
  titre,
  sousTitre,
  children,
  pied,
  large = false,
}: {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  sousTitre?: string;
  children: React.ReactNode;
  /** Zone d'actions collée en bas (boutons). */
  pied?: React.ReactNode;
  large?: boolean;
}) {
  const idTitre = useId();

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer(); };
    const debordement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', surTouche);
    return () => {
      document.body.style.overflow = debordement;
      document.removeEventListener('keydown', surTouche);
    };
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center sm:p-4" onClick={onFermer}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        onClick={(e) => e.stopPropagation()}
        className={`bg-white w-full ${large ? 'sm:max-w-2xl' : 'sm:max-w-lg'} rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col animate-fade-up`}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="min-w-0">
            <h2 id={idTitre} className="text-base font-black text-slate-900">{titre}</h2>
            {sousTitre && <p className="text-xs text-slate-500 line-clamp-2">{sousTitre}</p>}
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="w-10 h-10 -mr-2 -mt-1 rounded-full hover:bg-slate-100 flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
        {pied && (
          <div className="p-4 border-t border-slate-100 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-4">{pied}</div>
        )}
      </div>
    </div>
  );
}
