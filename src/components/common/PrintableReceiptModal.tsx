'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from '@/hooks/useModalFocus';
import { Order } from '@/types';
import { X, Printer, CheckCircle2, ShieldCheck, Phone } from 'lucide-react';

interface PrintableReceiptModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PrintableReceiptModal({ order, isOpen, onClose }: PrintableReceiptModalProps) {
  const { host, ref } = useModalFocus(isOpen && Boolean(order), onClose);
  if (!isOpen || !order || !host) return null;

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Bordereau de livraison" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Header Actions (Non imprimé) */}
        <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center space-x-2">
            <Printer className="w-5 h-5 shrink-0 text-amber-400" />
            <h3 className="font-bold text-sm">Bordereau de Livraison & Reçu Client</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="min-h-11 px-3 py-1.5 bg-suguba-profond hover:bg-suguba-profond-2 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>
            <button 
              onClick={onClose}
              aria-label="Fermer le bordereau"
              className="w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Ticket Area */}
        <div tabIndex={0} role="region" aria-label="Contenu du bordereau" className="p-4 sm:p-8 space-y-6 overflow-y-auto break-words font-mono text-slate-900 text-xs print:p-0 print:m-0">
          
          {/* Brand Header */}
          <div className="text-center space-y-1 border-b-2 border-dashed border-slate-300 pb-4">
            <h2 className="text-xl font-bold tracking-wider uppercase">SUGUBA MALI</h2>
            <p className="text-xs text-slate-600 font-sans">Plateforme de Social Commerce & Logistique</p>
            <p className="text-xs font-sans">Bamako, Mali • Tél : <strong>+223 89 46 00 00</strong></p>
            <p className="text-xs text-slate-600 font-sans">https://app.sugubaml.com</p>
          </div>

          {/* Order Meta */}
          <div className="grid grid-cols-2 gap-2 text-xs border-b-2 border-dashed border-slate-300 pb-3">
            <div>
              <span className="text-slate-600 block">N° COMMANDE :</span>
              <strong className="text-sm font-bold">{order.orderNumber}</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-600 block">DATE :</span>
              <strong>{new Date(order.createdAt).toLocaleString('fr-FR')}</strong>
            </div>
          </div>

          {/* Customer & Destination */}
          <div className="bg-slate-50 p-3 rounded-xl space-y-1 text-xs">
            <p><strong>DESTINATAIRE :</strong> {order.customerName}</p>
            <p><strong>TÉLÉPHONE :</strong> {order.customerPhone}</p>
            <p><strong>QUARTIER :</strong> {order.neighborhood} ({order.city})</p>
            <p><strong>REPÈRE :</strong> {order.landmark}</p>
            {order.deliveryNotes && <p className="italic text-slate-600">Note : {order.deliveryNotes}</p>}
          </div>

          {/* Items Table */}
          <div className="space-y-2 border-b-2 border-dashed border-slate-300 pb-4">
            <div className="flex justify-between font-bold text-xs uppercase text-slate-600 border-b border-slate-200 pb-1">
              <span>Désignation</span>
              <span className="text-right">Total FCFA</span>
            </div>
            
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-1 text-xs">
              <div>
                <span className="font-bold">{order.productName}</span>
                <span className="text-slate-600 block text-xs">Qté : {order.quantity} x {((order.totalProductAmount) / order.quantity).toLocaleString('fr-FR')} F</span>
              </div>
              <span className="font-bold">{order.totalProductAmount.toLocaleString('fr-FR')} F</span>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-1 text-xs">
              <span>Frais de Livraison Bamako</span>
              <span className="font-bold">{(order.deliveryFee ?? 0).toLocaleString('fr-FR')} F</span>
            </div>
          </div>

          {/* Total Amount Due */}
          <div className="flex flex-wrap gap-2 justify-between items-center text-sm font-bold pt-1">
            <span className="uppercase text-xs font-bold">TOTAL À PAYER :</span>
            <span className="text-base font-bold px-3 py-1 bg-slate-100 rounded-lg">
              {order.totalAmount.toLocaleString('fr-FR')} FCFA
            </span>
          </div>

          <div className="border-2 border-slate-900 rounded-xl p-3 text-center text-sm text-slate-700">
            Le code de remise est transmis séparément par SMS au destinataire.
            Donnez-le au livreur uniquement après avoir vérifié le colis.
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-xs">
            <div className="space-y-8">
              <p className="font-bold text-slate-600">Signature Livreur :</p>
              <div className="border-b border-slate-400 w-3/4"></div>
            </div>
            <div className="space-y-8 text-right">
              <p className="font-bold text-slate-600">Signature Client :</p>
              <div className="border-b border-slate-400 w-3/4 ml-auto"></div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center text-xs text-slate-600 font-sans pt-2">
            <p>Merci pour votre confiance sur Suguba.ml !</p>
            <p>Service Client & SAV : +223 89 46 00 00</p>
          </div>

        </div>

      </div>
    </div>, host
  );
}
