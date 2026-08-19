'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore } from '@/lib/store';
import { 
  Building2, Users, CheckCircle2, Plus, 
  ArrowLeft, Sparkles, ExternalLink, ShieldCheck, Star, ShoppingBag, ArrowRight
} from 'lucide-react';

export default function ResellerChannelsDirectoryPage() {
  const state = useSugubaStore();

  const [joinedChannels, setJoinedChannels] = useState<string[]>(['batimat', 'diarra']);

  const channels = [
    {
      id: 'batimat',
      slug: 'batimat',
      name: 'BATIMAT MALI',
      category: 'Bricolage, Outillage & Maison',
      logo: 'B',
      bgColor: 'from-blue-900 to-slate-900',
      tagColor: 'bg-blue-100 text-blue-800',
      description: 'Matériaux certifiés, outillage professionnel, robinetterie et aménagement.',
      commissionRange: '5 000 F à 15 000 F / vente',
      activePromoters: 142,
      productsCount: 28,
    },
    {
      id: 'diarra',
      slug: 'diarra-electronique',
      name: 'DIARRA ÉLECTRONIQUE',
      category: 'Électroménager & Cuisine',
      logo: 'D',
      bgColor: 'from-amber-800 to-slate-900',
      tagColor: 'bg-amber-100 text-amber-900',
      description: 'Mixeurs blenders 2-en-1, robots pétrins inox 6.5L et petit électroménager.',
      commissionRange: '3 000 F à 7 000 F / vente',
      activePromoters: 310,
      productsCount: 15,
    },
    {
      id: 'bazin',
      slug: 'bazin-prestige',
      name: 'BAZIN PRESTIGE BAMAKO',
      category: 'Mode & Bazin Riche Getzner',
      logo: 'P',
      bgColor: 'from-purple-900 to-slate-900',
      tagColor: 'bg-purple-100 text-purple-800',
      description: 'Grands boubous brodés de fête, bazin getzner et ensembles traditionnels.',
      commissionRange: '4 000 F à 8 000 F / vente',
      activePromoters: 215,
      productsCount: 45,
    },
    {
      id: 'solaire',
      slug: 'solaire-mali',
      name: 'SOLAIRE MALI INNOVATION',
      category: 'Énergie & Ventilateurs Solaires',
      logo: 'S',
      bgColor: 'from-emerald-900 to-slate-900',
      tagColor: 'bg-emerald-100 text-emerald-800',
      description: 'Ventilateurs rechargeables 16", kits solaires autonomes et éclairage LED.',
      commissionRange: '4 500 F à 12 000 F / vente',
      activePromoters: 189,
      productsCount: 18,
    }
  ];

  const toggleChannel = (channelId: string) => {
    if (joinedChannels.includes(channelId)) {
      setJoinedChannels(joinedChannels.filter(id => id !== channelId));
    } else {
      setJoinedChannels([...joinedChannels, channelId]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link 
              href="/reseller" 
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à l&apos;Espace Revendeur</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center space-x-2">
              <Building2 className="w-6 h-6 text-emerald-600" />
              <span>Canaux de Grandes Marques Partenaires</span>
            </h1>
            <p className="text-xs text-slate-500">
              Choisissez les canaux d&apos;entreprises qui correspondent à votre audience (Batimat, Bazin, Solaire, Électro).
            </p>
          </div>

          <div className="px-3.5 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-black rounded-xl self-start sm:self-auto flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{joinedChannels.length} Canaux Actifs sur Votre Compte</span>
          </div>
        </div>

        {/* Channels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {channels.map((channel) => {
            const isMember = joinedChannels.includes(channel.id);

            return (
              <div 
                key={channel.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar */}
                  <div className={`p-5 bg-gradient-to-r ${channel.bgColor} text-white flex items-center justify-between`}>
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-xl text-white border border-white/20">
                        {channel.logo}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">
                          Canal Officiel
                        </span>
                        <h3 className="font-black text-base text-white">{channel.name}</h3>
                      </div>
                    </div>

                    <Link 
                      href={`/c/${channel.slug}`}
                      target="_blank"
                      className="text-white/80 hover:text-white p-2 rounded-xl bg-white/10"
                      title="Voir la page publique du canal"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${channel.tagColor}`}>
                        {channel.category}
                      </span>
                      <span className="text-slate-400 font-medium">
                        {channel.productsCount} articles en stock
                      </span>
                    </div>

                    <p className="text-slate-600 leading-relaxed">
                      {channel.description}
                    </p>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Commission par vente :</span>
                      <strong className="text-emerald-700 font-black font-mono">{channel.commissionRange}</strong>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-5 pt-0 flex items-center space-x-2">
                  <button
                    onClick={() => toggleChannel(channel.id)}
                    className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black transition-all flex items-center justify-center space-x-2 ${
                      isMember 
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                        : 'bg-slate-900 hover:bg-emerald-600 text-white shadow-xs'
                    }`}
                  >
                    {isMember ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Canal Actif sur Mon Compte</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Rejoindre Ce Canal</span>
                      </>
                    )}
                  </button>

                  <Link
                    href="/reseller/catalog"
                    className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-colors"
                    title="Voir les produits au catalogue"
                  >
                    <ShoppingBag className="w-4 h-4" />
                  </Link>
                </div>

              </div>
            );
          })}
        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
