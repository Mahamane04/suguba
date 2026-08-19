'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import BottomNav from '@/components/common/BottomNav';
import { sugubaStore, useSugubaStore } from '@/lib/store';
import { UserRole } from '@/types';
import { 
  Store, ShoppingBag, Truck, Shield, ArrowRight, 
  Smartphone, Lock, CheckCircle2, KeyRound, MessageCircle, RefreshCw, Sparkles 
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const state = useSugubaStore();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('+223 76 12 34 56');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('7421');
  const [otpChannel, setOtpChannel] = useState<'sms' | 'whatsapp'>('whatsapp');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(60);

  // Send OTP
  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 8) {
      setErrorMessage('Veuillez entrer un numéro de téléphone valide au Mali.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    // Generate simulated 4-digit OTP
    const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(randomOtp);

    setTimeout(() => {
      setIsLoading(false);
      setStep('otp');
      setCountdown(60);

      // Trigger haptic vibration on smartphone
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([100, 50, 100]);
        } catch (_) {}
      }
    }, 800);
  };

  // Verify OTP
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    setTimeout(() => {
      setIsLoading(false);
      // Valid OTP
      if (otpCode === generatedOtp || otpCode === '1234' || otpCode === '7421' || otpCode.length === 4) {
        // Find or assign role based on phone or default to reseller
        const existingUser = state.users.find(u => u.phone.includes(phone.replace(/\s+/g, '')));
        const roleToAssign = existingUser?.role || 'reseller';

        sugubaStore.switchRole(roleToAssign);

        if (roleToAssign === 'admin') router.push('/admin');
        else if (roleToAssign === 'driver') router.push('/driver');
        else if (roleToAssign === 'supplier') router.push('/supplier');
        else router.push('/reseller');
      } else {
        setErrorMessage('Code OTP incorrect. Veuillez réessayer.');
      }
    }, 700);
  };

  const handleQuickRoleLogin = (role: UserRole) => {
    sugubaStore.switchRole(role);
    if (role === 'reseller') router.push('/reseller');
    else if (role === 'supplier') router.push('/supplier');
    else if (role === 'driver') router.push('/driver');
    else if (role === 'admin') router.push('/admin');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
          
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-700 text-white font-black text-2xl flex items-center justify-center mx-auto shadow-md shadow-emerald-600/20">
              S
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 pt-2">
              Connexion Sécurisée Suguba
            </h1>
            <p className="text-xs text-slate-500">
              {step === 'phone' 
                ? 'Entrez votre numéro pour recevoir votre code d\'accès par SMS ou WhatsApp.' 
                : `Entrez le code secret à 4 chiffres envoyé au ${phone}`}
            </p>
          </div>

          {/* STEP 1: PHONE INPUT */}
          {step === 'phone' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Numéro de Téléphone (Mali) :
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    placeholder="+223 70 00 00 00"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Channel Selector */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500">
                  Recevoir mon code d&apos;accès via :
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOtpChannel('whatsapp')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                      otpChannel === 'whatsapp'
                        ? 'bg-[#25D366] text-white shadow-xs'
                        : 'bg-slate-50 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOtpChannel('sms')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                      otpChannel === 'sms'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-50 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>SMS Direct</span>
                  </button>
                </div>
              </div>

              {errorMessage && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-98"
              >
                <span>{isLoading ? 'Envoi du code...' : 'Recevoir mon Code de Connexion'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* STEP 2: OTP INPUT */
            <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in duration-200">
              
              {/* Simulated OTP Notification Banner */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-1">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                  🔔 Code {otpChannel.toUpperCase()} Reçu (Simulation Démo)
                </span>
                <div className="font-mono text-2xl font-black text-slate-950 tracking-[0.3em]">
                  {generatedOtp}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 text-center">
                  Saisissez le Code à 4 Chiffres :
                </label>
                <input
                  type="text"
                  maxLength={4}
                  required
                  autoFocus
                  placeholder="••••"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full py-3 bg-slate-50 border border-slate-300 rounded-2xl text-center text-2xl font-mono font-black tracking-[0.5em] text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {errorMessage && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-center">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-98"
              >
                <span>{isLoading ? 'Vérification en cours...' : 'Valider & Accéder à Mon Espace'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-slate-600 hover:text-slate-900 font-bold"
                >
                  Modifier le numéro
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextOtp = Math.floor(1000 + Math.random() * 9000).toString();
                    setGeneratedOtp(nextOtp);
                  }}
                  className="text-emerald-700 font-bold hover:underline"
                >
                  Renvoyer le code
                </button>
              </div>
            </form>
          )}

          {/* Quick Demo Role Switcher Bar */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block text-center">
              Ou Accès Démo Direct en 1 Clic :
            </span>

            <div className="grid grid-cols-4 gap-1.5 text-[11px] font-bold text-center">
              <button
                onClick={() => handleQuickRoleLogin('reseller')}
                className="p-2 rounded-xl bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200"
              >
                Revendeur
              </button>
              <button
                onClick={() => handleQuickRoleLogin('supplier')}
                className="p-2 rounded-xl bg-blue-50 text-blue-900 hover:bg-blue-100 border border-blue-200"
              >
                Fournisseur
              </button>
              <button
                onClick={() => handleQuickRoleLogin('driver')}
                className="p-2 rounded-xl bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200"
              >
                Livreur
              </button>
              <button
                onClick={() => handleQuickRoleLogin('admin')}
                className="p-2 rounded-xl bg-purple-50 text-purple-900 hover:bg-purple-100 border border-purple-200"
              >
                Admin
              </button>
            </div>
          </div>

        </div>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
