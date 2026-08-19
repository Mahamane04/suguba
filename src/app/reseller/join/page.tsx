'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import BottomNav from '@/components/common/BottomNav';
import EarningsCalculator from '@/components/reseller/EarningsCalculator';
import { 
  Sparkles, CheckCircle2, ShieldCheck, Wallet, 
  ArrowRight, Users, Phone, MapPin, Award
} from 'lucide-react';

function JoinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const refCode = searchParams?.get('ref') || 'SG-REV-492';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [neighborhood, setNeighborhood] = useState('Hamdallaye ACI 2000');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(true);
      setTimeout(() => {
        router.push('/reseller');
      }, 1500);
    }, 800);
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
      
      {/* Hero Welcome Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Rejoignez le Réseau Officiel Suguba Mali</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
          Gagnez des Revenus depuis votre Smartphone à Bamako
        </h1>

        <p className="text-xs text-slate-600 max-w-md mx-auto">
          Vendez des produits certifiés avec garantie à vos contacts WhatsApp. 
          Suguba s&apos;occupe du stock, de la livraison et de l&apos;encaissement.
        </p>

        {refCode && (
          <div className="inline-block p-2 px-4 bg-purple-50 border border-purple-200 rounded-2xl text-xs font-bold text-purple-900">
            🎁 Parrainé par le code Partenaire : <span className="font-mono font-black">{refCode}</span>
          </div>
        )}
      </div>

      {/* 3 Guarantees */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center space-y-1">
          <Wallet className="w-5 h-5 text-emerald-600 mx-auto" />
          <span className="font-black text-[11px] text-slate-900 block">0 FCFA</span>
          <span className="text-[9px] text-slate-500 block leading-tight">Zéro capital requis</span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center space-y-1">
          <ShieldCheck className="w-5 h-5 text-blue-600 mx-auto" />
          <span className="font-black text-[11px] text-slate-900 block">Garantie 12M</span>
          <span className="text-[9px] text-slate-500 block leading-tight">Produits certifiés</span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center space-y-1">
          <Users className="w-5 h-5 text-purple-600 mx-auto" />
          <span className="font-black text-[11px] text-slate-900 block">Wave / Orange</span>
          <span className="text-[9px] text-slate-500 block leading-tight">Paiement Mobile</span>
        </div>
      </div>

      {/* Registration Form Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="font-black text-base text-slate-900">Créer mon Compte Revendeur Gratuit</h2>
          <p className="text-[11px] text-slate-500">Accès immédiat au catalogue de produits rémunérés</p>
        </div>

        {success ? (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="font-black text-sm text-emerald-950">Bienvenue dans l&apos;équipe Suguba !</h3>
            <p className="text-xs text-emerald-700">Redirection automatique vers votre espace revendeur...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Votre Nom Complet :
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Fatoumata Traoré"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Numéro WhatsApp (pour recevoir vos commissions Wave/Orange) :
              </label>
              <input
                type="tel"
                required
                placeholder="+223 70 00 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Votre Quartier à Bamako :
              </label>
              <select
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Hamdallaye ACI 2000">Hamdallaye ACI 2000</option>
                <option value="Kalaban-Coro">Kalaban-Coro</option>
                <option value="Badalabougou">Badalabougou</option>
                <option value="Baco-Djicoroni">Baco-Djicoroni</option>
                <option value="Médina-Coura">Médina-Coura</option>
                <option value="Yirimadio">Yirimadio</option>
                <option value="Autre quartier de Bamako">Autre quartier</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 active:scale-98 transition-all"
            >
              <span>{isSubmitting ? 'Création de votre compte...' : 'Activer mon Accès Revendeur Immédiat'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

      </div>

      {/* Embedded Live Earnings Calculator */}
      <div className="pt-4">
        <EarningsCalculator showCta={false} />
      </div>

    </div>
  );
}

export default function ResellerJoinPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-16">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<div className="p-10 text-center text-xs">Chargement...</div>}>
          <JoinContent />
        </Suspense>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
