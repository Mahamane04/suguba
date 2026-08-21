'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore } from '@/lib/store';
import { 
  Sparkles, Download, Share2, ArrowLeft, 
  Smartphone, QrCode, Palette, ShoppingBag, CheckCircle2, Copy, Check
} from 'lucide-react';

export default function StoryGeneratorPage() {
  const state = useSugubaStore();
  const currentUser = state.currentUser;
  const reseller = state.resellers.find(r => r.userId === currentUser.id) || state.resellers[0];

  const [selectedProduct, setSelectedProduct] = useState(state.products[0]);
  const [theme, setTheme] = useState<'emerald' | 'dark' | 'gold' | 'orange'>('emerald');
  const [customTagline, setCustomTagline] = useState('🔥 Promo Spéciale Bamako • Livraison 24h & Paiement à la réception !');
  const [copiedLink, setCopiedLink] = useState(false);

  // Même correctif que sur /diaspora : les produits arrivent de Supabase après
  // le montage, or selectedProduct est initialisé à products[0] quand la liste
  // est encore vide. Sans cette resynchronisation, la page resterait bloquée
  // sur « aucun produit » alors que le catalogue est rempli.
  useEffect(() => {
    if (!selectedProduct && state.products.length > 0) {
      setSelectedProduct(state.products[0]);
    }
  }, [state.products, selectedProduct]);

  // Catalogue vide : depuis le retrait des produits de démo (mock-data.ts),
  // state.products peut légitimement être vide tant qu'aucun fournisseur n'a
  // référencé d'article. Sortie anticipée AVANT le calcul de productUrl, qui
  // déréférence selectedProduct.slug et faisait planter le build.
  // Tous les hooks sont déclarés au-dessus : leur ordre reste constant.
  if (!selectedProduct) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950">
        <Header />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm text-center space-y-2">
            <p className="text-sm font-black text-white">Aucun produit à promouvoir</p>
            <p className="text-xs text-slate-400">
              Le catalogue Suguba est en cours de constitution. Dès qu&apos;un article sera
              disponible, vous pourrez générer vos visuels de story ici.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const productUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/p/${selectedProduct.slug}?ref=${reseller.referralCode}`
    : `https://app.sugubaml.com/p/${selectedProduct.slug}?ref=${reseller.referralCode}`;

  const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(productUrl)}&size=160&dark=000000&light=ffffff&margin=1`;

  const themeStyles = {
    emerald: {
      bg: 'from-emerald-950 via-slate-900 to-teal-950',
      badgeBg: 'bg-emerald-500 text-slate-950',
      accentColor: 'text-emerald-400',
      btnBg: 'bg-emerald-500 text-slate-950',
    },
    dark: {
      bg: 'from-black via-slate-950 to-zinc-900',
      badgeBg: 'bg-white text-black',
      accentColor: 'text-amber-400',
      btnBg: 'bg-white text-black',
    },
    gold: {
      bg: 'from-amber-950 via-slate-900 to-yellow-950',
      badgeBg: 'bg-amber-400 text-slate-950',
      accentColor: 'text-amber-300',
      btnBg: 'bg-amber-400 text-slate-950',
    },
    orange: {
      bg: 'from-orange-950 via-slate-900 to-rose-950',
      badgeBg: 'bg-orange-500 text-white',
      accentColor: 'text-orange-400',
      btnBg: 'bg-orange-500 text-white',
    },
  };

  const currentTheme = themeStyles[theme];

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(productUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 pb-20 md:pb-10 print:bg-white print:p-0 print:pb-0">
      <div className="print:hidden">
        <Header />
      </div>

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <div className="space-y-1">
            <Link 
              href="/reseller" 
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à l&apos;Espace Revendeur</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center space-x-2">
              <Sparkles className="w-6 h-6 text-amber-500" />
              <span>Générateur d&apos;Affiches Stories 9:16 (TikTok & WhatsApp)</span>
            </h1>
            <p className="text-xs text-slate-500">
              Créez des visuels verticaux professionnels avec votre QR Code et votre numéro en 1 clic.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl text-xs flex items-center space-x-1.5 shadow-md active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger l&apos;Affiche (PNG / PDF)</span>
            </button>

            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                `🔥 *${selectedProduct.name.toUpperCase()}*\n\n💰 Prix Promo : ${selectedProduct.publicPrice.toLocaleString('fr-FR')} FCFA\n${customTagline}\n\n👉 Commandez ici en 1 clic :\n${productUrl}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-2xl text-xs flex items-center space-x-1.5 shadow-xs transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span>Partager Texte WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Studio Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Controls (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5 print:hidden">
            
            {/* Product Picker */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                1. Choisir le Produit à Mettre en Avant :
              </label>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {state.products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className={`w-full p-2.5 rounded-2xl border text-left flex items-center space-x-3 transition-all ${
                      selectedProduct.id === p.id
                        ? 'bg-emerald-50 border-emerald-500 shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-slate-200 shrink-0">
                      <Image src={p.images[0]} alt={p.name} fill className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-slate-900 truncate">{p.name}</p>
                      <p className="text-[11px] font-black text-emerald-700 font-mono">
                        {p.publicPrice.toLocaleString('fr-FR')} FCFA
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <Palette className="w-3.5 h-3.5 text-slate-500" />
                <span>2. Thème de Couleur Story :</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'emerald', label: 'Émeraude', color: 'bg-emerald-600' },
                  { id: 'dark', label: 'Nuit Noire', color: 'bg-slate-950' },
                  { id: 'gold', label: 'Or Luxe', color: 'bg-amber-500' },
                  { id: 'orange', label: 'Sunset', color: 'bg-orange-600' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id as any)}
                    className={`p-2 rounded-xl border text-[10px] font-bold flex flex-col items-center space-y-1 transition-all ${
                      theme === t.id
                        ? 'border-slate-900 bg-slate-100 ring-2 ring-slate-900'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full ${t.color}`}></span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Tagline */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                3. Phrase d&apos;Accroche Personnalisée :
              </label>
              <input
                type="text"
                value={customTagline}
                onChange={(e) => setCustomTagline(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Personal Link Box */}
            <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200 text-xs space-y-1">
              <span className="font-bold text-emerald-950 block">Votre Lien Affilié Pré-intégré :</span>
              <div className="flex items-center justify-between font-mono text-[11px] text-emerald-800 break-all">
                <span className="truncate">{productUrl}</span>
                <button onClick={handleCopyLink} className="p-1 text-emerald-700 ml-2">
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

          </div>

          {/* Right: The 9:16 Story Canvas (7 cols) */}
          <div className="lg:col-span-7 flex justify-center">
            
            {/* 9:16 Vertical Smartphone Poster */}
            <div 
              id="story-poster"
              className={`w-full max-w-sm aspect-[9/16] bg-gradient-to-b ${currentTheme.bg} text-white rounded-[2.5rem] p-6 shadow-2xl flex flex-col justify-between border-4 border-white/10 relative overflow-hidden space-y-4 print:border-none print:shadow-none print:max-w-none print:w-[380px]`}
            >
              {/* Background ambient glow */}
              <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>

              {/* Header: Brand & Reseller Name */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-white text-sm border border-white/20">
                    S
                  </div>
                  <div>
                    <span className="text-xs font-black tracking-tight text-white block">SUGUBA.ML</span>
                    <span className="text-[9px] text-slate-300 block -mt-0.5">Vente Officielle Certifiée</span>
                  </div>
                </div>

                <div className={`px-2.5 py-1 rounded-full ${currentTheme.badgeBg} text-[10px] font-black uppercase tracking-wider`}>
                  Stock Disponible
                </div>
              </div>

              {/* Center: Product Image & Details */}
              <div className="space-y-3 text-center relative z-10">
                
                {/* Image Container with Glow */}
                <div className="relative w-full h-44 sm:h-52 rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20 bg-white/5 mx-auto">
                  <Image
                    src={selectedProduct.images[0]}
                    alt={selectedProduct.name}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute top-2 left-2 px-2.5 py-0.5 bg-black/70 backdrop-blur-xs rounded-lg text-[10px] font-bold text-white">
                    Garantie 12 Mois
                  </div>
                </div>

                {/* Product Titles & Price */}
                <div className="space-y-1">
                  <h2 className="text-base sm:text-lg font-black text-white leading-snug line-clamp-2">
                    {selectedProduct.name}
                  </h2>
                  <p className="text-[11px] text-slate-300 font-medium line-clamp-2 px-2">
                    {customTagline}
                  </p>
                  <div className="pt-1">
                    <span className={`text-2xl sm:text-3xl font-black ${currentTheme.accentColor} font-mono tracking-tight`}>
                      {selectedProduct.publicPrice.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                </div>

              </div>

              {/* Bottom: QR Code + Reseller Contact */}
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-3.5 border border-white/20 flex items-center justify-between gap-3 relative z-10">
                <div className="text-left space-y-0.5 min-w-0">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Commandez auprès de :</span>
                  <p className="text-xs font-black text-white truncate">{currentUser.fullName}</p>
                  <p className="text-[10px] text-amber-300 font-mono font-bold">Code : {reseller.referralCode}</p>
                  <p className="text-[9px] text-slate-300">🛵 Livraison 24h & Paiement à réception</p>
                </div>

                {/* QR Code */}
                <div className="bg-white p-1.5 rounded-2xl shrink-0 shadow-lg text-center">
                  <div className="relative w-16 h-16">
                    <Image
                      src={qrCodeUrl}
                      alt="QR Code"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <span className="text-[7px] font-black text-slate-900 block uppercase -mt-0.5">
                    Scanner
                  </span>
                </div>
              </div>

            </div>

          </div>

        </div>

      </main>

      <div className="print:hidden">
        <Footer />
        <BottomNav />
      </div>
    </div>
  );
}
