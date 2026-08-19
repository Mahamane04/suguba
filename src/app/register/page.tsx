'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import BottomNav from '@/components/common/BottomNav';
import { sugubaStore } from '@/lib/store';
import { UserRole } from '@/types';
import {
  Store, ShoppingBag, Truck, Globe, CheckCircle2,
  ArrowRight, ShieldCheck, Sparkles, Building2, MapPin,
  Smartphone, Wallet, FileText, UserPlus, Info, Check
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<'reseller' | 'supplier' | 'driver' | 'diaspora'>('reseller');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Form States ──
  // Revendeur
  const [resellerForm, setResellerForm] = useState({
    fullName: '',
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
    phone: '',
    warehouseAddress: '',
    warehouseNeighborhood: 'Grand Marché',
    category: 'Électronique & Énergie',
    rccmOrNif: '',
  });

  // Livreur
  const [driverForm, setDriverForm] = useState({
    fullName: '',
    phone: '',
    vehicleType: 'Moto Jakarta Express',
    licensePlate: '',
    zone: 'Communes IV, V, VI (Bamako)',
    idDocumentNumber: '',
  });

  // Diaspora
  const [diasporaForm, setDiasporaForm] = useState({
    fullName: '',
    phone: '',
    countryOfResidence: 'France 🇫🇷',
    currency: 'EUR' as 'EUR' | 'USD' | 'CAD' | 'GBP',
    beneficiaryNameInMali: '',
    beneficiaryPhoneInMali: '',
    beneficiaryNeighborhoodInMali: 'Kalaban Coura (Bamako)',
  });

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (selectedRole === 'reseller') {
        if (!resellerForm.fullName || !resellerForm.phone) {
          alert('Veuillez renseigner votre nom complet et votre numéro de téléphone.');
          setIsSubmitting(false);
          return;
        }
        const res = sugubaStore.registerReseller({
          fullName: resellerForm.fullName,
          phone: resellerForm.phone,
          neighborhood: resellerForm.neighborhood,
          momoProvider: resellerForm.momoProvider,
          momoNumber: resellerForm.momoNumber || resellerForm.phone,
          referralSponsorCode: resellerForm.referralSponsorCode,
        });
        setSuccessMessage(`Compte Revendeur activé avec succès ! Votre code affilié : ${res.reseller.referralCode}`);
        setTimeout(() => router.push('/reseller'), 1500);

      } else if (selectedRole === 'supplier') {
        if (!supplierForm.companyName || !supplierForm.managerName || !supplierForm.phone) {
          alert('Veuillez renseigner le nom de l\'entreprise, le nom du gérant et le numéro de contact.');
          setIsSubmitting(false);
          return;
        }
        sugubaStore.registerSupplier({
          companyName: supplierForm.companyName,
          managerName: supplierForm.managerName,
          phone: supplierForm.phone,
          warehouseAddress: supplierForm.warehouseAddress || 'Bamako',
          warehouseNeighborhood: supplierForm.warehouseNeighborhood,
          category: supplierForm.category,
          rccmOrNif: supplierForm.rccmOrNif,
        });
        setSuccessMessage('Dossier Fournisseur déposé avec succès ! En cours de validation par l\'équipe Suguba.');
        setTimeout(() => router.push('/supplier'), 1800);

      } else if (selectedRole === 'driver') {
        if (!driverForm.fullName || !driverForm.phone) {
          alert('Veuillez renseigner votre nom et votre numéro de téléphone.');
          setIsSubmitting(false);
          return;
        }
        sugubaStore.registerDriver({
          fullName: driverForm.fullName,
          phone: driverForm.phone,
          vehicleType: driverForm.vehicleType,
          licensePlate: driverForm.licensePlate,
          zone: driverForm.zone,
          idDocumentNumber: driverForm.idDocumentNumber,
        });
        setSuccessMessage('Candidature Livreur enregistrée avec succès ! En attente d\'activation par le Super Admin.');
        setTimeout(() => router.push('/driver'), 1800);

      } else if (selectedRole === 'diaspora') {
        if (!diasporaForm.fullName || !diasporaForm.phone || !diasporaForm.beneficiaryNameInMali) {
          alert('Veuillez renseigner vos coordonnées et celles de votre bénéficiaire au Mali.');
          setIsSubmitting(false);
          return;
        }
        sugubaStore.registerDiaspora({
          fullName: diasporaForm.fullName,
          phone: diasporaForm.phone,
          countryOfResidence: diasporaForm.countryOfResidence,
          currency: diasporaForm.currency,
          beneficiaryNameInMali: diasporaForm.beneficiaryNameInMali,
          beneficiaryPhoneInMali: diasporaForm.beneficiaryPhoneInMali,
          beneficiaryNeighborhoodInMali: diasporaForm.beneficiaryNeighborhoodInMali,
        });
        setSuccessMessage('Compte Diaspora créé avec succès ! Accès direct au catalogue sécurisé.');
        setTimeout(() => router.push('/diaspora'), 1500);
      }
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
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

        {/* Success Alert Banner */}
        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Registration Form Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-card">
          <form onSubmit={handleRegister} className="space-y-5">
            
            {/* ── FORM 1: REVENDEUR ── */}
            {selectedRole === 'reseller' && (
              <div className="space-y-4">
                <div className="border-b border-gray-100 pb-3">
                  <h2 className="font-black text-base text-gray-900 flex items-center gap-2">
                    <Store className="w-4 h-4 text-emerald-600" />
                    <span>Informations Revendeur Indépendant</span>
                  </h2>
                  <p className="text-xs text-gray-500">Gagnez jusqu&apos;à 14% de commission par vente sans investir dans le stock.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nom Complet :</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Moussa Coulibaly"
                      value={resellerForm.fullName}
                      onChange={(e) => setResellerForm({ ...resellerForm, fullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Numéro WhatsApp (Ventes & OTP) :</label>
                    <input
                      type="tel"
                      required
                      placeholder="Ex: +223 76 12 34 56"
                      value={resellerForm.phone}
                      onChange={(e) => setResellerForm({ ...resellerForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Quartier de Résidence à Bamako :</label>
                    <input
                      type="text"
                      placeholder="Ex: Hamdallaye ACI 2000, Badalabougou..."
                      value={resellerForm.neighborhood}
                      onChange={(e) => setResellerForm({ ...resellerForm, neighborhood: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Opérateur de Retrait des Commissions :</label>
                    <select
                      value={resellerForm.momoProvider}
                      onChange={(e) => setResellerForm({ ...resellerForm, momoProvider: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Orange Money">Orange Money Mali (0% frais)</option>
                      <option value="Wave">Wave Mali (0% frais)</option>
                      <option value="Moov Money">Moov Money Mali</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Code de Parrainage (Optionnel) :</label>
                    <input
                      type="text"
                      placeholder="Ex: PARRAIN100"
                      value={resellerForm.referralSponsorCode}
                      onChange={(e) => setResellerForm({ ...resellerForm, referralSponsorCode: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Si vous avez été invité par un ambassadeur Suguba.</p>
                  </div>
                </div>
              </div>
            )}

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
                    <input
                      type="tel"
                      required
                      placeholder="Ex: +223 76 12 34 56"
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
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
                    <input
                      type="text"
                      placeholder="Ex: Grand Marché, Sotuba, ACI 2000..."
                      value={supplierForm.warehouseNeighborhood}
                      onChange={(e) => setSupplierForm({ ...supplierForm, warehouseNeighborhood: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <input
                      type="tel"
                      required
                      placeholder="Ex: +223 74 88 99 00"
                      value={driverForm.phone}
                      onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
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
                    <input
                      type="tel"
                      required
                      placeholder="Ex: +33 6 12 34 56 78"
                      value={diasporaForm.phone}
                      onChange={(e) => setDiasporaForm({ ...diasporaForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
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
                <span>{isSubmitting ? 'Traitement en cours...' : 'Valider & Créer mon Compte'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </form>
        </div>

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
