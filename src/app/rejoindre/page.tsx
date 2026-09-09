'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import BottomNav from '@/components/common/BottomNav';
import { supabase } from '@/lib/supabase';
import {
  Store, ShoppingBag, Truck, Globe,
  ArrowLeft, ShieldAlert, Wallet, Package, MapPin, Heart
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

type RoleKey = 'reseller' | 'supplier' | 'driver' | 'diaspora';

/**
 * Page d'explication des rôles, créée le 2026-09-09 en même temps que le
 * passage de l'accueil en vitrine produit. Tout le discours de recrutement
 * qui occupait auparavant la page d'accueil (hero, cartes de rôles,
 * « comment ça marche en 4 étapes ») vit désormais ici, mais raconté
 * autrement : une procédure numérotée par rôle, du premier clic jusqu'au
 * premier gain, plutôt qu'un argumentaire général où personne ne savait par
 * quoi commencer.
 *
 * Le bouton d'inscription déclenche directement Google avec le bon rôle —
 * sans repasser par /register où il faudrait resélectionner ce rôle.
 */

const ROLES: Record<RoleKey, {
  label: string;
  tagline: string;
  icon: typeof Store;
  accent: string;
  ring: string;
  chipBg: string;
  quoiFaire: string;
  gain: { titre: string; detail: string };
  etapes: { titre: string; detail: string }[];
  cta: string;
}> = {
  reseller: {
    label: 'Revendeur',
    tagline: 'Vendez sans acheter de stock',
    icon: Store,
    accent: 'text-emerald-700',
    ring: 'ring-emerald-500 border-emerald-500 bg-emerald-50',
    chipBg: 'bg-emerald-100 text-emerald-800',
    quoiFaire: "Vous partagez des produits du catalogue à votre réseau WhatsApp. Vous n'achetez rien, vous ne stockez rien, vous n'avancez pas un franc. Suguba livre et encaisse à votre place.",
    gain: {
      titre: 'Une commission fixe par vente livrée',
      detail: "Le montant est écrit sur chaque produit, avant même que vous partagiez. Il vous est versé par Orange Money ou Wave.",
    },
    etapes: [
      { titre: 'Créez votre compte avec Google', detail: "Puis complétez votre dossier : nom, numéro WhatsApp et quartier. Deux minutes." },
      { titre: 'Attendez la validation de Suguba', detail: "Notre équipe examine votre dossier. Vous recevez l'accès à votre espace revendeur une fois validé." },
      { titre: 'Partagez et encaissez', detail: "Chaque produit a un bouton de partage qui génère votre lien personnel. Quand le client est livré et a payé, votre commission devient retirable." },
    ],
    cta: 'Devenir revendeur',
  },
  supplier: {
    label: 'Fournisseur',
    tagline: 'Faites distribuer votre stock',
    icon: ShoppingBag,
    accent: 'text-blue-700',
    ring: 'ring-blue-500 border-blue-500 bg-blue-50',
    chipBg: 'bg-blue-100 text-blue-800',
    quoiFaire: "Vous déposez vos produits sur la plateforme. Le réseau de revendeurs Suguba les diffuse à sa place, et nos livreurs s'occupent de la remise au client.",
    gain: {
      titre: 'Votre prix fournisseur, garanti',
      detail: "Vous fixez le montant que vous voulez toucher. Suguba ajoute par-dessus la commission du revendeur et sa marge — votre prix n'est jamais rogné.",
    },
    etapes: [
      { titre: 'Créez votre compte avec Google', detail: "Puis renseignez votre dossier entreprise : nom de la boutique, quartier de l'entrepôt, catégorie de produits." },
      { titre: 'Attendez la validation de Suguba', detail: "Notre équipe vérifie le dossier avant de vous ouvrir l'espace fournisseur." },
      { titre: 'Déposez un produit', detail: "Photo, description, prix fournisseur et stock. Suguba fixe le prix public et la commission, puis publie le produit dans le réseau." },
    ],
    cta: 'Devenir fournisseur',
  },
  driver: {
    label: 'Livreur',
    tagline: 'Des courses rémunérées à Bamako',
    icon: Truck,
    accent: 'text-amber-700',
    ring: 'ring-amber-500 border-amber-500 bg-amber-50',
    chipBg: 'bg-amber-100 text-amber-800',
    quoiFaire: "Vous récupérez les colis chez le fournisseur et vous les livrez au client, avec votre moto ou votre véhicule. Vous encaissez le paiement à la remise.",
    gain: {
      titre: 'Une rémunération par course',
      detail: "Vous voyez le montant à encaisser avant de partir, et votre portefeuille récapitule ce que vous devez reverser au hub en fin de journée.",
    },
    etapes: [
      { titre: 'Créez votre compte avec Google', detail: "Puis renseignez votre véhicule, votre immatriculation et vos zones d'intervention." },
      { titre: 'Attendez la validation de Suguba', detail: "Notre équipe vérifie votre dossier avant de vous assigner la moindre course." },
      { titre: 'Livrez et validez par code', detail: "Vous voyez uniquement vos courses. À la remise, le client vous donne son code secret : vous le saisissez, la course est clôturée." },
    ],
    cta: 'Devenir livreur',
  },
  diaspora: {
    label: 'Diaspora',
    tagline: 'Équipez votre famille depuis l\'étranger',
    icon: Globe,
    accent: 'text-purple-700',
    ring: 'ring-purple-500 border-purple-500 bg-purple-50',
    chipBg: 'bg-purple-100 text-purple-800',
    quoiFaire: "Vous vivez hors du Mali et vous voulez faire livrer un proche à Bamako. Vous choisissez, vous payez, nous livrons — vous n'avez personne à déranger sur place.",
    gain: {
      titre: 'Vos proches équipés, sans intermédiaire',
      detail: "Vous suivez la commande jusqu'à la remise, et le bénéficiaire n'a rien à avancer.",
    },
    etapes: [
      { titre: 'Choisissez un produit', detail: "Les prix sont affichés en euros ou en dollars selon votre pays, au taux officiel." },
      { titre: 'Indiquez le bénéficiaire à Bamako', detail: "Son nom, son téléphone et son quartier — c'est tout ce dont le livreur a besoin." },
      { titre: 'Payez et suivez la livraison', detail: "Vous réglez la commande, Suguba livre à Bamako sous 24h et vous confirme la remise." },
    ],
    cta: 'Commander pour ma famille',
  },
};

const ORDRE: RoleKey[] = ['reseller', 'supplier', 'driver', 'diaspora'];

export default function RejoindrePage() {
  const [role, setRole] = useState<RoleKey>('reseller');
  const [erreur, setErreur] = useState<string | null>(null);

  const actif = ROLES[role];
  const Icon = actif.icon;

  const handleGoogleJoin = async () => {
    setErreur(null);
    if (!supabase) {
      setErreur('Inscription Google indisponible sur cet environnement.');
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?intendedRole=${role}` },
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8f5] pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full space-y-5">

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au catalogue
        </Link>

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Gagner de l&apos;argent avec Suguba
          </h1>
          <p className="text-sm text-gray-500">
            Quatre façons de travailler avec nous. Choisissez la vôtre — chacune est expliquée
            de la première étape jusqu&apos;au premier gain.
          </p>
        </div>

        {/* Sélecteur de rôle */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {ORDRE.map((cle) => {
            const r = ROLES[cle];
            const RIcon = r.icon;
            const estActif = cle === role;
            return (
              <button
                key={cle}
                type="button"
                onClick={() => setRole(cle)}
                className={`p-3.5 rounded-2xl border text-left transition-all space-y-2 ${
                  estActif ? `ring-2 ${r.ring}` : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <RIcon className={`w-5 h-5 ${estActif ? r.accent : 'text-gray-400'}`} />
                <div>
                  <p className="font-bold text-xs text-gray-900">{r.label}</p>
                  <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{r.tagline}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Détail du rôle sélectionné */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-5 sm:p-7 space-y-6">

          <div className="flex items-start gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${actif.chipBg}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-lg text-gray-900">{actif.label}</h2>
              <p className="text-sm text-gray-600 leading-relaxed mt-1">{actif.quoiFaire}</p>
            </div>
          </div>

          {/* Ce que ça rapporte */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex gap-3 items-start">
            <Wallet className={`w-4 h-4 shrink-0 mt-0.5 ${actif.accent}`} />
            <div>
              <p className="font-bold text-sm text-gray-900">{actif.gain.titre}</p>
              <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{actif.gain.detail}</p>
            </div>
          </div>

          {/* Procédure */}
          <div className="space-y-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">
              Comment démarrer
            </p>
            {actif.etapes.map((etape, i) => (
              <div key={etape.titre} className="flex gap-3.5">
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${actif.chipBg}`}>
                    {i + 1}
                  </div>
                  {i < actif.etapes.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                </div>
                <div className="pb-1">
                  <p className="font-bold text-sm text-gray-900">{etape.titre}</p>
                  <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{etape.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {erreur && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              {erreur}
            </div>
          )}

          {/* Action */}
          {role === 'diaspora' ? (
            <Link
              href="/diaspora"
              className="w-full py-3.5 px-6 bg-[#09b500] hover:bg-[#078000] text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Heart className="w-4 h-4" />
              {actif.cta}
            </Link>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGoogleJoin}
                className="w-full py-3.5 px-6 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-800 font-bold rounded-2xl text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
              >
                <GoogleIcon className="w-5 h-5" />
                {actif.cta} avec Google
              </button>
              <p className="text-[11px] text-gray-400 text-center">
                Sans mot de passe. Vous compléterez votre dossier juste après.
              </p>
            </div>
          )}
        </div>

        {/* Repères pratiques */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Package, titre: 'Aucun stock à acheter', detail: 'Revendeurs : zéro investissement de départ.' },
            { icon: MapPin, titre: 'Bamako et régions', detail: 'Livraison assurée par le réseau Suguba.' },
            { icon: Wallet, titre: 'Paiement Mobile Money', detail: 'Orange Money, Wave ou Moov Money.' },
          ].map(({ icon: I, titre, detail }) => (
            <div key={titre} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3 items-start">
              <I className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs text-gray-900">{titre}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{detail}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-500">
          Vous avez déjà un compte ?{' '}
          <Link href="/login" className="font-bold text-suguba-brand hover:underline">
            Se connecter
          </Link>
        </p>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
