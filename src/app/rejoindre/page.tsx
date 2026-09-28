'use client';

import React, { useEffect, useState } from 'react';
import { memoriserParrain } from '@/lib/parrain';
import Link from 'next/link';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import BottomNav from '@/components/common/BottomNav';
import BoutiquesQuiRecrutent from '@/components/reseau/BoutiquesQuiRecrutent';
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

/** REQ-PROFIL-001 / TASK-PROFIL-001 : choisir une activité avant de créer ou ajouter un profil. */
const ROLES: Record<RoleKey, {
  label: string; intention: string; repere: string; tagline: string; icon: typeof Store;
  accent: string; bord: string; puce: string; fond: string;
  quoiFaire: string;
  etapes: string[];
  cta: string;
}> = {
  reseller: {
    label: 'Revendeur', intention: 'Vendre sans stock', repere: 'Je partage des produits et je gagne une commission.', tagline: 'Sans acheter de stock', icon: Store,
    accent: 'text-emerald-700', bord: 'ring-emerald-500 border-emerald-500 bg-emerald-50',
    puce: 'bg-emerald-100 text-emerald-800', fond: 'from-emerald-600 to-green-700',
    quoiFaire: "Vous partagez un produit à votre réseau WhatsApp. Vous n'achetez rien, vous n'avancez rien : Suguba livre et encaisse, vous touchez votre commission.",
    etapes: [
      'Compte Google ou e-mail, puis votre numéro et quartier',
      'Votre espace revendeur s’ouvre tout de suite',
      'Vous partagez, le client est livré, vous êtes payé',
    ],
    cta: 'Devenir revendeur',
  },
  supplier: {
    label: 'Fournisseur', intention: 'Vendre mes produits', repere: 'J’ai des produits en stock à proposer sur Suguba.', tagline: 'Faites distribuer votre stock', icon: ShoppingBag,
    accent: 'text-slate-700', bord: 'ring-slate-500 border-slate-500 bg-slate-50',
    puce: 'bg-slate-100 text-slate-800', fond: 'from-slate-600 to-slate-700',
    quoiFaire: "Vous déposez vos produits. Le réseau de revendeurs les diffuse, nos livreurs les remettent au client. Vous ne gérez ni la vente ni la livraison.",
    etapes: [
      'Compte Google ou e-mail, puis votre entreprise et quartier d\'entrepôt',
      'Suguba vérifie chaque produit avant sa mise en vente',
      'Vous déposez un produit, il part dans le réseau',
    ],
    cta: 'Devenir fournisseur',
  },
  driver: {
    label: 'Livreur', intention: 'Livrer des colis', repere: 'J’ai une moto ou un véhicule pour faire des courses.', tagline: 'Courses rémunérées', icon: Truck,
    accent: 'text-amber-700', bord: 'ring-amber-500 border-amber-500 bg-amber-50',
    puce: 'bg-amber-100 text-amber-800', fond: 'from-amber-600 to-orange-700',
    quoiFaire: "Vous récupérez les colis et vous les livrez à Bamako, avec votre moto ou votre véhicule. Vous encaissez le paiement à la remise.",
    etapes: [
      'Compte Google ou e-mail, puis véhicule, immatriculation et zone',
      'Passage au guichet Suguba avant vos premières courses',
      'Vous recevez vos courses, vous livrez, vous êtes payé',
    ],
    cta: 'Devenir livreur',
  },
  diaspora: {
    label: 'Diaspora', intention: 'Acheter pour un proche', repere: 'Je vis à l’étranger et je commande pour le Mali.', tagline: 'Depuis l\'étranger', icon: Globe,
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
  // Lien de parrainage (/rejoindre?ref=CODE) : le code est gardé 30 jours et
  // relu à la fin de l'inscription, quel que soit le mode de connexion.
  useEffect(() => { memoriserParrain(new URLSearchParams(window.location.search).get('ref')); }, []);

  const [role, setRole] = useState<RoleKey | null>(null);
  const choixTitre = React.useRef<HTMLHeadingElement>(null);
  const detailTitre = React.useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (role) detailTitre.current?.focus(); }, [role]);
  const [erreur, setErreur] = useState<string | null>(null);
  // Déjà connecté (2026-09-26) : pas de nouvelle inscription, on ajoute le
  // profil au compte existant (/compte/profils). null = pas encore lu.
  const [compte, setCompte] = useState<{ connecte: boolean; roles: Record<string, string> } | null>(null);
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((moi) => setCompte(moi?.authenticated
        ? { connecte: true, roles: moi.roles || (moi.role ? { [moi.role]: moi.status } : {}) }
        : { connecte: false, roles: {} }))
      .catch(() => setCompte({ connecte: false, roles: {} }));
  }, []);

  const actif = ROLES[role || 'reseller'];
  const Icon = actif.icon;

  const handleGoogleJoin = async () => {
    if (!role) return;
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

    const { titre, sous, flux } = contenu[role || 'reseller'];

    return (
      <>
        <p className="text-2xl sm:text-3xl font-bold leading-tight">{titre}</p>
        <p className="text-sm text-white/80 mt-1.5 leading-relaxed">{sous}</p>

        <div className="mt-4 flex items-center gap-1.5 flex-wrap">
          {flux.map((etape, i) => (
            <React.Fragment key={etape}>
              {i > 0 && <ArrowRight className="w-3.5 h-3.5 text-white/40 shrink-0" />}
              <span className="px-2.5 py-1.5 rounded-xl bg-white/15 text-xs font-bold">
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

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-5 pb-28 w-full space-y-5">

        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" />
          Retour au catalogue
        </Link>

        <section aria-labelledby="choix-profil" className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">Un compte, plusieurs profils possibles</p>
            <h1 id="choix-profil" ref={choixTitre} tabIndex={-1} className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight scroll-mt-24 focus:outline-none">
              Que voulez-vous faire sur Suguba ?
            </h1>
            <p className="text-sm text-slate-600 mt-2">Choisissez votre activité pour découvrir le bon profil. Vous pourrez en ajouter d’autres au même compte.</p>
          </div>
          <div role="group" aria-label="Les quatre profils Suguba" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {ORDRE.map((cle) => {
              const r = ROLES[cle]; const RIcon = r.icon; const estActif = cle === role;
              return <button key={cle} type="button" aria-pressed={estActif} aria-controls="detail-profil"
                onClick={() => { setErreur(null); setRole(cle); }}
                className={`text-left rounded-2xl border-2 p-3 sm:p-4 flex flex-col gap-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 ${estActif ? r.bord : 'bg-white border-slate-200 hover:border-emerald-600'}`}>
                <span className="flex items-center justify-between gap-2"><RIcon aria-hidden="true" className={`w-5 h-5 ${r.accent}`} />{estActif && <Check aria-hidden="true" className="w-5 h-5 text-emerald-700" />}</span>
                <span className="font-bold text-sm sm:text-base text-slate-900 leading-snug">{r.intention}</span>
                <span className="text-xs sm:text-sm text-slate-600 leading-relaxed">{r.repere}</span>
                <span className={`text-xs font-bold mt-auto pt-1 ${r.accent}`}>{r.label} · {estActif ? 'Sélectionné' : 'Voir le profil'}</span>
              </button>;
            })}
          </div>
          <p className="text-sm text-slate-600">Vous souhaitez simplement acheter au Mali ? <Link href="/" className="font-bold text-emerald-800 underline">Voir le catalogue</Link>.</p>
        </section>

        {role ? <section id="detail-profil" aria-labelledby="profil-selectionne" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-5">
            <h2 id="profil-selectionne" ref={detailTitre} tabIndex={-1} className="text-lg font-bold text-slate-900 scroll-mt-28 focus:outline-none">Votre choix : {actif.label}</h2>
            <button type="button" onClick={() => { setRole(null); setErreur(null); choixTitre.current?.focus(); }} className="min-h-11 text-sm font-semibold text-emerald-800 underline">Changer de profil</button>
          </div>
        {/* L'argument chiffré + le bouton, tous deux au-dessus de la ligne de
            flottaison : c'est ce que la version précédente enterrait sous
            deux écrans de prose. */}
        <div className={`rounded-3xl p-5 sm:p-6 text-white bg-gradient-to-br ${actif.fond} shadow-lg`}>
          <div className="flex items-center gap-2 mb-3">
            <Icon className="w-5 h-5 text-white/80" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/80">
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
            {compte === null ? <p role="status" className="text-sm">Vérification de votre compte…</p> : role === 'diaspora' ? (
              <Button href="/diaspora" variant="ghost" size="lg" fullWidth className="border-transparent">
                <Heart className="w-4 h-4" />
                {actif.cta}
              </Button>
            ) : compte?.connecte && compte.roles[role] ? (
              <>
                <Button href="/compte/profils" variant="ghost" size="lg" fullWidth className="border-transparent">
                  Ouvrir mon espace {actif.label.toLowerCase()}
                </Button>
                <p className="text-xs text-white/70 text-center mt-2">Vous avez déjà ce profil sur votre compte.</p>
              </>
            ) : compte?.connecte ? (
              <>
                <Button href={`/compte/profils?ajouter=${role}`} variant="ghost" size="lg" fullWidth className="border-transparent">
                  Ajouter le profil {actif.label.toLowerCase()} à mon compte
                </Button>
                <p className="text-xs text-white/70 text-center mt-2">Vous gardez votre compte : pas besoin de vous réinscrire.</p>
              </>
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
                  Continuer comme {actif.label.toLowerCase()} avec Google
                </Button>
                <Link href={`/register?role=${role}`} className="mt-2 w-full min-h-[48px] inline-flex items-center justify-center rounded-2xl border border-white/40 text-sm font-bold text-white hover:bg-white/10 transition-colors">
                  Créer mon profil {actif.label.toLowerCase()} par e-mail
                </Link>
                <p className="text-xs text-white/70 text-center mt-2">
                  Dossier en 2 minutes
                </p>
              </>
            )}
          </div>
        </div>

        {/* Le détail, pour qui veut lire — après l'argument, pas avant. */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-5 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">{actif.quoiFaire}</p>

          <div className="pt-1 space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Comment démarrer
            </p>
            {actif.etapes.map((etape, i) => (
              <div key={etape} className="flex items-start gap-2.5">
                <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${actif.puce}`}>
                  {i + 1}
                </span>
                <span className="text-xs text-gray-700 leading-relaxed">{etape}</span>
              </div>
            ))}
          </div>
        </div>

        </section> : <p id="detail-profil" className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-900">Choisissez l’un des quatre profils ci-dessus pour voir les étapes. Consulter un profil ne crée pas de compte et ne modifie pas vos profils existants.</p>}

        {!compte?.connecte && (
          <p className="text-center text-xs text-gray-500 pb-2">
            Vous avez déjà un compte ?{' '}
            <Link href="/login" className="font-bold text-suguba-brand-dark hover:underline">
              Se connecter
            </Link>
          </p>
        )}


        <BoutiquesQuiRecrutent />
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
