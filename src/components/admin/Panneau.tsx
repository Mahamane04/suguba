'use client';

import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalFocus } from '@/hooks/useModalFocus';

/**
 * Panneau latéral de l'espace équipe (lot U2, 2026-09-27) : ouvre un dossier
 * SANS quitter la liste. Glisse depuis la droite sur ordinateur (la liste
 * reste visible à gauche), occupe l'écran sur téléphone.
 *
 * Échap et clic sur le fond ferment ; focus piégé et rendu à la fermeture
 * (même mécanique que la fenêtre commune, voir useModalFocus).
 */
export default function Panneau({
  ouvert, onFermer, titre, sousTitre, children, pied,
}: {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  sousTitre?: string;
  children: React.ReactNode;
  /** Actions collées en bas du panneau. */
  pied?: React.ReactNode;
}) {
  const idTitre = useId();
  const { host, ref } = useModalFocus(ouvert, onFermer);
  if (!ouvert || !host) return null;

  return createPortal(
    <div className="fixed inset-0 z-[55] bg-slate-900/40 flex justify-end" onClick={onFermer}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full md:w-[480px] lg:w-[540px] h-full flex flex-col shadow-2xl animate-fade-up md:animate-none overscroll-contain"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h2 id={idTitre} className="text-base font-bold text-slate-900 break-words">{titre}</h2>
            {sousTitre && <p className="text-xs text-slate-500 mt-0.5">{sousTitre}</p>}
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer le panneau"
            className="w-10 h-10 -mr-2 -mt-1 rounded-full hover:bg-slate-100 flex items-center justify-center shrink-0">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 [-webkit-overflow-scrolling:touch]">{children}</div>
        {pied && <div className="p-4 border-t border-slate-100 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:pb-4">{pied}</div>}
      </div>
    </div>, host,
  );
}

/** Ligne « libellé : valeur » d'un panneau. */
export function Info({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0 text-sm">
      <dt className="text-slate-500 shrink-0">{libelle}</dt>
      <dd className="text-slate-900 font-semibold text-right min-w-0 break-words">{children}</dd>
    </div>
  );
}
