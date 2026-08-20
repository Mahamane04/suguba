'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import BottomNav from '@/components/common/BottomNav';
import DialCodePicker from '@/components/common/DialCodePicker';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import { supabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import {
  Store, ShoppingBag, Truck, Globe, CheckCircle2,
  ArrowRight, ShieldCheck, Sparkles, Building2, MapPin,
  Smartphone, Wallet, FileText, UserPlus, Info, Check, ShieldAlert
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

export default function RegisterPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<'reseller' | 'supplier' | 'driver' | 'diaspora'>('reseller');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Corrige l'absence totale de vérification à l'inscription (numéro
  // jamais prouvé, profil actif instantanément) : avant de créer quoi que
  // ce soit, le numéro saisi doit être confirmé par OTP réel
  // (/api/auth/request-otp puis /api/auth/verify-otp), et le compte créé
  // naît "pending_approval" — voir /pending-approval et
  // /api/admin/review-profile pour la suite du parcours.
  const [otpPhase, setOtpPhase] = useState<'idle' | 'code-sent' | 'verifying'>('idle');
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');

  // ── Form States ──
  // Revendeur
  const [resellerForm, setResellerForm] = useState({
    fullName: '',
    dialCode: '+223',
    phone: '',
    neighborhood: 'Hamdallaye ACI 2000',
    momoProvider: 'Orange Money' as 'Orange Money' | 'Wave' | 'Moov Money',
    momoNumber: '',
    referralSponsorCode: '',
  });

  // Fournisseur
  const [supplierForm, setSupplierForm] = useState({
    companyName: '',
    managerName: '',
    dialCode: '+223',
    phone: '',
    warehouseAddress: '',
    warehouseNeighborhood: 'Grand Marché',
    category: 'Électronique & Énergie',
    rccmOrNif: '',
  });

  // Livreur
  const [driverForm, setDriverForm] = useState({
    fullName: '',
    dialCode: '+223',
    phone: '',
    vehicleType: 'Moto Jakarta Express',
    licensePlate: '',
    zone: 'Communes IV, V, VI (Bamako)',
    idDocumentNumber: '',
  });

  // Diaspora — indicatif France par défaut (profil type de la diaspora
  // malienne visée par ce formulaire), modifiable via le sélecteur.
  const [diasporaForm, setDiasporaForm] = useState({
    fullName: '',
    dialCode: '+33',
    phone: '',
    countryOfResidence: 'France 🇫🇷',
    currency: 'EUR' as 'EUR' | 'USD' | 'CAD' | 'GBP',
    beneficiaryNameInMali: '',
    beneficiaryPhoneInMali: '',
    beneficiaryNeighborhoodInMali: 'Kalaban-Coura',
  });

  // Compose l'indicatif choisi via DialCodePicker et le numéro local en un
  // E.164 propre pour /api/auth/request-otp — plus besoin de taper "+223"
  // à la main dans le champ numéro.
  const composePhone = (dialCode: string, local: string) => `${dialCode}${local.replace(/\D/g, '')}`;

  // Regroupe les champs propres au rôle sélectionné : nom à afficher,
  // téléphone à vérifier, et le reste en metadata pour complete-profile.
  const getActiveFormData = (): { fullName: string; phone: string; metadata: Record<string, unknown> } | null => {
    if (selectedRole === 'reseller') {
      if (!resellerForm.fullName || resellerForm.phone.replace(/\D/g, '').length < 6) return null;
      const phone = composePhone(resellerForm.dialCode, resellerForm.phone);
      return {
        fullName: resellerForm.fullName,
        phone,
        metadata: {
          neighborhood: resellerForm.neighborhood,
          momoProvider: resellerForm.momoProvider,
          momoNumber: resellerForm.momoNumber || phone,
          referralSponsorCode: resellerForm.referralSponsorCode,
        },
      };
    }
    if (selectedRole === 'supplier') {
      if (!supplierForm.companyName || !supplierForm.managerName || supplierForm.phone.replace(/\D/g, '').length < 6) return null;
      return {
        fullName: supplierForm.managerName,
        phone: composePhone(supplierForm.dialCode, supplierForm.phone),
        metadata: {
          companyName: supplierForm.companyName,
          warehouseAddress: supplierForm.warehouseAddress || 'Bamako',
          warehouseNeighborhood: supplierForm.warehouseNeighborhood,
          category: supplierForm.category,
          rccmOrNif: supplierForm.rccmOrNif,
        },
      };
    }
    if (selectedRole === 'driver') {
      if (!driverForm.fullName || driverForm.phone.replace(/\D/g, '').length < 6) return null;
      return {
        fullName: driverForm.fullName,
        phone: composePhone(driverForm.dialCode, driverForm.phone),
        metadata: {
          vehicleType: driverForm.vehicleType,
          licensePlate: driverForm.licensePlate,
          zone: driverForm.zone,
          idDocumentNumber: driverForm.idDocumentNumber,
        },
      };
    }
    if (selectedRole === 'diaspora') {
      if (!diasporaForm.fullName || diasporaForm.phone.replace(/\D/g, '').length < 6 || !diasporaForm.beneficiaryNameInMali) return null;
      return {
        fullName: diasporaForm.fullName,
        phone: composePhone(diasporaForm.dialCode, diasporaForm.phone),
        metadata: {
          countryOfResidence: diasporaForm.countryOfResidence,
          currency: diasporaForm.currency,
          beneficiaryNameInMali: diasporaForm.beneficiaryNameInMali,
          beneficiaryPhoneInMali: diasporaForm.beneficiaryPhoneInMali,
          beneficiaryNeighborhoodInMali: diasporaForm.beneficiaryNeighborhoodInMali,
        },
      };
    }
    return null;
  };

  // Étape 1 : valider les champs du formulaire puis envoyer le code OTP —
  // rien n'est encore créé côté serveur à ce stade.
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    const data = getActiveFormData();
    if (!data) {
      alert('Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    setIsSubmitting(true);
    const phone = data.phone;
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      setIsSubmitting(false);
      if (!res.ok || !json.success) {
        setRegisterError(json.error || "Erreur lors de l'envoi du code de vérification.");
        return;
      }
      setOtpPhone(phone);
      setOtpPhase('code-sent');
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      setRegisterError('Erreur réseau lors de l\'envoi du code.');
    }
  };

  // Étape 2 : le numéro est prouvé (OTP correct) → créer le compte
  // (pending_approval) puis compléter le profil avec les champs du
  // formulaire. Rien de tout ceci n'est actif avant validation admin.
  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = getActiveFormData();
    if (!data) return;

    setOtpPhase('verifying');
    setOtpError('');
    try {
      const verifyRes = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: otpPhone, code: otpCode, intendedRole: selectedRole }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson.success) {
        setOtpError(verifyJson.error || 'Code invalide.');
        setOtpPhase('code-sent');
        return;
      }

      const completeRes = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: data.fullName, metadata: data.metadata }),
      });
      if (!completeRes.ok) {
        console.warn('Profil créé mais le complément de dossier a échoué — à corriger plus tard depuis le tableau de bord.');
      }

      setSuccessMessage(
        selectedRole === 'reseller'
          ? 'Numéro vérifié ! Votre dossier revendeur est enregistré et en cours de validation par Suguba.'
          : selectedRole === 'supplier'
          ? 'Numéro vérifié ! Dossier Fournisseur déposé, en cours de validation par l\'équipe Suguba.'
          : selectedRole === 'driver'
          ? 'Numéro vérifié ! Candidature Livreur enregistrée, en attente d\'activation par le Super Admin.'
          : 'Numéro vérifié ! Votre dossier Diaspora est en cours de validation.'
      );
      setTimeout(() => router.push('/pending-approval'), 1800);
    } catch (err) {
      console.error(err);
      setOtpError('Erreur réseau lors de la vérification.');
      setOtpPhase('code-sent');
    }
  };

  // Inscription via Google : identité déjà vérifiée par Google (email +
  // nom), donc pas d'étape OTP à faire ici — /api/auth/supabase-exchange
  // crée directement le profil en pending_approval avec le rôle choisi sur
  // cette page (passé en query param à travers la redirection OAuth,
  // relu par /auth/callback). Les champs propres au métier (quartier,
  // opérateur Mobile Money, véhicule...) restent à compléter au premier
  // passage sur le tableau de bord — Google ne les connaît pas.
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
          
          {/* Tab 1: Revendeur */}
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

          {/* Tab 2: Fournisseur */}
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

          {/* Tab 3: Livreur */}
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
              <p className="text-[10px] text-gray-500">Courses rémunérées & OTP</p>
            </div>
          </button>

          {/* Tab 4: Diaspora */}
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

        {/* Inscription Google — mise en avant, chemin le plus rapide :
            l'identité est déjà vérifiée par Google, aucun OTP à taper. */}
        {otpPhase === 'idle' && (
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-card space-y-3">
            <button
              type="button"
              onClick={handleGoogleRegister}
              className="w-full py-3.5 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-800 font-bold rounded-2xl text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
            >
              <GoogleIcon className="w-5 h-5" />
              S&apos;inscrire avec Google — Sans code, sans mot de passe
            </button>
            {/* Revendeur : Google seulement — téléphone/quartier/parrainage
                se recueillent juste après (/register/complete), pas besoin
                d'un second chemin par OTP qui duplique les mêmes champs. */}
            {selectedRole !== 'reseller' && (
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-100" />
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">ou avec votre numéro</span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
            )}
          </div>
        )}

        {/* Success Alert Banner */}
        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {registerError && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
            <span>{registerError}</span>
          </div>
        )}

        {/* Registration Form Card — masqué pour Revendeur (Google seulement,
            voir plus haut) */}
        {selectedRole !== 'reseller' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-card">
          {otpPhase !== 'idle' ? (
            <form onSubmit={handleConfirmOtp} className="space-y-5">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="font-black text-gray-900">Vérifiez votre numéro</h2>
                <p className="text-xs text-gray-500">
                  Un code a été envoyé par SMS/WhatsApp au <b>{otpPhone}</b>. Cette étape prouve que ce numéro vous appartient avant toute création de compte.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 text-center">Code à 6 chiffres</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="• • • • • •"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full py-4 bg-gray-50 border border-gray-200 rounded-2xl text-center text-2xl font-mono font-black tracking-[0.4em] text-gray-900 focus:outline-none focus:ring-2 focus:ring-suguba-brand/30"
                />
              </div>

              {otpError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600 text-center">
                  {otpError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setOtpPhase('idle'); setOtpCode(''); setOtpError(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600 font-semibold"
                >
                  ← Modifier mes informations
                </button>
                <button
                  type="submit"
                  disabled={otpPhase === 'verifying' || otpCode.length < 4}
                  className="w-full sm:w-auto px-7 py-3 bg-[#09b500] hover:bg-[#078000] disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-brand-md transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>{otpPhase === 'verifying' ? 'Vérification...' : 'Confirmer & Créer mon Compte'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
          <form onSubmit={handleRegister} className="space-y-5">

            {/* FORM 1 (Revendeur) supprimée : ce rôle passe désormais
                uniquement par Google (voir plus haut) — ce bloc n'est plus
                jamais atteignable, selectedRole ne peut pas valoir
                'reseller' ici (voir la garde {selectedRole !== 'reseller'}
                sur la carte englobante). */}

            {/* ── FORM 2: FOURNISSEUR ── */}
            {selectedRole === 'supplier' && (
              <div className="space-y-4">
                <div className="border-b border-gray-100 pb-3">
                  <h2 className="font-black text-base text-gray-900 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                    <span>Dossier d&apos;Enregistrement Fournisseur</span>
                  </h2>
                  <p className="text-xs text-gray-500">Distribuez vos marchandises via notre réseau de revendeurs certifiés.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nom de l&apos;Entreprise / Boutique :</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Diarra Électronique Bamako"
                      value={supplierForm.companyName}
                      onChange={(e) => setSupplierForm({ ...supplierForm, companyName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nom & Prénom du Gérant :</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Ibrahim Diarra"
                      value={supplierForm.managerName}
                      onChange={(e) => setSupplierForm({ ...supplierForm, managerName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Téléphone de Contact Principal :</label>
                    <div className="flex gap-2">
                      <DialCodePicker
                        value={supplierForm.dialCode}
                        onChange={(dialCode) => setSupplierForm({ ...supplierForm, dialCode })}
                      />
                      <input
                        type="tel"
                        required
                        placeholder="76 12 34 56"
                        value={supplierForm.phone}
                        onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                        className="flex-1 min-w-0 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Catégorie Principale de Produits :</label>
                    <select
                      value={supplierForm.category}
                      onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Électronique & Énergie">Électronique & Énergie</option>
                      <option value="Électroménager & Maison">Électroménager & Maison</option>
                      <option value="Solaire & Groupes">Solaire & Groupes Électrogènes</option>
                      <option value="Smartphones & Informatique">Smartphones & Informatique</option>
                      <option value="Mode & Beauté">Mode & Beauté</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Quartier de l&apos;Entrepôt / Magasin :</label>
                    <NeighborhoodPicker
                      value={supplierForm.warehouseNeighborhood}
                      onChange={(warehouseNeighborhood) => setSupplierForm({ ...supplierForm, warehouseNeighborhood })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">N° RCCM / NIF (Optionnel) :</label>
                    <input
                      type="text"
                      placeholder="Ex: MA.BKO.2024.A.1234"
                      value={supplierForm.rccmOrNif}
                      onChange={(e) => setSupplierForm({ ...supplierForm, rccmOrNif: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── FORM 3: LIVREUR ── */}
            {selectedRole === 'driver' && (
              <div className="space-y-4">
                <div className="border-b border-gray-100 pb-3">
                  <h2 className="font-black text-base text-gray-900 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-amber-600" />
                    <span>Candidature Livreur Partenaire</span>
                  </h2>
                  <p className="text-xs text-gray-500">Livrez les colis à Bamako avec validation par OTP et encaissez vos courses.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nom Complet :</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Amadou Traoré"
                      value={driverForm.fullName}
                      onChange={(e) => setDriverForm({ ...driverForm, fullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Numéro de Téléphone :</label>
                    <div className="flex gap-2">
                      <DialCodePicker
                        value={driverForm.dialCode}
                        onChange={(dialCode) => setDriverForm({ ...driverForm, dialCode })}
                      />
                      <input
                        type="tel"
                        required
                        placeholder="74 88 99 00"
                        value={driverForm.phone}
                        onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                        className="flex-1 min-w-0 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Type d&apos;Engin / Véhicule :</label>
                    <select
                      value={driverForm.vehicleType}
                      onChange={(e) => setDriverForm({ ...driverForm, vehicleType: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Moto Sanili / Jakarta 125">Moto Sanili / Jakarta 125cc</option>
                      <option value="Tricycle Moto">Tricycle Moto (Gros colis)</option>
                      <option value="Voiture / Camionnette">Voiture / Camionnette</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Numéro d&apos;Immatriculation :</label>
                    <input
                      type="text"
                      placeholder="Ex: BA-4821-MD"
                      value={driverForm.licensePlate}
                      onChange={(e) => setDriverForm({ ...driverForm, licensePlate: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Zone(s) Principale(s) d&apos;Intervention :</label>
                    <input
                      type="text"
                      placeholder="Ex: Communes IV, V, VI (ACI 2000, Faladié, Kalaban Coura...)"
                      value={driverForm.zone}
                      onChange={(e) => setDriverForm({ ...driverForm, zone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── FORM 4: DIASPORA ── */}
            {selectedRole === 'diaspora' && (
              <div className="space-y-4">
                <div className="border-b border-gray-100 pb-3">
                  <h2 className="font-black text-base text-gray-900 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-purple-600" />
                    <span>Espace Membre Diaspora</span>
                  </h2>
                  <p className="text-xs text-gray-500">Payez en ligne en €/$ et faites livrer des équipements vérifiés à votre famille au Mali.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Votre Nom Complet :</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Sekou Traoré"
                      value={diasporaForm.fullName}
                      onChange={(e) => setDiasporaForm({ ...diasporaForm, fullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Votre Numéro International (WhatsApp) :</label>
                    <div className="flex gap-2">
                      <DialCodePicker
                        value={diasporaForm.dialCode}
                        onChange={(dialCode) => setDiasporaForm({ ...diasporaForm, dialCode })}
                      />
                      <input
                        type="tel"
                        required
                        placeholder="6 12 34 56 78"
                        value={diasporaForm.phone}
                        onChange={(e) => setDiasporaForm({ ...diasporaForm, phone: e.target.value })}
                        className="flex-1 min-w-0 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Pays de Résidence :</label>
                    <select
                      value={diasporaForm.countryOfResidence}
                      onChange={(e) => setDiasporaForm({ ...diasporaForm, countryOfResidence: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="France 🇫🇷">France 🇫🇷</option>
                      <option value="États-Unis 🇺🇸">États-Unis 🇺🇸</option>
                      <option value="Canada 🇨🇦">Canada 🇨🇦</option>
                      <option value="Côte d'Ivoire 🇨🇮">Côte d&apos;Ivoire 🇨🇮</option>
                      <option value="Sénégal 🇸🇳">Sénégal 🇸🇳</option>
                      <option value="Espagne 🇪🇸">Espagne 🇪🇸</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Devise de Facturation Préférée :</label>
                    <select
                      value={diasporaForm.currency}
                      onChange={(e) => setDiasporaForm({ ...diasporaForm, currency: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="EUR">Euros (€ EUR - Taux BCEAO 655.957 F)</option>
                      <option value="USD">Dollars ($ USD)</option>
                      <option value="CAD">Dollars Canadiens ($ CAD)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nom du Bénéficiaire à Bamako :</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Fatoumata Traoré (Mère)"
                      value={diasporaForm.beneficiaryNameInMali}
                      onChange={(e) => setDiasporaForm({ ...diasporaForm, beneficiaryNameInMali: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Téléphone Bénéficiaire à Bamako :</label>
                    <input
                      type="tel"
                      required
                      placeholder="Ex: +223 76 99 88 77"
                      value={diasporaForm.beneficiaryPhoneInMali}
                      onChange={(e) => setDiasporaForm({ ...diasporaForm, beneficiaryPhoneInMali: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[11px] text-gray-400 text-center sm:text-left">
                En créant un compte, vous acceptez les <Link href="/legal/terms" className="text-suguba-brand underline">Conditions Générales</Link> Suguba.
              </p>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-7 py-3 bg-[#09b500] hover:bg-[#078000] text-white rounded-xl text-xs font-black shadow-brand-md transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <span>{isSubmitting ? 'Envoi du code...' : 'Vérifier mon numéro'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </form>
          )}
        </div>
        )}

        {/* Bottom Login Link */}
        <div className="text-center text-xs text-gray-500">
          Vous avez déjà un compte ?{' '}
          <Link href="/login" className="font-bold text-suguba-brand hover:underline">
            Se connecter par OTP
          </Link>
        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
