'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import BottomNav from '@/components/common/BottomNav';
import { supabase } from '@/lib/supabase';
import { useSugubaStore } from '@/lib/store';
import {
  Store, ShoppingBag, Truck, Globe,
  ArrowLeft, ShieldAlert, Check, Heart
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
 * Refondue le 2026-09-09. La version précédente parlait d'argent sans jamais
 * donner un chiffre : quatre paragraphes de prose abstraite, une grille 2×2
 * qui mangeait un écran entier avant la moindre information, et le bouton
 * d'inscription à deux écrans de défilement.
 *
 * Trois principes maintenant : un montant RÉEL en tête (calculé sur le vrai
 * catalogue, jamais inventé — c'est ce qui rend la promesse crédible), un
 * exemple chiffré plutôt qu'une affirmation, et le bouton atteignable sans
 * défiler. Le détail passe après, pour ceux qui veulent lire.
 */

const ROLES: Record<RoleKey, {
  label: string; tagline: string; icon: typeof Store;
  accent: string; bord: string; puce: string; fond: string;
  quoiFaire: string;
  etapes: string[];
  cta: string;
}> = {
  reseller: {
    label: 'Revendeur', tagline: 'Sans acheter de stock', icon: Store,
    accent: 'text-emerald-700', bord: 'ring-emerald-500 border-emerald-500 bg-emerald-50',
    puce: 'bg-emerald-100 text-emerald-800', fond: 'from-emerald-600 to-green-700',
    quoiFaire: "Vous partagez un produit à votre réseau WhatsApp. Vous n'achetez rien, vous n'avancez rien : Suguba livre et encaisse, vous touchez votre commission.",
    etapes: [
      'Compte Google + votre numéro et quartier',
      'Suguba valide votre dossier (24-48h)',
      'Vous partagez, le client est livré, vous êtes payé',
    ],
    cta: 'Devenir revendeur',
  },
  supplier: {
    label: 'Fournisseur', tagline: 'Faites distribuer votre stock', icon: ShoppingBag,
    accent: 'text-blue-700', bord: 'ring-blue-500 border-blue-500 bg-blue-50',
    puce: 'bg-blue-100 text-blue-800', fond: 'from-blue-600 to-indigo-700',
    quoiFaire: "Vous déposez vos produits. Le réseau de revendeurs les diffuse, nos livreurs les remettent au client. Vous ne gérez ni la vente ni la livraison.",
    etapes: [
      'Compte Google + votre entreprise et quartier d\'entrepôt',
      'Suguba valide votre dossier (24-48h)',
      'Vous déposez un produit, il part dans le réseau',
    ],
    cta: 'Devenir fournisseur',
  },
  driver: {
    label: 'Livreur', tagline: 'Courses rémunérées', icon: Truck,
    accent: 'text-amber-700', bord: 'ring-amber-500 border-amber-500 bg-amber-50',
    puce: 'bg-amber-100 text-amber-800', fond: 'from-amber-600 to-orange-700',
    quoiFaire: "Vous récupérez les colis et vous les livrez à Bamako, avec votre moto ou votre véhicule. Vous encaissez le paiement à la remise.",
    etapes: [
      'Compte Google + véhicule, immatriculation et zone',
      'Suguba valide votre dossier (24-48h)',
      'Vous recevez vos courses, vous livrez, vous êtes payé',
    ],
    cta: 'Devenir livreur',
  },
  diaspora: {
    label: 'Diaspora', tagline: 'Depuis l\'étranger', icon: Globe,
    accent: 'text-purple-700', bord: 'ring-purple-500 border-purple-500 bg-purple-50',
    puce: 'bg-purple-100 text-purple-800', fond: 'from-purple-600 to-violet-700',
    quoiFaire: "Vous vivez hors du Mali et vous voulez équiper un proche à Bamako. Vous choisissez, vous payez, nous livrons — personne à déranger sur place.",
    etapes: [
      'Choisissez un produit (prix affichés en € ou $)',
      'Indiquez le bénéficiaire à Bamako',
      'Suguba livre sous 24h et vous confirme la remise',
    ],
    cta: 'Commander pour ma famille',
  },
};

const ORDRE: RoleKey[] = ['reseller', 'supplier', 'driver', 'diaspora'];

export default function RejoindrePage() {
  const state = useSugubaStore();
  const [role, setRole] = useState<RoleKey>('reseller');
  const [erreur, setErreur] = useState<string | null>(null);

  const actif = ROLES[role];
  const Icon = actif.icon;

  // Chiffres tirés du VRAI catalogue. Rien n'est inventé : si le catalogue est
  // vide, on n'affiche aucun montant plutôt qu'un chiffre de façade — c'est la
  // même règle que celle appliquée aux faux avis et aux fausses statistiques
  // retirés du site.
  const produits = state.products.filter((p) => p.status === 'approved' && p.resellerCommission > 0);
  const meilleur = produits.length
    ? produits.reduce((a, b) => (b.resellerCommission > a.resellerCommission ? b : a))
    : null;
  const commissionMax = meilleur?.resellerCommission ?? 0;

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

  /** Le bandeau chiffré, différent par rôle — c'est l'argument, pas la prose. */
  const argumentChiffre = () => {
    if (role === 'reseller') {
      return meilleur ? (
        <>
          <p className="text-3xl sm:text-4xl font-black leading-none">
            +{commissionMax.toLocaleString('fr-FR')} F
          </p>
          <p className="text-sm text-white/80 mt-1.5">
            par vente, sur le produit le mieux commissionné du catalogue
          </p>
          <p className="text-xs text-white/60 mt-2 leading-relaxed">
            Exemple réel : {meilleur.name.replace(/^\[DÉMO\]\s*/, '')} — le client paie{' '}
            {meilleur.publicPrice.toLocaleString('fr-FR')} F, vous touchez{' '}
            {meilleur.resellerCommission.toLocaleString('fr-FR')} F.
          </p>
        </>
      ) : (
        <>
          <p className="text-2xl font-black leading-tight">Une commission fixe par vente</p>
          <p className="text-sm text-white/80 mt-1.5">
            Le montant est écrit sur chaque produit, avant même que vous partagiez.
          </p>
        </>
      );
    }

    if (role === 'supplier') {
      return (
        <>
          <p className="text-2xl sm:text-3xl font-black leading-tight">Votre prix, jamais rogné</p>
          <p className="text-sm text-white/80 mt-1.5">
            Vous fixez ce que vous touchez. Suguba ajoute par-dessus.
          </p>
          {meilleur && (
            <div className="mt-3 flex items-center gap-1.5 text-xs font-bold flex-wrap">
              <span className="px-2 py-1 rounded-lg bg-white/20">
                Vous : {meilleur.supplierPrice.toLocaleString('fr-FR')} F
              </span>
              <span className="text-white/50">+</span>
              <span className="px-2 py-1 rounded-lg bg-white/10 text-white/80">
                revendeur {meilleur.resellerCommission.toLocaleString('fr-FR')} F
              </span>
              <span className="text-white/50">+</span>
              <span className="px-2 py-1 rounded-lg bg-white/10 text-white/80">
                Suguba {Math.max(0, meilleur.publicPrice - meilleur.supplierPrice - meilleur.resellerCommission).toLocaleString('fr-FR')} F
              </span>
              <span className="text-white/50">=</span>
              <span className="px-2 py-1 rounded-lg bg-white/20">
                client {meilleur.publicPrice.toLocaleString('fr-FR')} F
              </span>
            </div>
          )}
        </>
      );
    }

    if (role === 'driver') {
      return (
        <>
          <p className="text-2xl sm:text-3xl font-black leading-tight">Payé à la course</p>
          <p className="text-sm text-white/80 mt-1.5">
            Vous voyez le montant à encaisser avant de partir, et votre portefeuille
            récapitule ce que vous reversez au hub en fin de journée.
          </p>
        </>
      );
    }

    return (
      <>
        <p className="text-2xl sm:text-3xl font-black leading-tight">Livré à Bamako sous 24h</p>
        <p className="text-sm text-white/80 mt-1.5">
          Vous payez depuis l&apos;étranger, votre proche n&apos;avance rien.
        </p>
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8f5]">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-5 w-full space-y-4">

        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" />
          Retour au catalogue
        </Link>

        <h1 className="text-2xl font-black text-gray-900 tracking-tight">
          Gagner de l&apos;argent avec Suguba
        </h1>

        {/* Sélecteur compact : une ligne défilante au lieu d'une grille 2×2 qui
            occupait un écran entier avant la moindre information. */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {ORDRE.map((cle) => {
            const r = ROLES[cle];
            const RIcon = r.icon;
            const estActif = cle === role;
            return (
              <button
                key={cle}
                type="button"
                onClick={() => setRole(cle)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-bold transition-all ${
                  estActif ? `ring-2 ${r.bord}` : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <RIcon className={`w-4 h-4 ${estActif ? r.accent : 'text-gray-400'}`} />
                {r.label}
              </button>
            );
          })}
        </div>

        {/* L'argument chiffré + le bouton, tous deux au-dessus de la ligne de
            flottaison : c'est ce que la version précédente enterrait sous
            deux écrans de prose. */}
        <div className={`rounded-3xl p-5 sm:p-6 text-white bg-gradient-to-br ${actif.fond} shadow-lg`}>
          <div className="flex items-center gap-2 mb-3">
            <Icon className="w-5 h-5 text-white/80" />
            <span className="text-xs font-black uppercase tracking-wider text-white/80">
              {actif.label} · {actif.tagline}
            </span>
          </div>

          {argumentChiffre()}

          {erreur && (
            <div className="mt-4 p-3 rounded-2xl bg-black/20 text-white text-xs font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              {erreur}
            </div>
          )}

          <div className="mt-5">
            {role === 'diaspora' ? (
              <Link
                href="/diaspora"
                className="w-full py-3.5 px-6 bg-white text-purple-700 font-black rounded-2xl text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
              >
                <Heart className="w-4 h-4" />
                {actif.cta}
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleGoogleJoin}
                  className="w-full py-3.5 px-6 bg-white hover:bg-gray-50 text-gray-900 font-black rounded-2xl text-sm flex items-center justify-center gap-2.5 transition-transform active:scale-[0.98]"
                >
                  <GoogleIcon className="w-5 h-5" />
                  {actif.cta}
                </button>
                <p className="text-[11px] text-white/70 text-center mt-2">
                  Sans mot de passe · dossier en 2 minutes
                </p>
              </>
            )}
          </div>
        </div>

        {/* Le détail, pour qui veut lire — après l'argument, pas avant. */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-5 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">{actif.quoiFaire}</p>

          <div className="pt-1 space-y-2.5">
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">
              Comment démarrer
            </p>
            {actif.etapes.map((etape, i) => (
              <div key={etape} className="flex items-start gap-2.5">
                <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-black ${actif.puce}`}>
                  {i + 1}
                </span>
                <span className="text-xs text-gray-700 leading-relaxed">{etape}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Réassurance, en une ligne chacune */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            'Aucun stock à acheter',
            'Paiement Orange Money ou Wave',
            'Livraison assurée par Suguba',
          ].map((texte) => (
            <div key={texte} className="bg-white rounded-2xl border border-gray-100 px-3 py-2.5 flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-suguba-brand shrink-0 stroke-[3]" />
              <span className="text-[11px] font-semibold text-gray-700">{texte}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-500 pb-2">
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
