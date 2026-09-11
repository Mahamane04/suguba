'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import BottomNav from '@/components/common/BottomNav';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import {
  Store, ShoppingBag, Truck, Globe,
  ArrowLeft, ArrowRight, ShieldAlert, Check, Heart
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
 * Trois principes maintenant : le mécanisme montré plutôt qu'affirmé (comment
 * l'argent circule, en trois temps), la hiérarchie visuelle portée par un
 * bandeau coloré, et le bouton atteignable sans défiler. Le détail passe
 * après, pour ceux qui veulent lire.
 *
 * Sans montants, délibérément — voir le commentaire sur `argument()`.
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
    accent: 'text-slate-700', bord: 'ring-slate-500 border-slate-500 bg-slate-50',
    puce: 'bg-slate-100 text-slate-800', fond: 'from-slate-600 to-slate-700',
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
    accent: 'text-slate-700', bord: 'ring-slate-500 border-slate-500 bg-slate-50',
    puce: 'bg-slate-100 text-slate-800', fond: 'from-slate-600 to-violet-700',
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

  /**
   * L'argument du rôle : une promesse courte, puis le MÉCANISME en trois
   * temps.
   *
   * Volontairement sans montant. La version précédente affichait la
   * commission la plus élevée du catalogue — un chiffre exact, mais calculé
   * sur des produits `[DÉMO]` : promettre un gain adossé à un produit qui
   * n'existe pas revient à la fausse promesse qu'on a passé la session à
   * retirer du site. Montrer comment l'argent circule convainc sans engager
   * un montant.
   */
  const argument = () => {
    const contenu: Record<RoleKey, { titre: string; sous: string; flux: string[] }> = {
      reseller: {
        titre: 'Vendez sans rien avancer',
        sous: 'La commission est écrite sur chaque produit, avant même que vous partagiez.',
        flux: ['Vous partagez', 'Suguba livre et encaisse', 'Vous touchez votre commission'],
      },
      supplier: {
        titre: 'Votre prix, jamais rogné',
        sous: 'Vous fixez ce que vous touchez. Suguba ajoute par-dessus, sans y toucher.',
        flux: ['Votre prix', '+ commission revendeur', '+ marge Suguba'],
      },
      driver: {
        titre: 'Payé à la course',
        sous: 'Vous voyez ce qu\'il y a à encaisser avant de partir.',
        flux: ['Vous recevez la course', 'Vous livrez', 'Vous encaissez'],
      },
      diaspora: {
        titre: 'Livré à Bamako sous 24h',
        sous: 'Vous payez depuis l\'étranger, votre proche n\'avance rien.',
        flux: ['Vous choisissez', 'Vous payez', 'Suguba livre'],
      },
    };

    const { titre, sous, flux } = contenu[role];

    return (
      <>
        <p className="text-2xl sm:text-3xl font-black leading-tight">{titre}</p>
        <p className="text-sm text-white/80 mt-1.5 leading-relaxed">{sous}</p>

        <div className="mt-4 flex items-center gap-1.5 flex-wrap">
          {flux.map((etape, i) => (
            <React.Fragment key={etape}>
              {i > 0 && <ArrowRight className="w-3.5 h-3.5 text-white/40 shrink-0" />}
              <span className="px-2.5 py-1.5 rounded-xl bg-white/15 text-[11px] font-bold">
                {etape}
              </span>
            </React.Fragment>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8f5]">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-5 w-full space-y-4">

        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900">
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

          {argument()}

          {erreur && (
            <div className="mt-4 p-3 rounded-2xl bg-black/20 text-white text-xs font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              {erreur}
            </div>
          )}

          <div className="mt-5">
            {/* `ghost` sans bordure : le bouton est posé sur un aplat coloré,
                où un liseré slate jurerait. Le reste (rayon, hauteur, états)
                vient du composant. */}
            {role === 'diaspora' ? (
              <Button href="/diaspora" variant="ghost" size="lg" fullWidth className="border-transparent">
                <Heart className="w-4 h-4" />
                {actif.cta}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={handleGoogleJoin}
                  variant="ghost"
                  size="lg"
                  fullWidth
                  className="border-transparent"
                >
                  <GoogleIcon className="w-5 h-5" />
                  {actif.cta}
                </Button>
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
                <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-black ${actif.puce}`}>
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
