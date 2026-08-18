'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { UserRole } from '@/types';
import { 
  ShoppingBag, Shield, Truck, Store, UserCheck, 
  ChevronDown, RefreshCw, Smartphone, Menu, X, ArrowUpRight
} from 'lucide-react';

export default function Header() {
  const state = useSugubaStore();
  const pathname = usePathname();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentUser = state.currentUser;

  const roleConfig: Record<UserRole, { label: string; color: string; bg: string; icon: any; path: string }> = {
    reseller: {
      label: 'Revendeur',
      color: 'text-emerald-700',
      bg: 'bg-emerald-100 border-emerald-300',
      icon: Store,
      path: '/reseller',
    },
    supplier: {
      label: 'Fournisseur',
      color: 'text-blue-700',
      bg: 'bg-blue-100 border-blue-300',
      icon: ShoppingBag,
      path: '/supplier',
    },
    driver: {
      label: 'Livreur',
      color: 'text-amber-700',
      bg: 'bg-amber-100 border-amber-300',
      icon: Truck,
      path: '/driver',
    },
    admin: {
      label: 'Suguba Master (Admin)',
      color: 'text-purple-700',
      bg: 'bg-purple-100 border-purple-300',
      icon: Shield,
      path: '/admin',
    },
    customer: {
      label: 'Client Direct',
      color: 'text-slate-700',
      bg: 'bg-slate-100 border-slate-300',
      icon: UserCheck,
      path: '/p/smart-tv-samsung-43',
    },
  };

  const handleRoleChange = (role: UserRole) => {
    sugubaStore.switchRole(role);
    setRoleDropdownOpen(false);
  };

  const CurrentRoleIcon = roleConfig[currentUser.role]?.icon || Store;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-green-700 flex items-center justify-center text-white font-black text-xl shadow-md shadow-emerald-600/20">
                S
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-slate-900 flex items-center">
                  SUGUBA<span className="text-emerald-600 font-bold ml-0.5">.ML</span>
                </span>
                <span className="text-[10px] block font-semibold text-slate-600 uppercase tracking-widest -mt-1">
                  Vendre Sans Stock
                </span>
              </div>
            </Link>
          </div>

          {/* Role Switcher & Live Profile Selector (Crucial for Pairing & SaaS Multi-Persona) */}
          <div className="relative">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-xs transition-all ${
                roleConfig[currentUser.role]?.bg || 'bg-slate-100 border-slate-300'
              }`}
            >
              <CurrentRoleIcon className={`w-3.5 h-3.5 ${roleConfig[currentUser.role]?.color}`} />
              <span className={roleConfig[currentUser.role]?.color}>
                {roleConfig[currentUser.role]?.label}
              </span>
              <span className="text-slate-400">|</span>
              <span className="font-bold text-slate-800 max-w-[100px] sm:max-w-none truncate">
                {currentUser.fullName.split(' ')[0]}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {/* Dropdown Menu */}
            {roleDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Changer d&apos;espace / rôle :
                  </p>
                </div>
                <div className="p-1 space-y-1">
                  {(['reseller', 'supplier', 'driver', 'admin'] as UserRole[]).map((role) => {
                    const conf = roleConfig[role];
                    const Icon = conf.icon;
                    const isActive = currentUser.role === role;
                    return (
                      <button
                        key={role}
                        onClick={() => handleRoleChange(role)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs font-medium transition-colors ${
                          isActive 
                            ? 'bg-emerald-50 text-emerald-900 font-bold' 
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <div className={`p-1.5 rounded-lg ${conf.bg}`}>
                            <Icon className={`w-4 h-4 ${conf.color}`} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{conf.label}</p>
                            <p className="text-[10px] text-slate-500">
                              {role === 'reseller' && 'Gains, WhatsApp & Retraits'}
                              {role === 'supplier' && 'Dépôt produits & Stock'}
                              {role === 'driver' && 'Courses & OTP Livraison'}
                              {role === 'admin' && 'Modération & Opérations'}
                            </p>
                          </div>
                        </div>
                        {isActive && (
                          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="px-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => {
                      sugubaStore.resetDemoData();
                      setRoleDropdownOpen(false);
                    }}
                    className="flex items-center space-x-1.5 text-[11px] text-slate-500 hover:text-slate-800"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Réinitialiser la démo</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Portals Links (Desktop) */}
          <nav className="hidden md:flex items-center space-x-1 text-sm font-medium">
            <Link
              href="/reseller"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                pathname.startsWith('/reseller')
                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Espace Revendeur
            </Link>
            <Link
              href="/supplier"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                pathname.startsWith('/supplier')
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Espace Fournisseur
            </Link>
            <Link
              href="/driver"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                pathname.startsWith('/driver')
                  ? 'bg-amber-50 text-amber-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Espace Livreur
            </Link>
            <Link
              href="/admin"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                pathname.startsWith('/admin')
                  ? 'bg-purple-50 text-purple-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Admin Ops
            </Link>
          </nav>

        </div>
      </div>
    </header>
  );
}
