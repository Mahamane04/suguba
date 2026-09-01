'use client';

import React, { useState } from 'react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import BottomNav from '@/components/common/BottomNav';
import { supabase } from '@/lib/supabase';
import {
  Store, ShoppingBag, Truck, Globe,
  ShieldAlert, UserPlus
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

/**
 * Téléphone/OTP maison retiré de l'inscription (2026-08-26) : aucune
 * passerelle SMS réelle n'était branchée (voir CLAUDE.md), donc ce chemin ne
 * prouvait jamais rien pour un vrai utilisateur. Google reste le seul
 * chemin d'inscription pour les 4 rôles — il prouve une vraie identité
 * (email) sans dépendance à une infrastructure qu'on n'a pas. Les champs
 * métier propres à chaque rôle (entreprise, véhicule, bénéficiaire...) se
 * recueillent juste après, sur /register/complete — voir ce fichier.
 */
export default function RegisterPage() {
  const [selectedRole, setSelectedRole] = useState<'reseller' | 'supplier' | 'driver' | 'diaspora'>('reseller');
  const [registerError, setRegisterError] = useState<string | null>(null);

  const handleGoogleRegister = async () => {
    setRegisterError(null);
    if (!supabase) {
      setRegisterError('Inscription Google indisponible sur cet environnement.');
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?intendedRole=${selectedRole}` },
    });
  };

  const roleLabels: Record<typeof selectedRole, string> = {
    reseller: 'revendeur',
    supplier: 'fournisseur',
    driver: 'livreur',
    diaspora: 'diaspora',
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8f5] pb-20 md:pb-10 font-sans">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">

        {/* Title Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            <UserPlus className="w-3.5 h-3.5" />
            <span>Portail d&apos;Adhésion Officiel Suguba</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Créer votre compte professionnel
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 max-w-xl mx-auto">
            Rejoignez l&apos;écosystème de commerce n°1 au Mali. Choisissez votre profil pour démarrer immédiatement.
          </p>
        </div>

        {/* Role Selector Tabs (4 Roles) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">

          <button
            type="button"
            onClick={() => setSelectedRole('reseller')}
            className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
              selectedRole === 'reseller'
                ? 'bg-emerald-50 border-emerald-500 shadow-brand-sm ring-2 ring-emerald-500'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-gray-900">Revendeur</p>
              <p className="text-[10px] text-gray-500">Vendez sans stock & commissions</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole('supplier')}
            className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
              selectedRole === 'supplier'
                ? 'bg-blue-50 border-blue-500 shadow-xs ring-2 ring-blue-500'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-gray-900">Fournisseur</p>
              <p className="text-[10px] text-gray-500">Déposez et distribuez votre stock</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole('driver')}
            className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
              selectedRole === 'driver'
                ? 'bg-amber-50 border-amber-500 shadow-xs ring-2 ring-amber-500'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-gray-900">Livreur</p>
              <p className="text-[10px] text-gray-500">Courses rémunérées</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole('diaspora')}
            className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
              selectedRole === 'diaspora'
                ? 'bg-purple-50 border-purple-500 shadow-xs ring-2 ring-purple-500'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-gray-900">Diaspora</p>
              <p className="text-[10px] text-gray-500">Commander pour vos proches</p>
            </div>
          </button>

        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-card space-y-4 text-center">
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Google prouve votre identité en un clic — les informations propres au profil {roleLabels[selectedRole]}
            (entreprise, véhicule, bénéficiaire...) seront demandées juste après.
          </p>

          <button
            type="button"
            onClick={handleGoogleRegister}
            className="w-full sm:w-auto mx-auto py-3.5 px-8 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-800 font-bold rounded-2xl text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
          >
            <GoogleIcon className="w-5 h-5" />
            S&apos;inscrire avec Google
          </button>

          {registerError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2 justify-center">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
              <span>{registerError}</span>
            </div>
          )}

          <p className="text-[11px] text-gray-400">
            En créant un compte, vous acceptez les{' '}
            <a href="/legal/terms" className="text-suguba-brand underline">Conditions Générales</a> Suguba.
          </p>
        </div>

        {/* Bottom Login Link */}
        <div className="text-center text-xs text-gray-500">
          Vous avez déjà un compte ?{' '}
          <a href="/login" className="font-bold text-suguba-brand hover:underline">
            Se connecter
          </a>
        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
