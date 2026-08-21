'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { UserRole } from '@/types';
import {
  ShoppingBag, Shield, Truck, Store, UserCheck,
  ChevronDown, LogOut, Menu, X, Globe,
  Moon, Sun, Bell, LogIn
} from 'lucide-react';

const roleConfig: Record<UserRole, {
  label: string;
  icon: React.ElementType;
  path: string;
  accentBg: string;
  accentText: string;
}> = {
  reseller: { label: 'Revendeur', icon: Store, path: '/reseller', accentBg: 'bg-emerald-50', accentText: 'text-emerald-700' },
  supplier: { label: 'Fournisseur', icon: ShoppingBag, path: '/supplier', accentBg: 'bg-blue-50', accentText: 'text-blue-700' },
  driver: { label: 'Livreur', icon: Truck, path: '/driver', accentBg: 'bg-amber-50', accentText: 'text-amber-700' },
  admin: { label: 'Admin Ops', icon: Shield, path: '/admin', accentBg: 'bg-purple-50', accentText: 'text-purple-700' },
  customer: { label: 'Client', icon: UserCheck, path: '/', accentBg: 'bg-slate-50', accentText: 'text-slate-700' },
  diaspora: { label: 'Diaspora', icon: Globe, path: '/diaspora', accentBg: 'bg-purple-50', accentText: 'text-purple-700' },
};

interface AuthState {
  authenticated: boolean;
  role?: UserRole;
  phone?: string;
  status?: string;
}

/**
 * Corrige un problème de confiance signalé par un visiteur réel : le header
 * affichait un compte "Moussa Revendeur" et des liens vers les 5 tableaux
 * de bord (Revendeurs/Fournisseurs/Livreurs/Admin/Diaspora) à n'importe qui,
 * sans la moindre connexion — un reliquat du store de démo local
 * (sugubaStore.currentUser), sans rapport avec la vraie session. Un
 * visiteur anonyme ne voit plus désormais qu'un bouton "Se connecter" ; un
 * compte authentifié ne voit que SON espace, avec sa vraie identité (voir
 * /api/auth/me).
 */
