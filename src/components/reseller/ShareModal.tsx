'use client';

import React, { useState } from 'react';
import { Product } from '@/types';
import { useSugubaStore } from '@/lib/store';
import { 
  X, MessageCircle, Copy, Check, Download, 
  Share2, ArrowRight, DollarSign, Sparkles, ExternalLink 
} from 'lucide-react';
import Image from 'next/image';

interface ShareModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onCreateManualOrder: (product: Product) => void;
}

export default function ShareModal({ product, isOpen, onClose, onCreateManualOrder }: ShareModalProps) {
  const state = useSugubaStore();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  if (!isOpen) return null;

  const currentReseller = state.resellers.find(r => r.userId === state.currentUser.id) || state.resellers[0];
  const refCode = currentReseller?.referralCode || 'MOUSSA123';

  // Construction du lien affilié personnalisé
  const host = typeof window !== 'undefined' ? window.location.origin : 'https://sugubaml.com';
  const referralUrl = `${host}/p/${product.slug}?ref=${refCode}`;

  const fullShareText = `${product.marketingPitch}

🔗 Commander directement ici : ${referralUrl}
🛵 Livraison express partout à Bamako - Payez à la livraison !`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPitch = () => {
    navigator.clipboard.writeText(fullShareText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const encoded = encodeURIComponent(fullShareText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 to-green-700 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-emerald-200" />
            <h3 className="font-bold text-base sm:text-lg">Kit de Vente Revendeur</h3>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          
          {/* Product Summary Card */}
          <div className="flex space-x-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 items-center">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-200 shrink-0">
              <Image 
                src={product.images[0]} 
                alt={product.name} 
                fill 
                className="object-cover" 
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-900 text-sm truncate">{product.name}</h4>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs font-semibold text-slate-600">
                  Prix client : <strong className="text-slate-900">{product.publicPrice.toLocaleString('fr-FR')} FCFA</strong>
                </span>
              </div>
              <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-black">
                💰 Tu gagnes : +{product.resellerCommission.toLocaleString('fr-FR')} FCFA / vente
              </div>
            </div>
          </div>

          {/* 1-Click WhatsApp Share Button */}
          <div>
            <button
              onClick={handleWhatsAppShare}
              className="w-full flex items-center justify-center space-x-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-green-600/20 transition-transform active:scale-[0.98]"
            >
              <MessageCircle className="w-5 h-5 fill-current" />
              <span>Partager sur WhatsApp (Statut / Contact)</span>
            </button>
            <p className="text-center text-[11px] text-slate-500 mt-1.5">
              Ton lien d&apos;affiliation <strong>{refCode}</strong> est automatiquement inclus.
            </p>
          </div>

          {/* Ready-to-copy Sales Pitch */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Texte commercial prêt à poster :
              </label>
              <button
                onClick={handleCopyPitch}
                className="flex items-center space-x-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'Copié !' : 'Copier le texte'}</span>
              </button>
            </div>
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-line font-mono max-h-36 overflow-y-auto leading-relaxed">
              {fullShareText}
            </div>
          </div>

          {/* Affiliate Link */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Ton lien personnel à partager :
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={referralUrl}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 select-all font-mono"
              />
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center space-x-1 shrink-0 transition-colors"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copié' : 'Copier'}</span>
              </button>
            </div>
          </div>

          {/* Direct Manual Order Creation (For Resellers taking order directly on WhatsApp) */}
          <div className="pt-3 border-t border-slate-100">
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5">
              <p className="text-xs font-bold text-amber-900">
                Un client t&apos;a écrit directement sur WhatsApp ?
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5 mb-2.5">
                Saisis son nom, quartier et téléphone. Suguba s&apos;occupe de l&apos;appel et de la livraison, et la commission te revient !
              </p>
              <button
                onClick={() => {
                  onClose();
                  onCreateManualOrder(product);
                }}
                className="w-full flex items-center justify-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl shadow-xs transition-colors"
              >
                <span>Saisir la commande du client</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
