'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Product, ResellerProfile, User } from '@/types';
import { 
  X, Download, Share2, Sparkles, MessageCircle, 
  Check, Smartphone, Palette, Globe, Layers, Award
} from 'lucide-react';

interface BannerGeneratorModalProps {
  products: Product[];
  reseller: ResellerProfile;
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
}

export default function BannerGeneratorModal({
  products,
  reseller,
  currentUser,
  isOpen,
  onClose,
}: BannerGeneratorModalProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product>(products[0]);
  const [format, setFormat] = useState<'story' | 'square'>('story'); // 9:16 ou 1:1
  const [colorTheme, setColorTheme] = useState<'emerald' | 'amber' | 'dark'>('emerald');
  const [language, setLanguage] = useState<'fr' | 'bm'>('fr');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!isOpen) return null;

  const publicPrice = selectedProduct.publicPrice || selectedProduct.supplierPrice;
  const commission = selectedProduct.resellerCommission || 0;

  // Scripts de vente bilingues
  const salesScriptFr = `🔥 *PROMO BAMAKO : ${selectedProduct.name}*
💰 *Prix Spécial :* ${publicPrice.toLocaleString('fr-FR')} FCFA
🛵 *Livraison :* Partout à Bamako - *Paiement uniquement à la réception !*
🛡️ *Garantie :* ${selectedProduct.warrantyMonths || 6} mois de service certifié

👉 *Commandez directement via mon lien vérifié :*
${typeof window !== 'undefined' ? window.location.origin : 'https://sugubaml.com'}/p/${selectedProduct.slug}?ref=${reseller.referralCode}

Ou contactez-moi par WhatsApp : *${currentUser.phone}*`;

  const salesScriptBm = `🔥 *PROMOTION BAMAKO : ${selectedProduct.name}*
💰 *Sɔngɔ :* ${publicPrice.toLocaleString('fr-FR')} FCFA
🛵 *Delivery :* An bɛ a lase i ma Bamako kono - *I bɛ sara minɛ tuma de la !*
🛡️ *Garantie :* Kalo ${selectedProduct.warrantyMonths || 6} kɔnɔ

👉 *I ka commande kɛ nin lien in na :*
${typeof window !== 'undefined' ? window.location.origin : 'https://sugubaml.com'}/p/${selectedProduct.slug}?ref=${reseller.referralCode}

Walima i k'an wele WhatsApp kan : *${currentUser.phone}*`;

  const activeScript = language === 'fr' ? salesScriptFr : salesScriptBm;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(activeScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(activeScript)}`;
    window.open(url, '_blank');
  };

  // Génération du Flyer sur HTML5 Canvas
  const handleDownloadFlyer = () => {
    setIsGenerating(true);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = format === 'story' ? 1080 : 1080;
    const height = format === 'story' ? 1920 : 1080;
    canvas.width = width;
    canvas.height = height;

    // 1. Fond
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    if (colorTheme === 'emerald') {
      bgGradient.addColorStop(0, '#064e3b');
      bgGradient.addColorStop(1, '#022c22');
    } else if (colorTheme === 'amber') {
      bgGradient.addColorStop(0, '#78350f');
      bgGradient.addColorStop(1, '#451a03');
    } else {
      bgGradient.addColorStop(0, '#0f172a');
      bgGradient.addColorStop(1, '#020617');
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // 2. En-tête Suguba & Badge
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('SUGUBA.ML • OFFRE OFFICIELLE', 60, 100);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('LIVRAISON À DOMICILE BAMAKO • PAIEMENT À LA RÉCEPTION', 60, 150);

    // 3. Titre Produit
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText(selectedProduct.name.substring(0, 32), 60, format === 'story' ? 260 : 230);

    // 4. Prix
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'black 76px sans-serif';
    ctx.fillText(`${publicPrice.toLocaleString('fr-FR')} FCFA`, 60, format === 'story' ? 360 : 310);

    // 5. Cadre Image Produit
    const img = new (window as any).Image();
    img.crossOrigin = 'anonymous';
    img.src = selectedProduct.images[0];
    img.onload = () => {
      const imgY = format === 'story' ? 440 : 360;
      const imgSize = format === 'story' ? 800 : 540;
      
      // Dessin de l'image
      ctx.drawImage(img, (width - imgSize) / 2, imgY, imgSize, imgSize);

      // 6. Pied de page avec contact Revendeur
      const footerY = format === 'story' ? 1450 : 930;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.roundRect?.(60, footerY, width - 120, format === 'story' ? 380 : 120, 30);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText(`Partenaire Revendeur : ${currentUser.fullName}`, 100, footerY + 70);

      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 48px sans-serif';
      ctx.fillText(`📱 WhatsApp : ${currentUser.phone}`, 100, footerY + 140);

      if (format === 'story') {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '32px sans-serif';
        ctx.fillText(`Code Promo Partenaire : ${reseller.referralCode}`, 100, footerY + 220);
        ctx.fillText(`Garantie certifiée ${selectedProduct.warrantyMonths || 6} mois par Suguba Mali`, 100, footerY + 280);
      }

      // Téléchargement du fichier PNG
      const link = document.createElement('a');
      link.download = `suguba-${selectedProduct.slug}-${format}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setIsGenerating(false);
    };

    img.onerror = () => {
      setIsGenerating(false);
      alert('Téléchargement du flyer généré.');
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold text-base sm:text-lg">Studio Marketing & Affiches WhatsApp</h3>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          
          {/* 1. Sélection Produit & Paramètres Visuels */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Choisir le Produit :
              </label>
              <select
                value={selectedProduct.id}
                onChange={(e) => {
                  const found = products.find(p => p.id === e.target.value);
                  if (found) setSelectedProduct(found);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} (+{p.resellerCommission} F)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Format d&apos;Affiche :
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setFormat('story')}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition-colors ${
                    format === 'story' 
                      ? 'bg-slate-900 text-white border-slate-900' 
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  📱 Statut (9:16)
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('square')}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition-colors ${
                    format === 'square' 
                      ? 'bg-slate-900 text-white border-slate-900' 
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  ⬛ Carré (1:1)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Thème Couleur :
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setColorTheme('emerald')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold text-white transition-transform ${
                    colorTheme === 'emerald' ? 'ring-2 ring-emerald-500 scale-105' : 'opacity-75'
                  } bg-emerald-800`}
                >
                  Émeraude
                </button>
                <button
                  type="button"
                  onClick={() => setColorTheme('dark')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold text-white transition-transform ${
                    colorTheme === 'dark' ? 'ring-2 ring-slate-900 scale-105' : 'opacity-75'
                  } bg-slate-950`}
                >
                  Dark
                </button>
                <button
                  type="button"
                  onClick={() => setColorTheme('amber')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold text-white transition-transform ${
                    colorTheme === 'amber' ? 'ring-2 ring-amber-500 scale-105' : 'opacity-75'
                  } bg-amber-800`}
                >
                  Gold
                </button>
              </div>
            </div>
          </div>

          {/* 2. Aperçu Visuel Live du Flyer */}
          <div className={`p-4 rounded-3xl text-white shadow-xl transition-all ${
            colorTheme === 'emerald' ? 'bg-gradient-to-br from-emerald-900 to-slate-900' :
            colorTheme === 'amber' ? 'bg-gradient-to-br from-amber-900 to-slate-900' :
            'bg-gradient-to-br from-slate-900 to-black'
          } ${format === 'story' ? 'max-w-xs mx-auto' : 'w-full'}`}>
            
            <div className="flex justify-between items-center text-[10px] text-emerald-300 font-bold uppercase tracking-wider pb-2 border-b border-white/10">
              <span>SUGUBA.ML • OFFRE CERTIFIÉE</span>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-white">Bamako 24h</span>
            </div>

            <div className="mt-3 space-y-1">
              <h4 className="font-black text-sm text-white line-clamp-1">{selectedProduct.name}</h4>
              <p className="text-xl font-black text-amber-300">{publicPrice.toLocaleString('fr-FR')} FCFA</p>
            </div>

            <div className="relative h-44 my-3 rounded-2xl overflow-hidden bg-white/5 border border-white/10">
              <Image src={selectedProduct.images[0]} alt={selectedProduct.name} fill className="object-cover" />
            </div>

            <div className="p-3 bg-white/10 rounded-2xl border border-white/10 space-y-1 text-xs">
              <p className="text-[11px] text-slate-200">
                👤 Vendeur Agréé : <strong>{currentUser.fullName}</strong>
              </p>
              <p className="text-xs font-black text-emerald-400 flex items-center space-x-1">
                <span>📱 WhatsApp : {currentUser.phone}</span>
              </p>
              <p className="text-[9px] text-slate-400">
                Paiement à la réception • Code : {reseller.referralCode}
              </p>
            </div>
          </div>

          {/* 3. Bouton Télécharger l'Affiche */}
          <button
            onClick={handleDownloadFlyer}
            disabled={isGenerating}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 active:scale-98 transition-transform"
          >
            <Download className="w-4 h-4" />
            <span>{isGenerating ? 'Génération en cours...' : "Télécharger l'Affiche Image (PNG Haute Qualité)"}</span>
          </button>

          {/* 4. Textes & Accroches de Vente (Français / Bambara) */}
          <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-800">Texte pour Statut & Message WhatsApp :</span>
              </div>
              
              <div className="flex space-x-1 bg-white p-1 rounded-xl border border-slate-200 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setLanguage('fr')}
                  className={`px-2 py-0.5 rounded-lg ${language === 'fr' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
                >
                  Français
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('bm')}
                  className={`px-2 py-0.5 rounded-lg ${language === 'bm' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
                >
                  Bambara
                </button>
              </div>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200 text-xs text-slate-700 font-mono whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
              {activeScript}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyScript}
                className="py-2.5 px-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5"
              >
                {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Layers className="w-3.5 h-3.5" />}
                <span>{copiedScript ? 'Copié !' : 'Copier le texte'}</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="py-2.5 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-xs"
              >
                <MessageCircle className="w-3.5 h-3.5 fill-current" />
                <span>Partager sur WhatsApp</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
