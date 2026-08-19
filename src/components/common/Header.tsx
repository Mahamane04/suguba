'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { UserRole } from '@/types';
import {
  ShoppingBag, Shield, Truck, Store, UserCheck,
  ChevronDown, RefreshCw, Menu, X, Globe,
  Moon, Sun, Zap, Bell
} from 'lucide-react';

const roleConfig: Record<UserRole, {
  label: string;
  badge: string;
  icon: React.ElementType;
  path: string;
  accentBg: string;
  accentText: string;
  dotColor: string;
}> = {
  reseller: {
    label: 'Revendeur',
    badge: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    icon: Store,
    path: '/reseller',
    accentBg: 'bg-emerald-50',
    accentText: 'text-emerald-700',
    dotColor: 'bg-emerald-500',
  },
  supplier: {
    label: 'Fournisseur',
    badge: 'bg-blue-100 text-blue-800 border border-blue-200',
    icon: ShoppingBag,
    path: '/supplier',
    accentBg: 'bg-blue-50',
    accentText: 'text-blue-700',
    dotColor: 'bg-blue-500',
  },
  driver: {
    label: 'Livreur',
    badge: 'bg-amber-100 text-amber-800 border border-amber-200',
    icon: Truck,
    path: '/driver',
    accentBg: 'bg-amber-50',
    accentText: 'text-amber-700',
    dotColor: 'bg-amber-500',
  },
  admin: {
    label: 'Admin Ops',
    badge: 'bg-purple-100 text-purple-800 border border-purple-200',
    icon: Shield,
    path: '/admin',
    accentBg: 'bg-purple-50',
    accentText: 'text-purple-700',
    dotColor: 'bg-purple-500',
  },
  customer: {
    label: 'Client',
    badge: 'bg-slate-100 text-slate-800 border border-slate-200',
    icon: UserCheck,
    path: '/p/smart-tv-samsung-43',
    accentBg: 'bg-slate-50',
    accentText: 'text-slate-700',
    dotColor: 'bg-slate-500',
  },
};

const navLinks = [
  { href: '/reseller',  label: 'Revendeurs',   role: 'reseller' as UserRole },
  { href: '/supplier',  label: 'Fournisseurs',  role: 'supplier' as UserRole },
  { href: '/driver',    label: 'Livreurs',       role: 'driver'   as UserRole },
  { href: '/admin',     label: 'Admin',          role: 'admin'    as UserRole },
];

export default function Header() {
  const state = useSugubaStore();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const currentUser = state.currentUser;
  const conf = roleConfig[currentUser.role] ?? roleConfig.reseller;
  const CurrentIcon = conf.icon;

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

  const handleRoleChange = useCallback((role: UserRole) => {
    sugubaStore.switchRole(role);
    setDropdownOpen(false);
    setMobileOpen(false);
  }, []);

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

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-brand-sm group-hover:shadow-brand-md transition-shadow shrink-0">
              <Image 
                src="/images/logo.png" 
                alt="Logo Suguba" 
                fill 
                className="object-contain"
                priority
              />
            </div>
            <div className="leading-none">
              <span className="text-lg font-black tracking-tight text-gray-900">
                SUGUBA<span className="text-suguba-brand">.ML</span>
              </span>
              <span className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5">
                Vendre sans stock
              </span>
            </div>
          </Link>

          {/* ── Desktop Nav ── */}
          <nav className="hidden md:flex items-center gap-0.5 text-sm font-medium ml-4">
            {navLinks.map(({ href, label }) => {
              const isActive = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-gray-100 text-gray-900 font-semibold'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <Link
              href="/diaspora"
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                pathname.startsWith('/diaspora')
                  ? 'bg-suguba-brand text-white shadow-brand-sm'
                  : 'text-suguba-brand hover:bg-suguba-100 border border-suguba-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Diaspora
            </Link>
          </nav>

          {/* ── Right Actions ── */}
          <div className="flex items-center gap-2 ml-auto">

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

            {/* Role badge pill */}
            <div className="relative" data-role-dropdown>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                aria-expanded={dropdownOpen}
              >
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>{conf.label}</span>
                <ChevronDown className={`w-3 h-3 text-emerald-600 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-float border border-gray-100 py-1.5 z-50 animate-slide-down overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-50">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Changer d&apos;espace
                    </p>
                  </div>

                  <div className="p-1.5 space-y-0.5">
                    {(['reseller', 'supplier', 'driver', 'admin'] as UserRole[]).map((role) => {
                      const c = roleConfig[role];
                      const Icon = c.icon;
                      const isActive = currentUser.role === role;
                      return (
                        <button
                          key={role}
                          onClick={() => handleRoleChange(role)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                            isActive
                              ? `${c.accentBg} ${c.accentText} font-bold`
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isActive ? `bg-white shadow-xs` : 'bg-gray-100'
                          }`}>
                            <Icon className={`w-4 h-4 ${isActive ? c.accentText : 'text-gray-500'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${isActive ? c.accentText : 'text-gray-900'}`}>
                              {c.label}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate">
                              {role === 'reseller' && 'Gains, WhatsApp & Retraits'}
                              {role === 'supplier' && 'Dépôt produits & Stock'}
                              {role === 'driver'   && 'Courses & OTP Livraison'}
                              {role === 'admin'    && 'Modération & Opérations'}
                            </p>
                          </div>
                          {isActive && (
                            <span className={`w-2 h-2 rounded-full ${c.dotColor} shrink-0`} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="px-4 py-2.5 border-t border-gray-50">
                    <button
                      onClick={() => { sugubaStore.resetDemoData(); setDropdownOpen(false); }}
                      className="flex items-center gap-2 text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Réinitialiser la démo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button 
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  3
                </span>
              </button>
            </div>

            {/* User Profile avatar */}
            <div className="hidden sm:flex items-center gap-2 pl-1">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center border-2 border-emerald-500">
                {currentUser.fullName.charAt(0)}
              </div>
              <div className="leading-none text-left">
                <p className="text-xs font-bold text-gray-900">{currentUser.fullName.split(' ')[0]}</p>
                <p className="text-[10px] text-gray-400 capitalize">{conf.label}</p>
              </div>
            </div>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
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
          {navLinks.map(({ href, label, role }) => {
            const c = roleConfig[role];
            const Icon = c.icon;
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? `${c.accentBg} ${c.accentText} font-semibold`
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
          <Link
            href="/diaspora"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-suguba-50 text-suguba-brand font-semibold"
          >
            <Globe className="w-4 h-4" />
            Espace Diaspora
          </Link>
        </div>
      )}
    </header>
  );
}
