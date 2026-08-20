'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import DialCodePicker from '@/components/common/DialCodePicker';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import { DEFAULT_DIAL_CODE } from '@/lib/dial-codes';
import { DEFAULT_NEIGHBORHOOD } from '@/lib/bamako-neighborhoods';
import { ShieldCheck, ArrowRight, Gift } from 'lucide-react';

/**
 * Étape obligatoire après une inscription via Google (voir handleGoogleRegister
 * sur /register et handleGoogleJoin sur /reseller/join) : Google prouve
 * l'identité (email) mais ne connaît ni le numéro WhatsApp du revendeur, ni
 * son quartier — deux informations indispensables à l'activité. Cette page
 * les recueille avant le passage en /pending-approval. Le rôle est déjà fixé
 * (transmis à travers la redirection OAuth), donc rien à choisir ici.
 */
function CompleteProfileForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [phone, setPhone] = useState('');
  const [neighborhood, setNeighborhood] = useState(DEFAULT_NEIGHBORHOOD);
  const [momoProvider, setMomoProvider] = useState('');
  const [refCode, setRefCode] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFullName(params.get('fullName') || '');
    setRefCode(params.get('ref') || '');

    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .then((data) => {
        if (!data.authenticated) {
          router.replace('/register');
          return;
        }
        setCheckingSession(false);
      })
      .catch(() => router.replace('/register'));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!fullName.trim() || phone.replace(/\D/g, '').length < 6) {
      setFormError('Veuillez renseigner votre nom et un numéro de téléphone valide.');
      return;
    }

    const composedPhone = `${dialCode}${phone.replace(/\D/g, '')}`;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          phone: composedPhone,
          metadata: {
            neighborhood,
            ...(momoProvider ? { momoProvider, momoNumber: composedPhone } : {}),
            ...(refCode ? { referralSponsorCode: refCode } : {}),
          },
        }),
      });
      const json = await res.json();
      setIsSubmitting(false);
      if (!res.ok || !json.success) {
        setFormError(json.error || "Erreur lors de l'enregistrement de votre dossier.");
        return;
      }
      router.push('/pending-approval');
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      setFormError('Erreur réseau, réessayez.');
    }
  };

  if (checkingSession) {
    return <div className="p-10 text-center text-xs text-gray-400">Chargement...</div>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 w-full">
      <div className="text-center space-y-2 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-black text-gray-900">Dernière étape avant l&apos;activation</h1>
        <p className="text-xs text-gray-500 max-w-sm mx-auto">
          Votre compte Google est vérifié. Il ne manque plus que ces informations pour que
          l&apos;équipe Suguba puisse examiner et activer votre dossier revendeur.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-card space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Nom Complet :</label>
          <input
            type="text"
            required
            placeholder="Ex: Moussa Coulibaly"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Numéro WhatsApp (Ventes & Commissions) :</label>
          <div className="flex gap-2">
            <DialCodePicker value={dialCode} onChange={setDialCode} />
            <input
              type="tel"
              required
              placeholder="76 12 34 56"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="flex-1 min-w-0 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Quartier de Résidence à Bamako :</label>
          <NeighborhoodPicker value={neighborhood} onChange={setNeighborhood} />
        </div>

        {refCode && (
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Code de Parrainage :</label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-purple-50 border border-purple-200 rounded-xl">
              <Gift className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="text-xs font-mono font-black text-purple-900">{refCode}</span>
              <span className="ml-auto text-[10px] text-purple-400 font-semibold">Détecté automatiquement</span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Opérateur de Retrait des Commissions (Optionnel) :</label>
          <select
            value={momoProvider}
            onChange={(e) => setMomoProvider(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">À renseigner plus tard</option>
            <option value="Orange Money">Orange Money Mali (0% frais)</option>
            <option value="Wave">Wave Mali (0% frais)</option>
            <option value="Moov Money">Moov Money Mali</option>
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
          className="w-full py-3.5 bg-[#09b500] hover:bg-[#078000] disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-brand-md transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <span>{isSubmitting ? 'Enregistrement...' : 'Envoyer mon dossier'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8f5] font-sans">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<div className="p-10 text-center text-xs">Chargement...</div>}>
          <CompleteProfileForm />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