export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .then(setAuth)
      .catch(() => setAuth({ authenticated: false }));
  }, [pathname]);

  /* Scroll shadow effect */
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* Restore saved theme */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('suguba_theme');
      if (saved === 'dark') {
        setIsDark(true);
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  const toggleDark = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('suguba_theme', next ? 'dark' : 'light');
  }, [isDark]);

  const handleLogout = useCallback(async () => {
    setDropdownOpen(false);
    setMobileOpen(false);
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuth({ authenticated: false });
    router.push('/');
  }, [router]);

  /* Close dropdown on outside click */
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-role-dropdown]')) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [dropdownOpen]);

  const isAuthenticated = Boolean(auth?.authenticated && auth.role);
  const conf = isAuthenticated ? roleConfig[auth!.role as UserRole] : null;
  const CurrentIcon = conf?.icon;

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100'
          : 'bg-white border-b border-gray-100'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">

          {/* ── Logo ──
              Le bloc portait shrink-0 : combiné à des boutons d'action eux
              aussi incompressibles, la rangée dépassait la largeur d'un iPhone
              (375px) et poussait le bouton Menu hors de l'écran. C'est le
              libellé de marque qui cède désormais (min-w-0 + truncate) plutôt
              que les commandes, qui doivent rester atteignables. */}
          <Link href="/" className="flex items-center gap-2.5 min-w-0 group">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-brand-sm group-hover:shadow-brand-md transition-shadow shrink-0">
              <Image
                src="/images/logo.png"
                alt="Logo Suguba"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="leading-none min-w-0">
              {/* Le suffixe de domaine « .ML » tombe sous 640px : il coûtait
                  21px de plus que la place disponible et faisait rogner le nom
                  en « SUGUBA.M ». Masquer le domaine se lit comme un choix,
                  une marque coupée se lit comme un bug. */}
              <span className="block text-lg font-black tracking-tight text-gray-900 whitespace-nowrap">
                SUGUBA<span className="hidden sm:inline text-suguba-brand">.ML</span>
              </span>
              {/* Baseline masquée sous 640px : elle réclame 113px à elle seule
                  (mesuré), soit plus que le nom de marque, et forçait la
                  troncature du logo en « SUGU… » sur iPhone. Purement
                  décorative, elle revient dès qu'il y a la place. */}
              <span className="hidden sm:block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5 truncate">
                Vendre sans stock
              </span>
            </div>
          </Link>

          {/* ── Desktop Nav — uniquement l'espace du compte connecté, jamais tous les tableaux de bord ── */}
          <nav className="hidden md:flex items-center gap-0.5 text-sm font-medium ml-4">
            {isAuthenticated && conf && CurrentIcon && (
              <Link
                href={conf.path}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  pathname.startsWith(conf.path)
                    ? `${conf.accentBg} ${conf.accentText}`
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <CurrentIcon className="w-3.5 h-3.5" />
                Mon espace {conf.label}
              </Link>
            )}
            {!isAuthenticated && (
              <Link
                href="/register"
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  pathname.startsWith('/register')
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-suguba-brand" />
                Devenir Revendeur / Fournisseur / Livreur
              </Link>
            )}
          </nav>

          {/* ── Right Actions ──
              shrink-0 : ce bloc était comprimé sous la largeur de son contenu,
              si bien que le bouton Menu débordait de l'écran sur iPhone. Ce
              sont les commandes qui doivent garder leur taille ; c'est le
              libellé de marque à gauche qui se tronque (voir le bloc Logo). */}
          <div className="flex items-center gap-2 ml-auto shrink-0">

            {/* Dark mode */}
            <button
              onClick={toggleDark}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors shrink-0"
              aria-label="Mode sombre"
            >
              {isDark
                ? <Sun className="w-4 h-4 text-amber-500" />
                : <Moon className="w-4 h-4" />
              }
            </button>

            {!isAuthenticated ? (
              /* ── Visiteur anonyme : juste "Se connecter" ── */
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-full text-xs font-bold bg-suguba-brand text-white hover:bg-suguba-brand-dark transition-colors shrink-0"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                Se connecter
              </Link>
            ) : (
              <>
                {/* Notification Bell — seulement pour un compte réel */}
                <div className="relative">
                  <button
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
                    aria-label="Notifications"
                  >
                    <Bell className="w-4 h-4" />
                  </button>
                </div>

                {/* Identité + menu compte */}
                <div className="relative" data-role-dropdown>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="hidden sm:flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center border-2 border-emerald-500 shrink-0">
                      {CurrentIcon && <CurrentIcon className="w-3.5 h-3.5" />}
                    </div>
                    <div className="leading-none text-left">
                      <p className="text-xs font-bold text-gray-900">{auth?.phone}</p>
                      <p className="text-[10px] text-gray-400">{conf?.label}</p>
                    </div>
                    <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-float border border-gray-100 py-1.5 z-50 animate-slide-down overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-gray-50">
                        <p className="text-xs font-bold text-gray-900">{auth?.phone}</p>
                        <p className="text-[10px] text-gray-400">{conf?.label}</p>
                      </div>
                      <div className="p-1.5">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4 text-gray-400" />
                          Se déconnecter
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Mobile menu toggle — shrink-0 indispensable : sans lui le flex
                comprimait ce bouton à 16px de large sur iPhone (mesuré), sous
                le minimum de 24px de WCAG 2.5.8, alors que w-8 en promet 32.
                Les autres boutons ronds de ce header le portent déjà. */}
            <button
              className="md:hidden w-8 h-8 shrink-0 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Menu ── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1 animate-slide-down">
          {isAuthenticated && conf && CurrentIcon ? (
            <>
              <Link
                href={conf.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${conf.accentBg} ${conf.accentText} font-semibold`}
              >
                <CurrentIcon className="w-4 h-4" />
                Mon espace {conf.label}
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-gray-50"
              >
                <LogOut className="w-4 h-4" />
                Se déconnecter ({auth?.phone})
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-suguba-brand text-white font-bold"
              >
                <LogIn className="w-4 h-4" />
                Se connecter
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold"
              >
                <UserCheck className="w-4 h-4" />
                Devenir Revendeur / Fournisseur / Livreur
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
