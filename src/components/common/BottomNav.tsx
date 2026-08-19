'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Grid3X3, ShoppingCart, Wallet, TrendingUp,
  PackagePlus, ListOrdered, ShieldCheck, Truck
} from 'lucide-react';
import { useSugubaStore } from '@/lib/store';

type NavItem = { label: string; href: string; icon: React.ElementType };

function getNavItems(role: string): NavItem[] {
  switch (role) {
    case 'reseller':
      return [
        { label: 'Accueil',     href: '/reseller',           icon: Home        },
        { label: 'Catalogue',   href: '/reseller/catalog',   icon: Grid3X3     },
        { label: 'Ventes',      href: '/reseller/orders',    icon: ShoppingCart},
        { label: 'Gains',       href: '/reseller/payouts',   icon: Wallet      },
        { label: 'Marketing',   href: '/reseller/marketing', icon: TrendingUp  },
      ];
    case 'supplier':
      return [
        { label: 'Dashboard',   href: '/supplier',              icon: Home       },
        { label: 'Produits',    href: '/supplier/products',     icon: Grid3X3    },
        { label: 'Ajouter',     href: '/supplier/products/new', icon: PackagePlus},
        { label: 'Commandes',   href: '/supplier/orders',       icon: ListOrdered},
      ];
    case 'driver':
      return [
        { label: 'Courses',     href: '/driver',         icon: Truck      },
        { label: 'Historique',  href: '/driver/history', icon: ListOrdered},
      ];
    case 'admin':
      return [
        { label: 'Vue globale', href: '/admin',          icon: Home       },
        { label: 'Modération',  href: '/admin/products', icon: ShieldCheck},
        { label: 'Commandes',   href: '/admin/orders',   icon: ShoppingCart},
        { label: 'Retraits',    href: '/admin/payouts',  icon: Wallet     },
      ];
    default:
      return [];
  }
}

export default function BottomNav() {
  const pathname = usePathname();
  const { currentUser } = useSugubaStore();
  const navItems = getNavItems(currentUser.role);

  if (navItems.length === 0) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Glass background */}
      <div className="mx-2 mb-2 bg-white/90 backdrop-blur-xl rounded-2xl border border-gray-100 shadow-float">
        <div className={`flex items-center justify-around px-1 h-16`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/reseller' &&
               item.href !== '/supplier' &&
               item.href !== '/driver' &&
               item.href !== '/admin' &&
               pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-suguba-brand'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <div className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-suguba-50 shadow-brand-sm'
                    : ''
                }`}>
                  {isActive && (
                    <span className="absolute inset-0 rounded-xl bg-suguba-brand/10 animate-pulse" />
                  )}
                  <Icon
                    className={`w-4.5 h-4.5 relative z-10 transition-all ${
                      isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'
                    }`}
                    style={{ width: '1.125rem', height: '1.125rem' }}
                  />
                </div>
                <span
                  className={`text-[10px] mt-0.5 tracking-tight font-medium truncate max-w-[56px] leading-none transition-all ${
                    isActive ? 'font-bold' : ''
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
