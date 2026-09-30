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

          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Opportunité Social Commerce Mali</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Combien pouvez-vous gagner par mois avec Suguba ?
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Ajustez les curseurs ci-dessous selon votre rythme de vente et découvrez vos gains potentiels, versés par Orange Money ou Moov Money.
          </p>
        </div>

        {/* The Interactive Calculator Component */}
        <EarningsCalculator showCta={true} />


      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
