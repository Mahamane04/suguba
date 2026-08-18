'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import { sugubaStore, useSugubaStore } from '@/lib/store';
import { UserRole } from '@/types';
import { 
  Store, ShoppingBag, Truck, Shield, ArrowRight, 
  Smartphone, Lock, CheckCircle2, UserPlus, Sparkles 
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const state = useSugubaStore();
  const [phone, setPhone] = useState('+223 79 11 22 33');
  const [selectedRole, setSelectedRole] = useState<UserRole>('reseller');

  const handleQuickLogin = (role: UserRole) => {
    sugubaStore.switchRole(role);
    if (role === 'reseller') router.push('/reseller');
    else if (role === 'supplier') router.push('/supplier');
    else if (role === 'driver') router.push('/driver');
    else if (role === 'admin') router.push('/admin');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xl space-y-6">
          
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-700 text-white font-black text-2xl flex items-center justify-center mx-auto shadow-md shadow-emerald-600/20">
              S
            </div>
            <h1 className="text-xl font-black text-slate-900 pt-2">
              Connexion à Suguba
            </h1>
            <p className="text-xs text-slate-500">
              Accédez à votre espace professionnel selon votre activité.
            </p>
          </div>

          {/* Quick 1-Tap Role Logins */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block text-center">
              Accès Démo Rapide par Espace :
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleQuickLogin('reseller')}
                className="p-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50/60 hover:bg-emerald-100 text-left transition-all group"
              >
                <div className="flex items-center space-x-2">
                  <Store className="w-4 h-4 text-emerald-700" />
                  <span className="font-bold text-xs text-emerald-950">Revendeur</span>
                </div>
                <p className="text-[10px] text-emerald-700/80 mt-1">Moussa (184k F gagnés)</p>
              </button>

              <button
                onClick={() => handleQuickLogin('supplier')}
                className="p-3 rounded-2xl border border-slate-200 hover:border-blue-500 bg-white hover:bg-blue-50/50 text-left transition-all group"
              >
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="w-4 h-4 text-blue-700" />
                  <span className="font-bold text-xs text-slate-900">Fournisseur</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Diarra Électronique</p>
              </button>

              <button
                onClick={() => handleQuickLogin('driver')}
                className="p-3 rounded-2xl border border-slate-200 hover:border-amber-500 bg-white hover:bg-amber-50/50 text-left transition-all group"
              >
                <div className="flex items-center space-x-2">
                  <Truck className="w-4 h-4 text-amber-700" />
                  <span className="font-bold text-xs text-slate-900">Livreur</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Amadou Traoré (Moto)</p>
              </button>

              <button
                onClick={() => handleQuickLogin('admin')}
                className="p-3 rounded-2xl border border-slate-200 hover:border-purple-500 bg-white hover:bg-purple-50/50 text-left transition-all group"
              >
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-purple-700" />
                  <span className="font-bold text-xs text-slate-900">Admin Master</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Suguba Ops Desk</p>
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] text-slate-400 font-bold uppercase">ou par téléphone</span>
          </div>

          {/* Regular Phone Login */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleQuickLogin(selectedRole);
            }} 
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Numéro de Téléphone
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3.5 px-4 rounded-2xl text-xs flex items-center justify-center space-x-2 transition-colors"
            >
              <span>Se Connecter</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

        </div>
      </main>
    </div>
  );
}
