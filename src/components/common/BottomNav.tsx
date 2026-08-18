'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, Grid, ShoppingCart, Wallet, UserCircle, 
  PackagePlus, ListOrdered, ShieldCheck, Truck
} from 'lucide-react';
import { useSugubaStore } from '@/lib/store';

export default function BottomNav() {
  const pathname = usePathname();
  const state = useSugubaStore();
  const role = state.currentUser.role;

  // Configuration des onglets selon le rôle actif
  let navItems: { label: string; href: string; icon: any }[] = [];

  if (role === 'reseller') {
    navItems = [
      { label: 'Accueil', href: '/reseller', icon: Home },
      { label: 'Catalogue', href: '/reseller/catalog', icon: Grid },
      { label: 'Mes Ventes', href: '/reseller/orders', icon: ShoppingCart },
      { label: 'Commissions', href: '/reseller/payouts', icon: Wallet },
      { label: 'Marketing', href: '/reseller/marketing', icon: UserCircle },
    ];
  } else if (role === 'supplier') {
    navItems = [
      { label: 'Dashboard', href: '/supplier', icon: Home },
      { label: 'Mes Produits', href: '/supplier/products', icon: Grid },
      { label: 'Nouveau Produit', href: '/supplier/products/new', icon: PackagePlus },
      { label: 'Commandes', href: '/supplier/orders', icon: ListOrdered },
    ];
  } else if (role === 'driver') {
    navItems = [
      { label: 'Mes Courses', href: '/driver', icon: Truck },
      { label: 'Historique', href: '/driver/history', icon: ListOrdered },
    ];
  } else if (role === 'admin') {
    navItems = [
      { label: 'Vue Globale', href: '/admin', icon: Home },
      { label: 'Modération', href: '/admin/products', icon: ShieldCheck },
      { label: 'Commandes', href: '/admin/orders', icon: ShoppingCart },
      { label: 'Retraits', href: '/admin/payouts', icon: Wallet },
    ];
  }

  if (navItems.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 pb-safe md:hidden shadow-lg">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/reseller' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 text-center transition-all ${
                isActive ? 'text-emerald-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-emerald-600 stroke-[2.5]' : 'stroke-[1.75]'}`} />
              <span className="text-[10px] tracking-tight truncate max-w-[64px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
