'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import DialCodePicker from '@/components/common/DialCodePicker';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import EtapesInscription from '@/components/common/EtapesInscription';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { DEFAULT_DIAL_CODE } from '@/lib/dial-codes';
import { DEFAULT_NEIGHBORHOOD } from '@/lib/bamako-neighborhoods';
import { ArrowRight, Gift, Store, ShoppingBag, Truck, Globe, ShoppingCart, Check } from 'lucide-react';

type Role = 'reseller' | 'supplier' | 'driver' | 'diaspora';

const ROLES: { cle: Role; titre: string; detail: string; icone: React.ElementType }[] = [
  { cle: 'reseller', titre: 'Revendeur', detail: 'Je partage des produits et je touche une commission', icone: Store },
  { cle: 'supplier', titre: 'Fournisseur', detail: 'J\'ai un stock et je veux le vendre via Suguba', icone: ShoppingBag },
  { cle: 'driver', titre: 'Livreur', detail: 'Je livre les commandes à Bamako', icone: Truck },
  { cle: 'diaspora', titre: 'Diaspora', detail: 'Je commande depuis l\'étranger pour mes proches', icone: Globe },
];

const DESTINATION: Record<string, string> = {
  reseller: '/reseller', supplier: '/supplier', driver: '/driver', diaspora: '/diaspora', admin: '/admin',
};

const estRole = (v: unknown): v is Role => ROLES.some((r) => r.cle === v);

/**
 * Finalisation de l'inscription — étape obligatoire entre la preuve d'identité
 * (Google ou lien email) et l'accès à l'espace.
 *
 * Reconstruite le 2026-09-10. Deux défauts faisaient qu'on n'y passait plus :
 *  - /login créait un compte « revendeur » par défaut pour toute adresse
 *    inconnue, sans rien demander ;
 *  - /auth/callback n'envoyait ici que les comptes « non actifs », alors que
 *    tous naissent actifs.
 *
 * Deux cas d'arrivée :
 *  - « nouveau » : identité prouvée, mais aucun compte Suguba (connexion depuis
 *    /login). Le compte n'est créé qu'à l'envoi, avec le rôle choisi ici ;
 *  - « existant » : compte créé mais jamais complété (aucun numéro). Le rôle
 *    reste modifiable — le serveur ne l'accepte que tant qu'aucun numéro n'est
 *    enregistré (voir /api/auth/complete-profile).
 */
