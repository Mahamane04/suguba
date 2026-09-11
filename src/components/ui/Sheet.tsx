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
    // Simple `overflow:hidden` sur body ne suffit pas sur iOS Safari : la page
    // derrière la feuille continue de "rebondir" au doigt (scroll chaining),
    // ce qui donnait l'impression d'un défilement dur/collant une fois la
    // feuille ouverte. On fige aussi la position du body pendant l'ouverture.
    const y = window.scrollY;
    const { overflow, position, top, width } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${y}px`;
    document.body.style.width = '100%';
    document.addEventListener('keydown', surTouche);
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.position = position;
      document.body.style.top = top;
      document.body.style.width = width;
      window.scrollTo(0, y);
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
        className={`bg-white w-full ${large ? 'sm:max-w-2xl' : 'sm:max-w-lg'} rounded-t-3xl sm:rounded-3xl max-h-[85dvh] sm:max-h-[85vh] flex flex-col animate-fade-up overscroll-contain`}
      >
        {/* Poignée visuelle (mobile) : signale que la feuille vient du bas,
            comme les fiches natives — Échap et clic sur le fond suffisent à
            fermer, c'est un repère purement visuel. */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0" aria-hidden="true">
          <div className="w-9 h-1.5 rounded-full bg-slate-200" />
        </div>
        <div className="flex items-start justify-between gap-3 px-5 pt-3 sm:pt-5 pb-3 shrink-0">
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
        {/* overscroll-contain empêche le défilement de "déborder" vers la page
            derrière ; [-webkit-overflow-scrolling:touch] garde l'inertie du
            doigt fluide sur Safari — c'était la principale cause du
            défilement perçu comme lourd/difficile une fois la feuille ouverte. */}
        <div className="px-5 pb-5 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] flex-1 min-h-0">{children}</div>
        {pied && (
          <div className="p-4 border-t border-slate-100 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-4 shrink-0">{pied}</div>
        )}
      </div>
    </div>
  );
}
