'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import BottomNav from '@/components/common/BottomNav';
import EarningsCalculator from '@/components/reseller/EarningsCalculator';
import { supabase } from '@/lib/supabase';
import {
  Sparkles, ShieldCheck, Wallet, Users
} from 'lucide-react';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3a7.4 7.4 0 0 1-11-3.89H1.08v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.07 14.2a7.2 7.2 0 0 1 0-4.4V6.71H1.08a12 12 0 0 0 0 10.58l3.99-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.08 6.71l3.99 3.09A7.16 7.16 0 0 1 12 4.75Z" />
    </svg>
  );
}

function JoinContent() {
  const searchParams = useSearchParams();
  const refCode = searchParams?.get('ref') || 'SG-REV-492';
  const [formError, setFormError] = React.useState('');

  // Inscription Google seulement — plus de formulaire téléphone/OTP ici :
  // le numéro, le quartier et le code de parrainage se recueillent juste
  // après (/register/complete), une fois l'identité déjà vérifiée par
  // Google. Le code de parrainage survit à l'aller-retour OAuth via le
  // paramètre "ref" de la redirection, relu par /auth/callback.
  const handleGoogleJoin = async () => {
    setFormError('');
    if (!supabase) {
      setFormError('Inscription Google indisponible sur cet environnement.');
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?intendedRole=reseller&ref=${encodeURIComponent(refCode)}` },
    });
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

      {/* Registration Card — Google seulement */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="font-black text-base text-slate-900">Créer mon Compte Revendeur Gratuit</h2>
          <p className="text-[11px] text-slate-500">Accès immédiat au catalogue de produits rémunérés</p>
        </div>

        <button
          type="button"
          onClick={handleGoogleJoin}
          className="w-full py-4 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800 font-black rounded-2xl text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
        >
          <GoogleIcon className="w-5 h-5" />
          S&apos;inscrire avec Google
        </button>
        <p className="text-[10px] text-slate-400 text-center -mt-3">
          Sans code, sans mot de passe. Il ne restera qu&apos;à confirmer votre numéro et votre
          quartier à Bamako.
        </p>

        {formError && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600">
            {formError}
          </div>
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
