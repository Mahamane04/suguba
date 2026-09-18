'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { usePanier } from '@/lib/panier';

/** Accès au panier dans l'en-tête — n'apparaît que s'il contient quelque chose. */
export default function IconePanier() {
  const articles = usePanier();
  const total = articles.reduce((s, a) => s + a.quantity, 0);
  if (total === 0) return null;
  return (
    <Link
      href="/panier"
      aria-label={`Panier : ${total} article${total > 1 ? 's' : ''}`}
      className="relative w-10 h-10 shrink-0 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
    >
      <ShoppingBag className="w-5 h-5" />
      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-suguba-brand text-white text-[10px] font-black flex items-center justify-center tabular-nums">
        {total > 9 ? '9+' : total}
      </span>
    </Link>
  );
}
