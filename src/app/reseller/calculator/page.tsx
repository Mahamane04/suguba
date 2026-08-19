'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import EarningsCalculator from '@/components/reseller/EarningsCalculator';
import { 
  Sparkles, ArrowLeft, ShieldCheck, 
  Smartphone, Wallet, CheckCircle2, TrendingUp, Users, HeartHandshake
} from 'lucide-react';

export default function ResellerCalculatorPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full space-y-8">
        
        {/* Navigation & Header */}
        <div className="space-y-2 text-center max-w-2xl mx-auto">
          <Link 
            href="/reseller" 
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 shadow-xs mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à l&apos;Espace Revendeur</span>
          </Link>

          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Opportunité Social Commerce Mali</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Combien pouvez-vous gagner par mois avec Suguba ?
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Ajustez les curseurs ci-dessous selon votre rythme de vente et découvrez vos gains potentiels versés par Wave ou Orange Money.
          </p>
        </div>

        {/* The Interactive Calculator Component */}
        <EarningsCalculator showCta={true} />

        {/* 3 Real Testimonial Case Studies from Bamako */}
        <div className="space-y-4">
          <h2 className="text-base font-black text-slate-900 text-center">
            Exemples Réels de Revendeurs à Bamako
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  FD
                </div>
                <div>
                  <strong className="block text-slate-900">Fatoumata D. (22 ans)</strong>
                  <span className="text-[10px] text-slate-400">Étudiante à la FSEG (Badalabougou)</span>
                </div>
              </div>
              <p className="text-slate-600 leading-relaxed">
                « Je partage 2 articles de beauté et Bazin par jour sur mon statut WhatsApp entre deux cours. Je gagne environ <strong>75 000 FCFA / mois</strong> pour payer mes études ! »
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                  OT
                </div>
                <div>
                  <strong className="block text-slate-900">Oumar T. (27 ans)</strong>
                  <span className="text-[10px] text-slate-400">Créateur TikTok (Hamdallaye ACI)</span>
                </div>
              </div>
              <p className="text-slate-600 leading-relaxed">
                « Avec mes vidéos de démonstration d&apos;électroménager et mon équipe de 8 filleuls, je dépasse les <strong>240 000 FCFA / mois</strong> retirés directement sur Wave. »
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
                  MC
                </div>
                <div>
                  <strong className="block text-slate-900">Mariam C. (34 ans)</strong>
                  <span className="text-[10px] text-slate-400">Mère au foyer (Kalaban-Coro)</span>
                </div>
              </div>
              <p className="text-slate-600 leading-relaxed">
                « Pas besoin de quitter la maison pour aller au marché. Suguba livre mes clientes à domicile et je reçois mes commissions le jour même. »
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
