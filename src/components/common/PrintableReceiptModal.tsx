'use client';

import React from 'react';
import { Order } from '@/types';
import { X, Printer, CheckCircle2, ShieldCheck, Phone } from 'lucide-react';

interface PrintableReceiptModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PrintableReceiptModal({ order, isOpen, onClose }: PrintableReceiptModalProps) {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Header Actions (Non imprimé) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <Printer className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm">Bordereau de Livraison & Reçu Client</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>
            <button 
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Ticket Area */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto font-mono text-slate-900 text-xs print:p-0 print:m-0">
          
          {/* Brand Header */}
          <div className="text-center space-y-1 border-b-2 border-dashed border-slate-300 pb-4">
            <h2 className="text-xl font-black tracking-wider uppercase">SUGUBA MALI</h2>
            <p className="text-[10px] text-slate-500 font-sans">Plateforme de Social Commerce & Logistique</p>
            <p className="text-[10px] font-sans">Bamako, Mali • Tél : <strong>+223 89 46 00 00</strong></p>
            <p className="text-[9px] text-slate-400 font-sans">https://app.sugubaml.com</p>
          </div>

          {/* Order Meta */}
          <div className="grid grid-cols-2 gap-2 text-[11px] border-b-2 border-dashed border-slate-300 pb-3">
            <div>
              <span className="text-slate-500 block">N° COMMANDE :</span>
              <strong className="text-sm font-black">{order.orderNumber}</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">DATE :</span>
              <strong>{new Date(order.createdAt).toLocaleString('fr-FR')}</strong>
            </div>
          </div>

          {/* Customer & Destination */}
          <div className="bg-slate-50 p-3 rounded-xl space-y-1 text-[11px]">
            <p><strong>DESTINATAIRE :</strong> {order.customerName}</p>
            <p><strong>TÉLÉPHONE :</strong> {order.customerPhone}</p>
            <p><strong>QUARTIER :</strong> {order.neighborhood} ({order.city})</p>
            <p><strong>REPÈRE :</strong> {order.landmark}</p>
            {order.deliveryNotes && <p className="italic text-slate-500">Note : {order.deliveryNotes}</p>}
          </div>

          {/* Items Table */}
          <div className="space-y-2 border-b-2 border-dashed border-slate-300 pb-4">
            <div className="flex justify-between font-bold text-[10px] uppercase text-slate-400 border-b border-slate-200 pb-1">
              <span>Désignation</span>
              <span className="text-right">Total FCFA</span>
            </div>
            
            <div className="flex justify-between py-1 text-[11px]">
              <div>
                <span className="font-bold">{order.productName}</span>
                <span className="text-slate-500 block text-[10px]">Qté : {order.quantity} x {((order.totalProductAmount) / order.quantity).toLocaleString('fr-FR')} F</span>
              </div>
              <span className="font-black">{order.totalProductAmount.toLocaleString('fr-FR')} F</span>
            </div>

            <div className="flex justify-between py-1 text-[11px]">
              <span>Frais de Livraison Bamako</span>
              <span className="font-bold">{(order.deliveryFee || 1500).toLocaleString('fr-FR')} F</span>
            </div>
          </div>

          {/* Total Amount Due */}
          <div className="flex justify-between items-center text-sm font-black pt-1">
            <span className="uppercase text-xs font-bold">TOTAL À PAYER :</span>
            <span className="text-base font-black px-3 py-1 bg-slate-100 rounded-lg">
              {order.totalAmount.toLocaleString('fr-FR')} FCFA
            </span>
          </div>

          {/* Secret OTP Security Box */}
          <div className="border-2 border-slate-900 rounded-xl p-3 text-center space-y-1">
            <span className="text-[9px] uppercase tracking-wider font-bold block text-slate-600">
              CODE SECRET DE VALIDATION OTP
            </span>
            <div className="text-2xl font-black tracking-[0.3em] font-mono">
              {order.deliveryOtp}
            </div>
            <p className="text-[9px] text-slate-500 font-sans leading-tight">
              À communiquer au livreur après vérification physique de la marchandise.
            </p>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-[10px]">
            <div className="space-y-8">
              <p className="font-bold text-slate-500">Signature Livreur :</p>
              <div className="border-b border-slate-400 w-3/4"></div>
            </div>
            <div className="space-y-8 text-right">
              <p className="font-bold text-slate-500">Signature Client :</p>
              <div className="border-b border-slate-400 w-3/4 ml-auto"></div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center text-[9px] text-slate-400 font-sans pt-2">
            <p>Merci pour votre confiance sur Suguba.ml !</p>
            <p>Service Client & SAV : +223 89 46 00 00</p>
          </div>

        </div>

      </div>
    </div>
  );
}
