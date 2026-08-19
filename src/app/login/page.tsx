'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { sugubaStore, useSugubaStore } from '@/lib/store';
import { authService } from '@/lib/auth-service';
import { UserRole } from '@/types';
import {
  ArrowRight, Smartphone, CheckCircle2, MessageCircle,
  ShieldCheck, Zap, Store, ShoppingBag, Truck, Shield
} from 'lucide-react';

const quickRoles = [
  { role: 'reseller' as UserRole,  label: 'Revendeur',   icon: Store,       color: 'bg-emerald-50 text-emerald-700 border-emerald-200',  dest: '/reseller'  },
  { role: 'supplier' as UserRole,  label: 'Fournisseur', icon: ShoppingBag, color: 'bg-blue-50 text-blue-700 border-blue-200',            dest: '/supplier'  },
  { role: 'driver' as UserRole,    label: 'Livreur',     icon: Truck,       color: 'bg-amber-50 text-amber-700 border-amber-200',         dest: '/driver'    },
  { role: 'admin' as UserRole,     label: 'Admin',       icon: Shield,      color: 'bg-purple-50 text-purple-700 border-purple-200',      dest: '/admin'     },
];

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

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.replace(/\s+/g, '').length < 8) {
      setErrorMessage('Numéro de téléphone invalide.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await authService.requestOtp(phone, otpChannel);
      setIsLoading(false);
      if (res.success) {
        if (res.otpCode) setGeneratedOtp(res.otpCode);
        setStep('otp');
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate([100, 50, 100]); } catch (_) {}
        }
      } else {
        setErrorMessage(res.error || 'Erreur lors de l\'envoi du code.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Une erreur est survenue.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      const verifyRes = await authService.verifyOtpAndSyncProfile(phone, otpCode);
      setIsLoading(false);

      if (verifyRes.success && verifyRes.profile) {
        const role = verifyRes.profile.role;
        const destMap: Record<string, string> = {
          admin: '/admin',
          driver: '/driver',
          supplier: '/supplier',
          reseller: '/reseller',
          customer: '/reseller',
        };
        router.push(destMap[role] || '/reseller');
      } else {
        setErrorMessage(verifyRes.error || 'Code OTP invalide.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Erreur lors de la vérification.');
    }
  };

  const handleQuickLogin = (role: UserRole, dest: string) => {
    sugubaStore.switchRole(role);
    router.push(dest);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8f5]">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden shrink-0">
            <Image 
              src="/images/logo.png" 
              alt="Logo Suguba" 
              fill 
              className="object-contain"
              priority
            />
          </div>
          <span className="font-black text-gray-900 text-lg tracking-tight">
            SUGUBA<span className="text-suguba-brand">.ML</span>
          </span>
        </Link>
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          Retour à l&apos;accueil
        </Link>
      </div>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-sm space-y-4">

          {/* Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-100 shadow-float">

            {/* Header */}
            <div className="text-center mb-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-3 shadow-brand-md"
                style={{ background: 'linear-gradient(135deg, #09b500 0%, #16a34a 100%)' }}
              >
                S
              </div>
              <h1 className="text-xl font-black text-gray-900">
                {step === 'phone' ? 'Connexion Suguba' : 'Vérification'}
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                {step === 'phone'
                  ? 'Entrez votre numéro pour recevoir un code de connexion'
                  : `Code envoyé au ${phone}`}
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className={`h-1 flex-1 rounded-full transition-all ${step === 'phone' || step === 'otp' ? 'bg-suguba-brand' : 'bg-gray-100'}`} />
              <div className={`h-1 flex-1 rounded-full transition-all ${step === 'otp' ? 'bg-suguba-brand' : 'bg-gray-100'}`} />
            </div>

            {/* STEP 1 — Phone */}
            {step === 'phone' && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-700">
                    Numéro de téléphone
                  </label>
                  <div className="relative">
                    <Smartphone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type="tel"
                      required
                      placeholder="+223 70 00 00 00"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-suguba-brand/30 focus:border-suguba-brand transition-all"
                    />
                  </div>
                </div>

                {/* Channel selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-500">
                    Recevoir le code via
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOtpChannel('whatsapp')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                        otpChannel === 'whatsapp'
                          ? 'bg-[#25D366] text-white border-[#25D366] shadow-sm'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setOtpChannel('sms')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                        otpChannel === 'sms'
                          ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      SMS
                    </button>
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-suguba-brand hover:bg-suguba-brand-dark text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-brand-md hover:shadow-brand-lg transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Envoi du code...
                    </span>
                  ) : (
                    <>
                      Recevoir mon code
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2 — OTP */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-up">

                {/* OTP Demo Banner */}
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">
                    Code de démonstration
                  </p>
                  <p className="font-mono text-3xl font-black text-gray-900 tracking-[0.4em]">
                    {generatedOtp}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-700 text-center">
                    Saisir le code à 4 chiffres
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    autoFocus
                    placeholder="• • • •"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full py-4 bg-gray-50 border border-gray-200 rounded-2xl text-center text-3xl font-mono font-black tracking-[0.6em] text-gray-900 focus:outline-none focus:ring-2 focus:ring-suguba-brand/30 focus:border-suguba-brand transition-all"
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600 text-center">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-suguba-brand hover:bg-suguba-brand-dark text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-brand-md transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Vérification...
                    </span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Valider & Accéder
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => { setStep('phone'); setOtpCode(''); setErrorMessage(''); }}
                    className="text-gray-400 hover:text-gray-600 transition-colors font-medium"
                  >
                    Modifier le numéro
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeneratedOtp(Math.floor(1000 + Math.random() * 9000).toString())}
                    className="text-suguba-brand hover:underline font-semibold"
                  >
                    Renvoyer le code
                  </button>
                </div>
              </form>
            )}

            {/* Register CTA */}
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-500">
                Pas encore de compte ?{' '}
                <Link href="/register" className="font-bold text-suguba-brand hover:underline">
                  Créer un compte pro &rarr;
                </Link>
              </p>
            </div>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-gray-50">
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                <ShieldCheck className="w-3 h-3 text-suguba-brand" />
                OTP sécurisé
              </div>
              <div className="w-px h-3 bg-gray-200" />
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                <Zap className="w-3 h-3 text-amber-500" />
                Sans mot de passe
              </div>
            </div>
          </div>

          {/* Quick Demo Access */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-card">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center mb-3">
              Accès démo rapide
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {quickRoles.map(({ role, label, icon: Icon, color, dest }) => (
                <button
                  key={role}
                  onClick={() => handleQuickLogin(role, dest)}
                  className={`p-2 rounded-xl text-center border transition-all hover:shadow-sm active:scale-95 ${color}`}
                >
                  <Icon className="w-4 h-4 mx-auto mb-0.5" />
                  <span className="text-[9px] font-bold leading-none block">{label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* Bottom legal */}
      <div className="text-center pb-6 px-4">
        <p className="text-[10px] text-gray-300">
          En vous connectant, vous acceptez les{' '}
          <Link href="/legal/terms" className="text-suguba-brand hover:underline">
            Conditions générales
          </Link>{' '}
          et la{' '}
          <Link href="/legal/privacy" className="text-suguba-brand hover:underline">
            Politique de confidentialité
          </Link>
        </p>
      </div>
    </div>
  );
}
