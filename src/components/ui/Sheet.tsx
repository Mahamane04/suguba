'use client';

import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from '@/hooks/useModalFocus';
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

  const { host, ref } = useModalFocus(ouvert, onFermer);
  if (!ouvert || !host) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center sm:p-4" onClick={onFermer}>
      <div
        ref={ref}
        tabIndex={-1}
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
            <h2 id={idTitre} className="text-base font-bold text-slate-900">{titre}</h2>
            {sousTitre && <p className="text-xs text-slate-500 line-clamp-2">{sousTitre}</p>}
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="w-11 h-11 -mr-2 -mt-1 rounded-full hover:bg-slate-100 flex items-center justify-center shrink-0"
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
    </div>, host
  );
}
