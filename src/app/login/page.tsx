'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { sugubaStore, useSugubaStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import {
  ArrowRight,
  ShieldCheck, Zap, Store, ShoppingBag, Truck, Shield, Mail
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

const quickRoles = [
  { role: 'reseller' as UserRole,  label: 'Revendeur',   icon: Store,       color: 'bg-emerald-50 text-emerald-700 border-emerald-200',  dest: '/reseller'  },
  { role: 'supplier' as UserRole,  label: 'Fournisseur', icon: ShoppingBag, color: 'bg-blue-50 text-blue-700 border-blue-200',            dest: '/supplier'  },
  { role: 'driver' as UserRole,    label: 'Livreur',     icon: Truck,       color: 'bg-amber-50 text-amber-700 border-amber-200',         dest: '/driver'    },
  { role: 'admin' as UserRole,     label: 'Admin',       icon: Shield,      color: 'bg-purple-50 text-purple-700 border-purple-200',      dest: '/admin'     },
];

// Corrige BUG-003 : la "connexion rapide" n'existe plus qu'en développement
// local, contrôlée par une variable SERVEUR (SUGUBA_DEMO_MODE), jamais par
// ce flag client qui ne fait que masquer/afficher le bloc — le blocage réel
// se fait dans /api/auth/demo-login, non falsifiable depuis le navigateur.
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// useSearchParams() force Next.js à bailer sur le rendu client — sans
// Suspense, `next build` échoue sur cette page avec "useSearchParams()
// should be wrapped in a suspense boundary" (jamais visible en `next dev`,
// qui n'applique pas cette contrainte, d'où le trou entre "ça marche en
// local" et le build de prod qui plantait silencieusement à chaque déploi
// Vercel). Voir LoginPage plus bas pour le vrai export par défaut.
function LoginPageContent() {
  const searchParams = useSearchParams();
  const deniedRole = searchParams.get('denied');

  // Téléphone/OTP maison retiré (2026-08-26) : aucune passerelle SMS réelle
  // n'était branchée (voir CLAUDE.md / REPRISE.md), donc ce chemin ne
  // livrait jamais de code à un vrai utilisateur. Seuls Google et l'email
  // (lien magique Supabase Auth) restent — les deux prouvent réellement
  // l'identité de la personne qui se connecte.
  const [email, setEmail] = useState('');
  const [emailLinkSent, setEmailLinkSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleQuickLogin = async (role: UserRole, dest: string) => {
    setErrorMessage('');
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Connexion rapide indisponible sur cet environnement.');
        return;
      }
      sugubaStore.switchRole(role);
      window.location.href = dest;
    } catch (_) {
      setErrorMessage('Connexion rapide indisponible.');
    }
  };

  // Lien magique plutôt que code à taper : le template email par défaut de
  // Supabase (gratuit, aucune personnalisation nécessaire) contient déjà un
  // lien cliquable qui embarque le jeton — cliquer dessus renvoie vers
  // /auth/callback, exactement le même point de sortie que Google
  // ci-dessous. Pas besoin d'un second écran "entrez le code" pour l'email.
  const handleRequestEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setErrorMessage('Connexion email indisponible sur cet environnement.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setIsLoading(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setEmailLinkSent(true);
  };

  const handleGoogleLogin = async () => {
    if (!supabase) {
      setErrorMessage('Connexion Google indisponible sur cet environnement.');
      return;
    }
    setErrorMessage('');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8f5]">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden shrink-0">
            <Image
              src="/images/logo.png"
              alt="Logo Suguba"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="font-black text-gray-900 text-lg tracking-tight">
            SUGUBA<span className="text-suguba-brand">.ML</span>
          </span>
        </Link>
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          Retour à l&apos;accueil
        </Link>
      </div>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-sm space-y-4">

          {/* Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-100 shadow-float">

            {/* Header */}
            <div className="text-center mb-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-3 shadow-brand-md"
                style={{ background: 'linear-gradient(135deg, #09b500 0%, #16a34a 100%)' }}
              >
                S
              </div>
              <h1 className="text-xl font-black text-gray-900">
                Connexion Suguba
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                Sans mot de passe, avec Google ou par email
              </p>
            </div>

            {deniedRole && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-2xl text-xs font-semibold text-red-600 text-center">
                Connexion requise avec un compte « {deniedRole} » pour accéder à cette page.
              </div>
            )}

            {/* Google — chemin le plus rapide, toujours en premier */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-3 mb-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-bold rounded-2xl text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
            >
              <GoogleIcon className="w-4 h-4" />
              Continuer avec Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-gray-100" />
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">ou</span>
              <div className="h-px flex-1 bg-gray-100" />
            </div>

            {emailLinkSent ? (
              <div className="text-center space-y-3 animate-fade-up">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-gray-900">Vérifiez votre boîte mail</p>
                <p className="text-xs text-gray-500">
                  Un lien de connexion a été envoyé à <b>{email}</b>. Ouvrez-le depuis ce même appareil pour continuer.
                </p>
                <button
                  type="button"
                  onClick={() => setEmailLinkSent(false)}
                  className="text-xs text-suguba-brand hover:underline font-semibold"
                >
                  Utiliser une autre adresse
                </button>
              </div>
            ) : (
              <form onSubmit={handleRequestEmailOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-700">
                    Adresse email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      placeholder="vous@exemple.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-suguba-brand/30 focus:border-suguba-brand transition-all"
                    />
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-suguba-brand hover:bg-suguba-brand-dark text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-brand-md hover:shadow-brand-lg transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Envoi du lien...
                    </span>
                  ) : (
                    <>
                      Recevoir mon lien de connexion
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Register CTA */}
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-500">
                Pas encore de compte ?{' '}
                <Link href="/register" className="font-bold text-suguba-brand hover:underline">
                  Créer un compte pro &rarr;
                </Link>
              </p>
            </div>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-gray-50">
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                <ShieldCheck className="w-3 h-3 text-suguba-brand" />
                Connexion sécurisée
              </div>
              <div className="w-px h-3 bg-gray-200" />
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                <Zap className="w-3 h-3 text-amber-500" />
                Sans mot de passe
              </div>
            </div>
          </div>

          {/* Quick Demo Access — masqué hors développement (corrige BUG-003).
              Le blocage réel est côté serveur : même affiché par erreur,
              /api/auth/demo-login refuse tant que SUGUBA_DEMO_MODE n'est pas
              positionné explicitement sur le serveur. */}
          {DEMO_MODE && (
            <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-card">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 text-center mb-1">
                ⚠️ Accès démo — désactivé en production
              </p>
              <p className="text-[9px] text-gray-400 text-center mb-3">
                Ne saute aucune vérification réelle : réservé aux environnements de développement.
              </p>
              {/* Corrige BUG-015 : en grid-cols-4 sur mobile, la 4e carte
                  (Admin) tombait exactement sous le bouton flottant
                  WhatsApp (fixed bottom-20 right-4), la rendant difficile à
                  atteindre au tactile. 2 colonnes sur mobile évite toute
                  superposition ; 4 colonnes réapparaissent dès qu'il y a
                  assez de largeur (sm:) pour ne plus croiser le bouton. */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {quickRoles.map(({ role, label, icon: Icon, color, dest }) => (
                  <button
                    key={role}
                    onClick={() => handleQuickLogin(role, dest)}
                    className={`p-2 rounded-xl text-center border transition-all hover:shadow-sm active:scale-95 ${color}`}
                  >
                    <Icon className="w-4 h-4 mx-auto mb-0.5" />
                    <span className="text-[9px] font-bold leading-none block">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Bottom legal */}
      <div className="text-center pb-6 px-4">
        <p className="text-[10px] text-gray-300">
          En vous connectant, vous acceptez les{' '}
          <Link href="/legal/terms" className="text-suguba-brand hover:underline">
            Conditions générales
          </Link>{' '}
          et la{' '}
          <Link href="/legal/privacy" className="text-suguba-brand hover:underline">
            Politique de confidentialité
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f5f8f5]" />}>
      <LoginPageContent />
    </Suspense>
  );
}
