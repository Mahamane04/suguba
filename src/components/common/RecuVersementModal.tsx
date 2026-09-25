'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from '@/hooks/useModalFocus';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import type { Versement } from '@/lib/caisse-livreur';
import { Printer, X } from 'lucide-react';

const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
const date = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

/** Texte du reçu, repris tel quel dans le message WhatsApp. */
export function texteRecuVersement(v: Versement, nomLivreur: string): string {
  const lignes = [
    `Suguba — reçu de versement ${v.remittanceNumber}`,
    `Livreur : ${nomLivreur}`,
    `Date : ${date(v.createdAt)}`,
    v.ordersCount ? `Commandes : ${v.ordersCount}` : 'Versement de régularisation',
    v.ordersCount ? `Espèces encaissées : ${fmt(v.cashTotal)}` : '',
    v.remunerationRetained ? `Rémunération gardée : ${fmt(v.remunerationRetained)}` : '',
    `Montant dû : ${fmt(v.amountDue)}`,
    `Montant reçu : ${fmt(v.amountReceived)}`,
    v.difference < 0 ? `Reste à verser : ${fmt(-v.difference)}` : v.difference > 0 ? `Versé en plus : ${fmt(v.difference)}` : 'Compte soldé',
    v.receivedByName ? `Reçu par : ${v.receivedByName}` : '',
  ];
  return lignes.filter(Boolean).join('\n');
}

/**
 * Reçu d'un versement d'espèces à la caisse Suguba (2026-09-25). Imprimable,
 * et envoyable au livreur sur WhatsApp : chacun garde la même trace.
 */
export default function RecuVersementModal({
  versement,
  nomLivreur,
  telephoneLivreur,
  onClose,
}: {
  versement: Versement | null;
  nomLivreur: string;
  /** Présent côté admin : propose d'envoyer le reçu au livreur. */
  telephoneLivreur?: string | null;
  onClose: () => void;
}) {
  const { host, ref } = useModalFocus(Boolean(versement), onClose);
  if (!versement || !host) return null;
  const v = versement;

  const chiffres = (telephoneLivreur || '').replace(/\D/g, '');
  const numeroWa = chiffres.length === 8 ? `223${chiffres}` : chiffres;
  const lienWa = numeroWa ? `https://wa.me/${numeroWa}?text=${encodeURIComponent(texteRecuVersement(v, nomLivreur))}` : null;

  const Ligne = ({ l, m, fort }: { l: string; m: string; fort?: boolean }) => (
    <div className={`flex justify-between gap-3 ${fort ? 'font-bold text-sm' : ''}`}>
      <span>{l}</span><span className="text-right">{m}</span>
    </div>
  );

  return createPortal(
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Reçu de versement" onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/70">
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-3 flex items-center justify-between gap-2 border-b border-slate-100 print:hidden">
          <h2 className="font-bold text-sm text-slate-900 pl-1">Reçu de versement</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => window.print()}
              className="min-h-11 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5">
              <Printer className="w-4 h-4" /> Imprimer
            </button>
            <button type="button" onClick={onClose} aria-label="Fermer le reçu"
              className="w-11 h-11 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-7 space-y-4 overflow-y-auto font-mono text-xs text-slate-900">
          <div className="text-center space-y-1 border-b-2 border-dashed border-slate-300 pb-3">
            <p className="text-lg font-bold tracking-wider">SUGUBA MALI</p>
            <p className="font-sans text-slate-600">Reçu de versement d&apos;espèces</p>
            <p className="font-bold text-sm">{v.remittanceNumber}</p>
            <p className="font-sans text-slate-600">{date(v.createdAt)}</p>
          </div>

          <div className="space-y-1">
            <Ligne l="Livreur" m={nomLivreur} />
            {v.receivedByName && <Ligne l="Reçu par" m={v.receivedByName} />}
          </div>

          <div className="space-y-1 border-t border-dashed border-slate-300 pt-3">
            {v.ordersCount > 0 ? (
              <>
                <Ligne l={`Commandes livrées (${v.ordersCount})`} m={fmt(v.cashTotal)} />
                {v.remunerationRetained > 0 && <Ligne l="Rémunération gardée" m={`− ${fmt(v.remunerationRetained)}`} />}
              </>
            ) : (
              <p className="font-sans text-slate-700">Versement de régularisation (rattrape un manque précédent).</p>
            )}
            <Ligne l="Montant dû" m={fmt(v.amountDue)} />
            <Ligne l="Montant reçu" m={fmt(v.amountReceived)} fort />
          </div>

          <p className={`text-center font-sans font-bold rounded-xl py-2 ${v.difference < 0 ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>
            {v.difference < 0 ? `Reste à verser : ${fmt(-v.difference)}` : v.difference > 0 ? `Versé en plus : ${fmt(v.difference)}` : 'Compte soldé'}
          </p>

          {v.note && <p className="font-sans text-slate-600">Note : {v.note}</p>}

          <div className="grid grid-cols-2 gap-6 pt-6 font-sans text-slate-500 text-center">
            <p className="border-t border-slate-300 pt-1">Signature livreur</p>
            <p className="border-t border-slate-300 pt-1">Signature caisse</p>
          </div>
        </div>

        {lienWa && (
          <div className="p-3 border-t border-slate-100 print:hidden">
            <a href={lienWa} target="_blank" rel="noopener noreferrer"
              className="h-12 w-full rounded-2xl bg-suguba-wa hover:bg-[#20bd5a] text-suguba-profond text-sm font-bold inline-flex items-center justify-center gap-2">
              <WhatsAppIcon className="w-4 h-4" /> Envoyer le reçu au livreur
            </a>
          </div>
        )}
      </div>
    </div>,
    host,
  );
}
