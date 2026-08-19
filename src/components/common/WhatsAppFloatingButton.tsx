'use client';

import React, { useState } from 'react';
import { MessageCircle, X, ShoppingBag, Users, Phone, HelpCircle } from 'lucide-react';

export default function WhatsAppFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const supportPhone = '22389460000';

  const handleOpenWhatsApp = (topic: string) => {
    const text = `Bonjour Suguba Mali, je vous contacte concernant : *${topic}*.`;
    window.open(`https://api.whatsapp.com/send?phone=${supportPhone}&text=${encodeURIComponent(text)}`, '_blank');
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-40">
      
      {/* Expanded Popup Menu */}
      {isOpen && (
        <div className="mb-3 bg-white rounded-3xl p-4 shadow-2xl border border-slate-200 w-72 space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-200 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-xl bg-[#25D366] text-white flex items-center justify-center">
                <MessageCircle className="w-4 h-4 fill-current" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Assistance Suguba</h4>
                <p className="text-[10px] text-emerald-600 font-bold">En ligne • Réponse en 5 min</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-slate-600 leading-tight">
            Besoin d&apos;aide pour une commande, un suivi ou pour devenir revendeur ?
          </p>

          <div className="space-y-1.5">
            <button
              onClick={() => handleOpenWhatsApp('Aide pour passer une commande')}
              className="w-full p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold rounded-xl flex items-center space-x-2 text-left transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
              <span>Aide pour commander</span>
            </button>

            <button
              onClick={() => handleOpenWhatsApp('Rejoindre le réseau des Revendeurs')}
              className="w-full p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold rounded-xl flex items-center space-x-2 text-left transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span>Devenir Revendeur rémunéré</span>
            </button>

            <button
              onClick={() => handleOpenWhatsApp('Suivi de livraison / SAV')}
              className="w-full p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold rounded-xl flex items-center space-x-2 text-left transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Suivre mon colis / SAV</span>
            </button>
          </div>

          <div className="text-center pt-1 border-t border-slate-100 text-[10px] text-slate-400">
            Tél : <strong>+223 89 46 00 00</strong>
          </div>
        </div>
      )}

      {/* Floating Button Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-black rounded-full shadow-2xl shadow-[#25D366]/40 active:scale-95 transition-transform"
        aria-label="Contacter le support sur WhatsApp"
      >
        <MessageCircle className="w-5 h-5 fill-current" />
        <span className="text-xs hidden sm:inline">Besoin d&apos;aide ?</span>
      </button>

    </div>
  );
}
