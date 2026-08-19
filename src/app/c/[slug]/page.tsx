'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore } from '@/lib/store';
import { 
  Building2, Users, Trophy, CheckCircle2, ArrowRight, 
  Sparkles, Share2, ShieldCheck, Star, Package, MapPin
} from 'lucide-react';

export default function BrandChannelPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  const state = useSugubaStore();

  const [isJoined, setIsJoined] = useState(false);

  // Configuration dynamique de la marque (exemple Batimat ou autre)
  const brandChannels: Record<string, {
    name: string;
    category: string;
    logo: string;
    description: string;
    headquarters: string;
    commissionRange: string;
    activePromoters: number;
    totalProductsCount: number;
  }> = {
    'batimat': {
      name: 'BATIMAT MALI',
      category: 'Bricolage, Outillage & Équipements de la Maison',
      logo: 'B',
      description: 'Leader de la distribution de matériaux, outillage professionnel et équipements modernes de la maison au Mali.',
      headquarters: 'Zone Industrielle, Rue 14, Bamako',
      commissionRange: '5 000 F à 15 000 F',
      activePromoters: 142,
      totalProductsCount: 28,
    },
    'bazin-prestige': {
      name: 'BAZIN PRESTIGE BAMAKO',
      category: 'Mode Traditionnelle, Bazin Riche & Textile de Luxe',
      logo: 'P',
      description: 'Maison de référence des grands boubous Bazin Getzner brodés et tenues de cérémonies à Bamako.',
      headquarters: 'Grand Marché & ACI 2000, Bamako',
      commissionRange: '4 000 F à 8 000 F',
      activePromoters: 215,
      totalProductsCount: 45,
    },
    'solaire-mali': {
      name: 'SOLAIRE MALI INNOVATION',
      category: 'Énergie Solaire, Ventilateurs & Kits d\'Éclairage',
      logo: 'S',
      description: 'Solutions d\'autonomie énergétique et ventilateurs rechargeables haute capacité certifiés.',
      headquarters: 'Hamdallaye ACI 2000, Bamako',
      commissionRange: '4 500 F à 12 000 F',
      activePromoters: 189,
      totalProductsCount: 18,
    }
  };

  const currentBrand = brandChannels[slug] || brandChannels['batimat'];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full space-y-8">
        
        {/* Brand Banner Hero */}
        <div className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-10 shadow-2xl overflow-hidden space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            <div className="flex items-start space-x-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-3xl sm:text-4xl shadow-xl border-2 border-white/20 shrink-0">
                {currentBrand.logo}
              </div>

              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                    Canal Entreprise Officiel Suguba
                  </span>
                  <span className="text-amber-400 text-xs font-bold flex items-center">
                    <Star className="w-3.5 h-3.5 fill-current mr-1" />
                    Entreprise Certifiée
                  </span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                  {currentBrand.name}
                </h1>
                <p className="text-xs sm:text-sm text-emerald-300 font-bold">
                  {currentBrand.category}
                </p>
                <p className="text-xs text-slate-300 flex items-center space-x-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Siège : {currentBrand.headquarters}</span>
                </p>
              </div>
            </div>

            {/* CTA Join Channel */}
            <div className="flex flex-col sm:items-end space-y-2">
              {isJoined ? (
                <div className="px-6 py-3.5 bg-emerald-600 text-white font-black rounded-2xl text-xs flex items-center space-x-2 shadow-lg">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Vous êtes membre de ce Canal !</span>
                </div>
              ) : (
                <button
                  onClick={() => setIsJoined(true)}
                  className="px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-2xl text-sm shadow-xl shadow-emerald-500/30 flex items-center justify-center space-x-2 transition-transform active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Rejoindre le Canal & Vendre leurs Produits</span>
                </button>
              )}

              <p className="text-[11px] text-slate-400 text-center sm:text-right">
                Inscription 100% gratuite • Zéro investissement
              </p>
            </div>

          </div>

          {/* Key Metrics of the Channel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-white/10 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Commissions par Vente</span>
              <p className="font-black text-emerald-400 text-base">{currentBrand.commissionRange}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Revendeurs Actifs</span>
              <p className="font-black text-white text-base">{currentBrand.activePromoters} Partageurs</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Articles au Catalogue</span>
              <p className="font-black text-white text-base">{currentBrand.totalProductsCount} Références</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Paiement Garanti</span>
              <p className="font-black text-amber-400 text-base">Par Wave & Orange Money</p>
            </div>
          </div>
        </div>

        {/* How It Works for Resellers */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              Comment fonctionne le Canal {currentBrand.name} pour vous ?
            </h2>
            <p className="text-xs text-slate-500">
              Une opportunité concrète pour gagner de l&apos;argent avec les grandes marques à Bamako.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="w-7 h-7 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center">1</span>
              <strong className="block text-slate-900 font-bold">Intégrez le Canal</strong>
              <p className="text-slate-600 leading-relaxed">
                Les produits certifiés de {currentBrand.name} apparaissent directement dans votre catalogue revendeur personnel.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center">2</span>
              <strong className="block text-slate-900 font-bold">Partagez sur WhatsApp / TikTok</strong>
              <p className="text-slate-600 leading-relaxed">
                Téléchargez les affiches officielles en 1 clic et partagez avec votre lien personnalisé auprès de vos contacts et groupes.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">3</span>
              <strong className="block text-slate-900 font-bold">Encaissez Vos Gains</strong>
              <p className="text-slate-600 leading-relaxed">
                Suguba livre à domicile et valide la remise avec le code OTP. Vos commissions tombent immédiatement sur votre solde !
              </p>
            </div>
          </div>
        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
