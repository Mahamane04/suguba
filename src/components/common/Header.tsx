'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { UserRole } from '@/types';
import { sugubaStore, useSugubaStore } from '@/lib/store';
import {
  ShoppingBag, Shield, Truck, Store, UserCheck,
  ChevronDown, LogOut, Menu, X, Globe, LogIn
} from 'lucide-react';

const roleConfig: Record<UserRole, { label: string; icon: React.ElementType; path: string }> = {
  reseller: { label: 'Revendeur', icon: Store, path: '/reseller' },
  supplier: { label: 'Fournisseur', icon: ShoppingBag, path: '/supplier' },
  driver: { label: 'Livreur', icon: Truck, path: '/driver' },
  admin: { label: 'Admin', icon: Shield, path: '/admin' },
  customer: { label: 'Client', icon: UserCheck, path: '/' },
  diaspora: { label: 'Diaspora', icon: Globe, path: '/diaspora' },
};

/**
 * En-tête commun — refait le 2026-09-11 (phase 1 du plan UI/UX).
 *
 * - Affiche le PRÉNOM de la personne connectée (il affichait son numéro, ou
 *   son email pour un profil Google pas encore complété).
 * - Retirés : la cloche de notifications (bouton sans aucun effet) et le mode
 *   sombre (la plupart des écrans ne sont pas prévus pour : il les rendait
 *   illisibles). Un téléphone qui l'avait activé est remis en clair.
 * - Une seule échelle de gris (slate), comme le reste de l'application.
 *
 * Un visiteur ne voit qu'un bouton « Se connecter » ; un compte ne voit que
 * SON espace (voir /api/auth/me).
 *
 * ⚠️ Correctif du 2026-09-11 : chaque page.tsx monte SON PROPRE `<Header />`
 * (pas de layout partagé), donc ce composant redémarre à zéro à CHAQUE
 * navigation. Il refaisait un `fetch('/api/auth/me')` à chaque fois, avec un
 * état local qui redémarrait à `null` : le temps de la requête, l'en-tête
 * affichait « Se connecter » même pour un compte connecté — un flash visible
 * à chaque tape sur un lien, filmé et signalé par l'utilisateur (identique au
 * même bug sur BottomNav). L'identité vient désormais de `useSugubaStore()`,
 * déjà résolue une fois pour toutes par `CloudSyncInitializer` (monté dans
 * layout.tsx, qui ne remonte pas, lui) et disponible de façon SYNCHRONE dès
 * le tout premier rendu de ce composant : plus de requête ici, plus de flash.
 */
