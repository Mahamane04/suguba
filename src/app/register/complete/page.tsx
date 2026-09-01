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

type Role = 'reseller' | 'supplier' | 'driver' | 'diaspora' | string;

/**
 * Étape obligatoire après une inscription via Google (voir /register) :
 * Google prouve l'identité (email) mais ne connaît ni le numéro WhatsApp, ni
 * les informations propres au métier (entreprise, véhicule, bénéficiaire...).
 * Cette page les recueille avant le passage en /pending-approval. Le rôle
 * est déjà fixé (transmis à travers la redirection OAuth), donc rien à
 * choisir ici — seuls les champs affichés changent selon le rôle.
 *
 * Devenue commune aux 4 rôles le 2026-08-26 quand le téléphone/OTP maison a
 * été retiré de l'inscription (aucune passerelle SMS réelle n'était
 * branchée) : Google est désormais le seul chemin d'inscription, donc cette
 * page est le seul endroit où un fournisseur/livreur/diaspora peut renseigner
 * son dossier, pas seulement le revendeur comme avant.
 */
function CompleteProfileForm() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState('');
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [phone, setPhone] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Champs Revendeur
  const [neighborhood, setNeighborhood] = useState(DEFAULT_NEIGHBORHOOD);
  const [momoProvider, setMomoProvider] = useState('');
  const [refCode, setRefCode] = useState('');

  // Champs Fournisseur
  const [companyName, setCompanyName] = useState('');
  const [warehouseAddress, setWarehouseAddress] = useState('');
  const [warehouseNeighborhood, setWarehouseNeighborhood] = useState(DEFAULT_NEIGHBORHOOD);
  const [category, setCategory] = useState('Électronique & Énergie');
  const [rccmOrNif, setRccmOrNif] = useState('');

  // Champs Livreur
  const [vehicleType, setVehicleType] = useState('Moto Jakarta Express');
  const [licensePlate, setLicensePlate] = useState('');
  const [zone, setZone] = useState('Communes IV, V, VI (Bamako)');
  const [idDocumentNumber, setIdDocumentNumber] = useState('');

  // Champs Diaspora
  const [countryOfResidence, setCountryOfResidence] = useState('France 🇫🇷');
  const [currency, setCurrency] = useState<'EUR' | 'USD' | 'CAD' | 'GBP'>('EUR');
  const [beneficiaryNameInMali, setBeneficiaryNameInMali] = useState('');
  const [beneficiaryPhoneInMali, setBeneficiaryPhoneInMali] = useState('');
  const [beneficiaryNeighborhoodInMali, setBeneficiaryNeighborhoodInMali] = useState(DEFAULT_NEIGHBORHOOD);

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
        setRole(data.role);
        setCheckingSession(false);
      })
      .catch(() => router.replace('/register'));
  }, [router]);

  const buildMetadata = (): Record<string, unknown> => {
    if (role === 'supplier') {
      return {
        companyName,
        warehouseAddress: warehouseAddress || 'Bamako',
        warehouseNeighborhood,
        category,
        rccmOrNif,
      };
    }
    if (role === 'driver') {
      return { vehicleType, licensePlate, zone, idDocumentNumber };
    }
    if (role === 'diaspora') {
      return {
        countryOfResidence, currency,
        beneficiaryNameInMali, beneficiaryPhoneInMali, beneficiaryNeighborhoodInMali,
      };
    }
    return {
      neighborhood,
      ...(momoProvider ? { momoProvider, momoNumber: `${dialCode}${phone.replace(/\D/g, '')}` } : {}),
      ...(refCode ? { referralSponsorCode: refCode } : {}),
    };
  };

  const missingRequired = (): boolean => {
    if (!fullName.trim() || phone.replace(/\D/g, '').length < 6) return true;
    if (role === 'supplier' && !companyName.trim()) return true;
    if (role === 'diaspora' && !beneficiaryNameInMali.trim()) return true;
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (missingRequired()) {
      setFormError('Veuillez renseigner les champs obligatoires.');
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
          metadata: buildMetadata(),
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

  const roleLabel: Record<string, string> = {
    reseller: 'revendeur', supplier: 'fournisseur', driver: 'livreur', diaspora: 'diaspora',
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 w-full">
      <div className="text-center space-y-2 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-black text-gray-900">Dernière étape avant l&apos;activation</h1>
        <p className="text-xs text-gray-500 max-w-sm mx-auto">
          Votre compte Google est vérifié. Il ne manque plus que ces informations pour que
          l&apos;équipe Suguba puisse examiner et activer votre dossier {roleLabel[role || ''] || ''}.
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
          <label className="block text-xs font-bold text-gray-700 mb-1">Numéro WhatsApp (contact) :</label>
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

        {/* ── Revendeur ── */}
        {role === 'reseller' && (
          <>
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
          </>
        )}

        {/* ── Fournisseur ── */}
        {role === 'supplier' && (
          <>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Nom de l&apos;Entreprise / Boutique :</label>
              <input
                type="text"
                required
                placeholder="Ex: Diarra Électronique Bamako"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Catégorie Principale de Produits :</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
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
              <NeighborhoodPicker value={warehouseNeighborhood} onChange={setWarehouseNeighborhood} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Adresse précise de l&apos;entrepôt :</label>
              <input
                type="text"
                placeholder="Ex: Rue 12, Porte 45"
                value={warehouseAddress}
                onChange={(e) => setWarehouseAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">N° RCCM / NIF (Optionnel) :</label>
              <input
                type="text"
                placeholder="Ex: MA.BKO.2024.A.1234"
                value={rccmOrNif}
                onChange={(e) => setRccmOrNif(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}

        {/* ── Livreur ── */}
        {role === 'driver' && (
          <>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Type d&apos;Engin / Véhicule :</label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
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
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Zone(s) Principale(s) d&apos;Intervention :</label>
              <input
                type="text"
                placeholder="Ex: Communes IV, V, VI"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">N° Pièce d&apos;identité (Optionnel) :</label>
              <input
                type="text"
                value={idDocumentNumber}
                onChange={(e) => setIdDocumentNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </>
        )}

        {/* ── Diaspora ── */}
        {role === 'diaspora' && (
          <>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Pays de Résidence :</label>
              <select
                value={countryOfResidence}
                onChange={(e) => setCountryOfResidence(e.target.value)}
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
                value={currency}
                onChange={(e) => setCurrency(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="EUR">Euros (€ EUR)</option>
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
                value={beneficiaryNameInMali}
                onChange={(e) => setBeneficiaryNameInMali(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Téléphone Bénéficiaire à Bamako :</label>
              <input
                type="tel"
                required
                placeholder="Ex: +223 76 99 88 77"
                value={beneficiaryPhoneInMali}
                onChange={(e) => setBeneficiaryPhoneInMali(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Quartier du Bénéficiaire :</label>
              <NeighborhoodPicker value={beneficiaryNeighborhoodInMali} onChange={setBeneficiaryNeighborhoodInMali} />
            </div>
          </>
        )}

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
