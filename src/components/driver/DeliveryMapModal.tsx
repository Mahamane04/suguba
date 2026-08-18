'use client';

import React from 'react';
import { Order } from '@/types';
import { 
  X, MapPin, Navigation, Phone, MessageCircle, 
  ExternalLink, Compass, ShieldCheck, Banknote 
} from 'lucide-react';

interface DeliveryMapModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DeliveryMapModal({ order, isOpen, onClose }: DeliveryMapModalProps) {
  if (!isOpen || !order) return null;

  // Calcul rive de Bamako
  const riveDroiteQuartiers = ['Kalaban-Coro', 'Baco-Djicoroni', 'Badalabougou', 'Torokorobougou', 'Daoudabougou', 'Yirimadio', 'Sogoniko'];
  const isRiveDroite = riveDroiteQuartiers.some(q => order.neighborhood.toLowerCase().includes(q.toLowerCase()));
  const zoneName = isRiveDroite ? 'Rive Droite (Communes V & VI)' : 'Rive Gauche (Communes I à IV - Centre & ACI)';

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${order.landmark} ${order.neighborhood} Bamako Mali`
  )}`;

  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(
    `${order.landmark} ${order.neighborhood} Bamako`
  )}`;

  const customerWhatsappUrl = `https://api.whatsapp.com/send?phone=${order.customerPhone.replace(/\D/g, '')}&text=${encodeURIComponent(
    `Bonjour ${order.customerName}, je suis votre livreur partenaire Suguba 🛵.\n\nJe suis en route pour vous livrer votre colis #${order.orderNumber} (${order.productName}) au repère : ${order.landmark} (${order.neighborhood}).\n\n💰 Montant à préparer : ${order.totalAmount.toLocaleString('fr-FR')} FCFA\n🔑 Merci de préparer votre Code Secret OTP.`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Compass className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base sm:text-lg">Itinéraire & Repère Terrain</h3>
              <p className="text-[10px] text-slate-300">Commande #{order.orderNumber}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          
          {/* Zone & Sector Badge */}
          <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Secteur Logistique :</span>
            <span className="font-black px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 text-[11px]">
              📍 {zoneName}
            </span>
          </div>

          {/* Destination & Landmark Detailed Card */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-start space-x-3">
              <MapPin className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Quartier de Destination :
                </p>
                <p className="text-base font-black text-slate-900">
                  {order.neighborhood} ({order.city})
                </p>
                
                <div className="mt-2 bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                  <p className="text-[11px] font-bold text-slate-800">
                    📍 Repère Précis : <span className="text-emerald-800 font-black">{order.landmark}</span>
                  </p>
                  {order.deliveryNotes && (
                    <p className="text-[10px] text-slate-500 mt-1 italic">
                      Note client : {order.deliveryNotes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Amount & Contact Preview */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
              <span className="text-[10px] text-slate-500 font-bold block">Client :</span>
              <strong className="text-slate-900 block truncate">{order.customerName}</strong>
              <span className="font-mono text-emerald-700 font-bold">{order.customerPhone}</span>
            </div>

            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-xs">
              <span className="text-[10px] text-amber-800 font-bold block">À encaisser :</span>
              <strong className="text-base font-black text-slate-900">
                {order.totalAmount.toLocaleString('fr-FR')} F
              </strong>
            </div>
          </div>

          {/* Navigation GPS Launch Buttons */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-700">Lancer l&apos;Itinéraire GPS :</p>
            
            <div className="grid grid-cols-2 gap-2">
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-blue-600/20"
              >
                <Navigation className="w-4 h-4" />
                <span>Google Maps</span>
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
              </a>

              <a
                href={wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-cyan-600/20"
              >
                <Compass className="w-4 h-4" />
                <span>Waze GPS</span>
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
              </a>
            </div>
          </div>

          {/* Communication Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            <a
              href={`tel:${order.customerPhone}`}
              className="py-3 px-3 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-1.5"
            >
              <Phone className="w-4 h-4" />
              <span>Appeler le Client</span>
            </a>

            <a
              href={customerWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-1.5 shadow-xs"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>Message WhatsApp</span>
            </a>
          </div>

        </div>

      </div>
    </div>
  );
}
