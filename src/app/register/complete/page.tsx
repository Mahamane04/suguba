'use client';

import SugubaLoader from '@/components/ui/SugubaLoader';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import ChoixProfil, { ResumeProfil, estProfil, PROFILS_INSCRIPTION, type ProfilInscription as Role } from '@/components/auth/ChoixProfil';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import DialCodePicker from '@/components/common/DialCodePicker';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import EtapesInscription from '@/components/common/EtapesInscription';
import Button from '@/components/ui/Button';
import ChoicePicker from '@/components/ui/ChoicePicker';
import { supabase } from '@/lib/supabase';
import { DEFAULT_DIAL_CODE } from '@/lib/dial-codes';
import { DEFAULT_NEIGHBORHOOD } from '@/lib/bamako-neighborhoods';
import { ArrowRight, Gift, Store, ShoppingBag, Truck, Globe, ShoppingCart, Check } from 'lucide-react';

const DESTINATION: Record<string, string> = {
  customer: '/compte/commandes', reseller: '/reseller', supplier: '/supplier', driver: '/driver', diaspora: '/diaspora', admin: '/admin/a-traiter',
};

const estRole = (v: unknown): v is Role => estProfil(v);

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
  // Numéro déjà pris par un autre compte (voir /api/auth/complete-profile) :
  // proposer de s'y connecter plutôt qu'un formulaire qui échouera toujours.
  const [dejaCompte, setDejaCompte] = useState(false);

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
        if (me.role === 'admin') { router.replace('/admin/a-traiter'); return; }
        if (me.phone && !me.phone.includes('@')) { router.replace('/compte/profils'); return; }
        setFullName(f => f || me.fullName || '');
        setRole(estRole(roleUrl) ? roleUrl : estRole(me.role) ? me.role : null);
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
    setDejaCompte(false);
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
        setDejaCompte(Boolean(json.dejaCompte));
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
    return <div className="p-10 text-center text-sm text-slate-500"><SugubaLoader className="mr-2 inline-flex h-5 w-5 align-middle" />Chargement…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
      <EtapesInscription etapeActuelle={2} />

      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-slate-900">Finalisez votre inscription</h1>
        <p className="text-sm text-slate-500">Votre connexion est confirmée. Vérifiez le profil choisi, puis renseignez vos coordonnées.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Qui êtes-vous ? */}
        <section id="choix-inscription" className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3 scroll-mt-24">
          <h2 className="font-bold text-base text-slate-900">Vérifiez votre choix de profil</h2>
          <ChoixProfil valeur={role} disabled={isSubmitting} onChange={r=>{setRole(r);setFormError('');requestAnimationFrame(()=>document.getElementById('informations-profil')?.focus());}} />
          <Link href="/" className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 text-xs text-slate-600 hover:bg-slate-100">
            <ShoppingCart className="w-4 h-4 shrink-0" />
            <span><strong>Un compte n’est pas obligatoire pour acheter :</strong> vous pouvez aussi commander directement depuis le catalogue.</span>
          </Link>
        </section>

        {/* 2. Coordonnées */}
        {role && (
          <section id="informations-profil" tabIndex={-1} className="scroll-mt-24 focus:outline-none bg-white rounded-3xl p-5 border border-slate-200 space-y-4">
            <ResumeProfil profil={role} />
            <h2 className="font-bold text-base text-slate-900">Vos informations — {PROFILS_INSCRIPTION.find(p=>p.cle===role)?.titre}</h2>
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

            {(role === 'reseller' || role === 'customer') && (
              <>
                <Champ label="Votre quartier à Bamako">
                  <NeighborhoodPicker value={neighborhood} onChange={setNeighborhood} />
                </Champ>
                {refCode && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <Gift className="w-4 h-4 text-suguba-brand-dark shrink-0" />
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
                  <ChoicePicker
                    valeur={category}
                    onChange={setCategory}
                    ariaLabel="Catégorie principale"
                    choix={['Électronique & Énergie', 'Électroménager & Maison', 'Solaire & Groupes', 'Smartphones & Informatique', 'Mode & Beauté']
                      .map((c) => ({ valeur: c, libelle: c }))}
                  />
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
                  <ChoicePicker
                    valeur={vehicleType}
                    onChange={setVehicleType}
                    ariaLabel="Véhicule"
                    choix={[
                      { valeur: 'Moto Sanili / Jakarta 125', libelle: 'Moto (Sanili / Jakarta 125)' },
                      { valeur: 'Tricycle Moto', libelle: 'Tricycle (gros colis)' },
                      { valeur: 'Voiture / Camionnette', libelle: 'Voiture / camionnette' },
                    ]}
                  />
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
                <p className="text-xs text-slate-500">
                  Avant votre première course, un agent Suguba vérifie vos papiers et votre engin au guichet de Bamako.
                </p>
              </>
            )}

            {role === 'diaspora' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Champ label="Pays de résidence">
                    <ChoicePicker
                      valeur={countryOfResidence}
                      onChange={setCountryOfResidence}
                      ariaLabel="Pays de résidence"
                      choix={['France', 'États-Unis', 'Canada', 'Espagne', "Côte d'Ivoire", 'Sénégal', 'Autre'].map((p) => ({ valeur: p, libelle: p }))}
                    />
                  </Champ>
                  <Champ label="Devise">
                    <ChoicePicker
                      valeur={currency}
                      onChange={(v) => setCurrency(v as 'EUR' | 'USD' | 'CAD')}
                      ariaLabel="Devise"
                      choix={[
                        { valeur: 'EUR', libelle: 'Euro (€)' },
                        { valeur: 'USD', libelle: 'Dollar ($)' },
                        { valeur: 'CAD', libelle: 'Dollar canadien' },
                      ]}
                    />
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
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-bold text-rose-700 space-y-1.5">
            <p>{formError}</p>
            {dejaCompte && (
              <Link href="/login" className="inline-block underline">Se connecter avec ce compte</Link>
            )}
          </div>
        )}

        <Button type="submit" disabled={isSubmitting || !role} size="lg" fullWidth>
          <span>{isSubmitting ? <><SugubaLoader className="mr-2 h-4 w-4" />Création de votre espace…</> : `Enregistrer mon profil ${PROFILS_INSCRIPTION.find(p=>p.cle===role)?.titre.toLowerCase() || ''}`}</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}

const INPUT =
  'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-suguba-brand/30 focus:border-suguba-brand';

function Champ({ label, aide, children }: { label: string; aide?: string; children: React.ReactNode }) {
  const id = React.useId();
  const associer = (nodes: React.ReactNode): React.ReactNode => React.Children.map(nodes, node => {
    if (!React.isValidElement<Record<string, any>>(node)) return node;
    if (node.type === 'input') return React.cloneElement(node, { id, 'aria-label': label, 'aria-describedby': aide ? `${id}-aide` : undefined });
    if (node.type === DialCodePicker) return node;
    if (typeof node.type !== 'string') return React.cloneElement(node, { id });
    return node.props.children ? React.cloneElement(node, {}, associer(node.props.children)) : node;
  });
  return <div className="space-y-1"><label htmlFor={id} className="block text-xs font-bold text-slate-700">{label}</label>{associer(children)}{aide && <p id={`${id}-aide`} className="text-xs text-slate-500">{aide}</p>}</div>;
}

export default function CompleteProfilePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500"><SugubaLoader className="mr-2 inline-flex h-5 w-5 align-middle" />Chargement…</div>}>
          <FinaliserInscription />
        </Suspense>
      </main>
    </div>
  );
}