export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const state = useSugubaStore();
  const [menuCompte, setMenuCompte] = useState(false);
  const [menuMobile, setMenuMobile] = useState(false);
  const [defile, setDefile] = useState(false);

  useEffect(() => {
    const surDefilement = () => setDefile(window.scrollY > 4);
    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => window.removeEventListener('scroll', surDefilement);
  }, []);

  // Mode sombre retiré : on remet en clair un téléphone qui l'avait activé.
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    try { localStorage.removeItem('suguba_theme'); } catch { /* stockage indisponible */ }
  }, []);

  const seDeconnecter = useCallback(async () => {
    setMenuCompte(false);
    setMenuMobile(false);
    await fetch('/api/auth/logout', { method: 'POST' });
    // Met à jour le store partagé tout de suite : BottomNav (et tout le
    // reste de l'app) le lit en direct, sans attendre un rechargement.
    sugubaStore.definirUtilisateur(null);
    router.push('/');
  }, [router]);

  useEffect(() => {
    if (!menuCompte) return;
    const surClic = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-menu-compte]')) setMenuCompte(false);
    };
    document.addEventListener('click', surClic);
    return () => document.removeEventListener('click', surClic);
  }, [menuCompte]);

  // id vide = personne connue pour l'instant (visiteur, ou identité pas
  // encore résolue lors du tout premier chargement de l'app).
  const connecte = Boolean(state.currentUser.id);
  const conf = connecte ? roleConfig[state.currentUser.role as UserRole] : null;
  const IconeRole = conf?.icon;
  const prenom = state.currentUser.fullName?.trim().split(/\s+/)[0] || '';
  // Sans nom au profil, « Mon compte » : le rôle est déjà écrit juste dessous.
  const nomAffiche = prenom || 'Mon compte';

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 border-b border-slate-100 ${
        defile ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-white'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">

          {/* Logo — c'est le libellé qui cède (min-w-0), jamais les commandes. */}
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden shrink-0">
              <Image src="/images/logo.png" alt="Logo Suguba" fill className="object-contain" priority />
            </div>
            <span className="text-lg font-black tracking-tight text-slate-900 whitespace-nowrap">SUGUBA</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm ml-4">
            {connecte && conf && IconeRole ? (
              <Link
                href={conf.path}
                className={`px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-colors ${
                  pathname.startsWith(conf.path) && conf.path !== '/'
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <IconeRole className="w-4 h-4" />
                Mon espace {conf.label.toLowerCase()}
              </Link>
            ) : (
              <Link
                href="/rejoindre"
                className="px-3 py-2 rounded-xl font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
              >
                <UserCheck className="w-4 h-4 text-suguba-brand" />
                Gagner avec Suguba
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            {!connecte ? (
              <Link
                href="/login"
                className="flex items-center gap-1.5 h-10 px-4 rounded-2xl text-sm font-bold bg-suguba-brand text-white hover:bg-suguba-brand-dark transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Se connecter
              </Link>
            ) : (
              <div className="relative hidden sm:block" data-menu-compte>
                <button
                  onClick={() => setMenuCompte(!menuCompte)}
                  className="flex items-center gap-2 pl-1 pr-2.5 h-10 rounded-2xl hover:bg-slate-50 transition-colors"
                  aria-expanded={menuCompte}
                  aria-haspopup="menu"
                >
                  <span className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                    {IconeRole && <IconeRole className="w-4 h-4" />}
                  </span>
                  <span className="leading-tight text-left">
                    <span className="block text-sm font-bold text-slate-900">{nomAffiche}</span>
                    <span className="block text-[11px] text-slate-500">{conf?.label}</span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${menuCompte ? 'rotate-180' : ''}`} />
                </button>
                {menuCompte && (
                  <div role="menu" className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-float border border-slate-100 p-1.5 z-50 animate-slide-down">
                    <Link href={conf?.path || '/'} onClick={() => setMenuCompte(false)} role="menuitem"
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-50">
                      {IconeRole && <IconeRole className="w-4 h-4 text-slate-400" />}
                      Mon espace
                    </Link>
                    <button onClick={seDeconnecter} role="menuitem"
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm text-slate-700 hover:bg-slate-50">
                      <LogOut className="w-4 h-4 text-slate-400" />
                      Se déconnecter
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              className="md:hidden w-10 h-10 shrink-0 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
              onClick={() => setMenuMobile(!menuMobile)}
              aria-label={menuMobile ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={menuMobile}
            >
              {menuMobile ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {menuMobile && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1 animate-slide-down">
          {connecte && conf && IconeRole ? (
            <>
              <div className="px-3 py-2">
                <p className="text-sm font-black text-slate-900">{nomAffiche}</p>
                <p className="text-[11px] text-slate-500">{conf.label}</p>
              </div>
              <Link href={conf.path} onClick={() => setMenuMobile(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-100 text-slate-900 font-semibold">
                <IconeRole className="w-4 h-4" />
                Mon espace
              </Link>
              <button onClick={seDeconnecter}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-700 hover:bg-slate-50">
                <LogOut className="w-4 h-4" />
                Se déconnecter
              </button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMenuMobile(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl bg-suguba-brand text-white font-bold">
                <LogIn className="w-4 h-4" />
                Se connecter
              </Link>
              <Link href="/rejoindre" onClick={() => setMenuMobile(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-100 text-slate-800 font-semibold">
                <UserCheck className="w-4 h-4" />
                Gagner avec Suguba
              </Link>
            </>
          )}

          {/* Liens légaux : leur seul chemin sur mobile (le pied de page est
              réservé à l'accueil sur ordinateur). */}
          <div className="pt-3 mt-1 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 text-[11px] text-slate-500">
              <Link href="/legal/terms" onClick={() => setMenuMobile(false)} className="hover:text-slate-700">Conditions</Link>
              <Link href="/legal/privacy" onClick={() => setMenuMobile(false)} className="hover:text-slate-700">Confidentialité</Link>
              <Link href="/legal/warranty" onClick={() => setMenuMobile(false)} className="hover:text-slate-700">Garantie &amp; SAV</Link>
            </div>
            <p className="px-3 mt-1.5 text-[11px] text-slate-500">
              Suguba Technologies Mali · <a href="tel:+22389460000" className="hover:text-slate-700">+223 89 46 00 00</a>
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