function FinaliserInscription() {
  const router = useRouter();
  const [mode, setMode] = useState<'chargement' | 'nouveau' | 'existant'>('chargement');
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState('');
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Revendeur
  const [neighborhood, setNeighborhood] = useState(DEFAULT_NEIGHBORHOOD);
  const [refCode, setRefCode] = useState('');
  // Fournisseur
  const [companyName, setCompanyName] = useState('');
  const [warehouseNeighborhood, setWarehouseNeighborhood] = useState(DEFAULT_NEIGHBORHOOD);
  const [category, setCategory] = useState('Électronique & Énergie');
  const [rccmOrNif, setRccmOrNif] = useState('');
  // Livreur
  const [vehicleType, setVehicleType] = useState('Moto Sanili / Jakarta 125');
  const [licensePlate, setLicensePlate] = useState('');
  const [zone, setZone] = useState('');
  const [idDocumentNumber, setIdDocumentNumber] = useState('');
  // Diaspora
  const [countryOfResidence, setCountryOfResidence] = useState('France');
  const [currency, setCurrency] = useState<'EUR' | 'USD' | 'CAD'>('EUR');
  const [beneficiaryNameInMali, setBeneficiaryNameInMali] = useState('');
  const [beneficiaryPhoneInMali, setBeneficiaryPhoneInMali] = useState('');
  const [beneficiaryNeighborhoodInMali, setBeneficiaryNeighborhoodInMali] = useState(DEFAULT_NEIGHBORHOOD);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFullName(params.get('fullName') || '');
    setRefCode(params.get('ref') || '');
    const roleUrl = params.get('intendedRole');

    (async () => {
      const me = await fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (me?.authenticated) {
        if (me.role === 'admin') { router.replace('/admin'); return; }
        setRole(estRole(me.role) ? me.role : null);
        setMode('existant');
        return;
      }
      // Pas de compte Suguba : il faut au moins une identité prouvée.
      const { data } = (await supabase?.auth.getSession()) || { data: { session: null } };
      if (!data.session) { router.replace('/register'); return; }
      const meta = data.session.user.user_metadata || {};
      setFullName((f) => f || meta.full_name || meta.name || '');
      setRole(estRole(roleUrl) ? roleUrl : null);
      setMode('nouveau');
    })();
  }, [router]);

  const buildMetadata = (): Record<string, unknown> => {
    if (role === 'supplier') {
      return { companyName, warehouseAddress: 'Bamako', warehouseNeighborhood, category, rccmOrNif };
    }
    if (role === 'driver') return { vehicleType, licensePlate, zone, idDocumentNumber };
    if (role === 'diaspora') {
      return { countryOfResidence, currency, beneficiaryNameInMali, beneficiaryPhoneInMali, beneficiaryNeighborhoodInMali };
    }
    return { neighborhood, ...(refCode ? { referralSponsorCode: refCode } : {}) };
  };

  const champManquant = (): string | null => {
    if (!role) return 'Choisissez votre profil.';
    if (!fullName.trim()) return 'Indiquez votre nom.';
    if (phone.replace(/\D/g, '').length < 8) return 'Indiquez un numéro WhatsApp valide.';
    if (role === 'supplier' && !companyName.trim()) return 'Indiquez le nom de votre entreprise ou boutique.';
    if (role === 'driver' && !zone.trim()) return 'Indiquez votre zone de livraison.';
    if (role === 'diaspora' && (!beneficiaryNameInMali.trim() || !beneficiaryPhoneInMali.trim())) {
      return 'Indiquez le nom et le numéro de votre proche au Mali.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const manque = champManquant();
    if (manque) { setFormError(manque); return; }

    setIsSubmitting(true);
    try {
      // Cas « nouveau » : le compte n'existe pas encore. On le crée maintenant,
      // avec le rôle choisi — c'est cet appel qui pose la session Suguba.
      if (mode === 'nouveau') {
        const { data } = (await supabase?.auth.getSession()) || { data: { session: null } };
        if (!data.session) { router.replace('/register'); return; }
        const res = await fetch('/api/auth/supabase-exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
          body: JSON.stringify({ intendedRole: role }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setFormError(json.error || 'Impossible de créer votre compte. Réessayez.');
          setIsSubmitting(false);
          return;
        }
      }

      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          fullName: fullName.trim(),
          phone: `${dialCode}${phone.replace(/\D/g, '')}`,
          metadata: buildMetadata(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setFormError(json.error || "Erreur lors de l'enregistrement.");
        setIsSubmitting(false);
        return;
      }
      // Rechargement complet : le Header relit la nouvelle session.
      window.location.href = DESTINATION[json.role] || '/';
    } catch {
      setFormError('Erreur réseau, réessayez.');
      setIsSubmitting(false);
    }
  };

  if (mode === 'chargement') {
    return <div className="p-10 text-center text-sm text-slate-500">Chargement…</div>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
      <EtapesInscription etapeActuelle={2} />

      <div className="text-center space-y-1">
        <h1 className="text-xl font-black text-slate-900">Finalisez votre inscription</h1>
        <p className="text-sm text-slate-500">Votre identité est vérifiée. Encore une minute et vous êtes dans votre espace.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Qui êtes-vous ? */}
        <section className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
          <h2 className="font-black text-sm text-slate-900">1. Vous êtes…</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLES.map(({ cle, titre, detail, icone: Icone }) => {
              const choisi = role === cle;
              return (
                <button
                  key={cle}
                  type="button"
                  onClick={() => setRole(cle)}
                  aria-pressed={choisi}
                  className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                    choisi ? 'border-suguba-brand bg-suguba-brand/5 ring-2 ring-suguba-brand/30' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${choisi ? 'bg-suguba-brand text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {choisi ? <Check className="w-4 h-4" /> : <Icone className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900">{titre}</p>
                    <p className="text-[11px] text-slate-500 leading-snug">{detail}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <Link href="/" className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 text-[11px] text-slate-600 hover:bg-slate-100">
            <ShoppingCart className="w-4 h-4 shrink-0" />
            <span><strong>Vous voulez seulement acheter ?</strong> Pas besoin de compte : commandez directement depuis le catalogue.</span>
          </Link>
        </section>

        {/* 2. Coordonnées */}
        {role && (
          <section className="bg-white rounded-3xl p-5 border border-slate-200 space-y-4">
            <h2 className="font-black text-sm text-slate-900">2. Vos coordonnées</h2>
            <Champ label="Nom complet">
              <input type="text" required placeholder="Ex : Moussa Coulibaly" value={fullName}
                onChange={(e) => setFullName(e.target.value)} className={INPUT} />
            </Champ>
            <Champ label="Numéro WhatsApp" aide="Pour vous prévenir de vos commandes et de vos gains.">
              <div className="flex gap-2">
                <DialCodePicker value={dialCode} onChange={setDialCode} />
                <input type="tel" required placeholder="76 12 34 56" value={phone}
                  onChange={(e) => setPhone(e.target.value)} className={`${INPUT} flex-1 min-w-0 font-mono`} />
              </div>
            </Champ>

            {role === 'reseller' && (
              <>
                <Champ label="Votre quartier à Bamako">
                  <NeighborhoodPicker value={neighborhood} onChange={setNeighborhood} />
                </Champ>
                {refCode && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <Gift className="w-4 h-4 text-suguba-brand shrink-0" />
                    <span>Invité par <strong className="font-mono">{refCode}</strong></span>
                  </div>
                )}
              </>
            )}

            {role === 'supplier' && (
              <>
                <Champ label="Nom de l'entreprise ou de la boutique">
                  <input type="text" required placeholder="Ex : Diarra Électronique" value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)} className={INPUT} />
                </Champ>
                <Champ label="Catégorie principale">
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT}>
                    <option>Électronique & Énergie</option>
                    <option>Électroménager & Maison</option>
                    <option>Solaire & Groupes</option>
                    <option>Smartphones & Informatique</option>
                    <option>Mode & Beauté</option>
                  </select>
                </Champ>
                <Champ label="Quartier de l'entrepôt ou du magasin">
                  <NeighborhoodPicker value={warehouseNeighborhood} onChange={setWarehouseNeighborhood} />
                </Champ>
                <Champ label="N° RCCM / NIF (facultatif)">
                  <input type="text" value={rccmOrNif} onChange={(e) => setRccmOrNif(e.target.value)} className={INPUT} />
                </Champ>
              </>
            )}

            {role === 'driver' && (
              <>
                <Champ label="Véhicule">
                  <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={INPUT}>
                    <option value="Moto Sanili / Jakarta 125">Moto (Sanili / Jakarta 125)</option>
                    <option value="Tricycle Moto">Tricycle (gros colis)</option>
                    <option value="Voiture / Camionnette">Voiture / camionnette</option>
                  </select>
                </Champ>
                <Champ label="Zone de livraison">
                  <input type="text" required placeholder="Ex : Communes IV, V, VI" value={zone}
                    onChange={(e) => setZone(e.target.value)} className={INPUT} />
                </Champ>
                <Champ label="Immatriculation (facultatif)">
                  <input type="text" placeholder="Ex : BA-4821-MD" value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)} className={INPUT} />
                </Champ>
                <Champ label="N° de pièce d'identité (facultatif)">
                  <input type="text" value={idDocumentNumber} onChange={(e) => setIdDocumentNumber(e.target.value)} className={INPUT} />
                </Champ>
                <p className="text-[11px] text-slate-500">
                  Avant votre première course, un agent Suguba vérifie vos papiers et votre engin au guichet de Bamako.
                </p>
              </>
            )}

            {role === 'diaspora' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Champ label="Pays de résidence">
                    <select value={countryOfResidence} onChange={(e) => setCountryOfResidence(e.target.value)} className={INPUT}>
                      {['France', 'États-Unis', 'Canada', 'Espagne', 'Côte d\'Ivoire', 'Sénégal', 'Autre'].map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </Champ>
                  <Champ label="Devise">
                    <select value={currency} onChange={(e) => setCurrency(e.target.value as 'EUR' | 'USD' | 'CAD')} className={INPUT}>
                      <option value="EUR">Euro (€)</option>
                      <option value="USD">Dollar ($)</option>
                      <option value="CAD">Dollar canadien</option>
                    </select>
                  </Champ>
                </div>
                <Champ label="Nom de votre proche au Mali">
                  <input type="text" required placeholder="Ex : Fatoumata Traoré" value={beneficiaryNameInMali}
                    onChange={(e) => setBeneficiaryNameInMali(e.target.value)} className={INPUT} />
                </Champ>
                <Champ label="Son numéro">
                  <input type="tel" required placeholder="Ex : +223 76 99 88 77" value={beneficiaryPhoneInMali}
                    onChange={(e) => setBeneficiaryPhoneInMali(e.target.value)} className={`${INPUT} font-mono`} />
                </Champ>
                <Champ label="Son quartier">
                  <NeighborhoodPicker value={beneficiaryNeighborhoodInMali} onChange={setBeneficiaryNeighborhoodInMali} />
                </Champ>
              </>
            )}
          </section>
        )}

        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-bold text-rose-700">{formError}</div>
        )}

        <Button type="submit" disabled={isSubmitting || !role} size="lg" fullWidth>
          <span>{isSubmitting ? 'Création de votre espace…' : 'Accéder à mon espace'}</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}

const INPUT =
  'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-suguba-brand/30 focus:border-suguba-brand';

function Champ({ label, aide, children }: { label: string; aide?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-bold text-slate-700">{label}</label>
      {children}
      {aide && <p className="text-[11px] text-slate-500">{aide}</p>}
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500">Chargement…</div>}>
          <FinaliserInscription />
        </Suspense>
      </main>
    </div>
  );
}
