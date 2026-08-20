'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import BottomNav from '@/components/common/BottomNav';
import EarningsCalculator from '@/components/reseller/EarningsCalculator';
import { DIAL_CODES, DEFAULT_DIAL_CODE } from '@/lib/dial-codes';
import { BAMAKO_NEIGHBORHOODS, DEFAULT_NEIGHBORHOOD } from '@/lib/bamako-neighborhoods';
import {
  Sparkles, CheckCircle2, ShieldCheck, Wallet,
  ArrowRight, Users, Phone, MapPin, Award
} from 'lucide-react';

function JoinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const refCode = searchParams?.get('ref') || 'SG-REV-492';

  const [fullName, setFullName] = useState('');
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [localPhone, setLocalPhone] = useState('');
  const [neighborhood, setNeighborhood] = useState(DEFAULT_NEIGHBORHOOD);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  // Étape 1 (formulaire) -> étape 2 (code OTP) : on ne crée jamais de
  // compte tant que le numéro n'a pas été prouvé par un vrai code envoyé
  // par SMS/WhatsApp — voir /api/auth/request-otp et /api/auth/verify-otp.
  // Le formulaire précédent créait une fausse illusion d'inscription avec
  // un setTimeout, sans le moindre appel serveur : aucun compte n'était
  // réellement créé.
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!fullName.trim() || localPhone.replace(/\D/g, '').length < 6) {
      setFormError('Veuillez renseigner votre nom et un numéro de téléphone valide.');
      return;
    }

    const phone = `${dialCode}${localPhone.replace(/\D/g, '')}`;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      setIsSubmitting(false);
      if (!res.ok || !json.success) {
        setFormError(json.error || "Erreur lors de l'envoi du code de vérification.");
        return;
      }
      setOtpPhone(phone);
      setStep('otp');
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      setFormError('Erreur réseau lors de l\'envoi du code.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    try {
      const verifyRes = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: otpPhone, code: otpCode, intendedRole: 'reseller' }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson.success) {
        setIsSubmitting(false);
        setFormError(verifyJson.error || 'Code invalide.');
        return;
      }

      await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          metadata: { neighborhood, referralSponsorCode: refCode },
        }),
      });

      setIsSubmitting(false);
      setSuccess(true);
      setTimeout(() => {
        router.push('/pending-approval');
      }, 1800);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      setFormError('Erreur réseau lors de la vérification.');
    }
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
            <h3 className="font-black text-sm text-emerald-950">Numéro vérifié !</h3>
            <p className="text-xs text-emerald-700">
              Votre dossier revendeur est enregistré et en cours de validation par l&apos;équipe Suguba.
              Redirection...
            </p>
          </div>
        ) : step === 'form' ? (
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
              <div className="flex gap-2">
                <select
                  value={dialCode}
                  onChange={(e) => setDialCode(e.target.value)}
                  aria-label="Indicatif du pays"
                  className="shrink-0 w-[104px] bg-slate-50 border border-slate-200 rounded-2xl px-2 py-3 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {DIAL_CODES.map((d) => (
                    <option key={d.code + d.country} value={d.code}>
                      {d.flag} {d.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  required
                  placeholder="70 00 00 00"
                  value={localPhone}
                  onChange={(e) => setLocalPhone(e.target.value)}
                  className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
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
                {BAMAKO_NEIGHBORHOODS.map((group) => (
                  <optgroup key={group.commune} label={group.commune}>
                    {group.quartiers.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </optgroup>
                ))}
                <option value="Autre quartier">Autre quartier</option>
              </select>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 active:scale-98 transition-all disabled:opacity-60"
            >
              <span>{isSubmitting ? 'Envoi du code...' : 'Recevoir mon code de vérification'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-xs text-slate-600 text-center">
              Code envoyé au <b className="font-mono">{otpPhone}</b>. Entrez-le ci-dessous pour prouver
              votre numéro et déposer votre dossier revendeur.
            </p>
            <input
              type="text"
              inputMode="numeric"
              required
              autoFocus
              maxLength={6}
              placeholder="• • • • • •"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              className="w-full py-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-2xl font-mono font-black tracking-[0.6em] text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />

            {formError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || otpCode.length < 6}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 active:scale-98 transition-all disabled:opacity-60"
            >
              <span>{isSubmitting ? 'Vérification...' : 'Valider mon dossier'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => { setStep('form'); setOtpCode(''); setFormError(''); }}
              className="w-full text-center text-[11px] font-semibold text-slate-400 hover:text-slate-600"
            >
              Modifier le numéro
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
