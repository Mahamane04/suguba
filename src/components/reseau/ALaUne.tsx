'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useSugubaStore } from '@/lib/store';
import { compterClic, compterVues, useSponsorises } from '@/lib/sponsorises';

/**
 * Bandeau « À la une » de l'accueil — emplacement sponsorisé « home_hero ».
 * Un seul produit à la fois (le plus ancien actif), marqué « Sponsorisé ».
 * Absent s'il n'y a pas de sponsorisation active.
 */
export default function ALaUne() {
  const state = useSugubaStore();
  const sponsorises = useSponsorises('home_hero');
  const produit = state.products.find((p) => sponsorises.has(p.id) && p.status === 'approved' && p.publicPrice > 0);
  const id = produit ? sponsorises.get(produit.id)! : null;
  useEffect(() => { if (id) compterVues([id]); }, [id]);
  if (!produit || !id) return null;

  return (
    <Link
      href={`/p/${produit.slug}`}
      onClick={() => compterClic(id)}
      className="flex items-center gap-4 bg-white rounded-3xl border border-slate-200 p-3 hover:border-slate-300 active:scale-[0.99] transition-all"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {produit.images[0] ? <img src={produit.images[0]} alt="" className="w-20 h-20 rounded-2xl object-cover shrink-0" /> : <div className="w-20 h-20 rounded-2xl bg-slate-100 shrink-0" />}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[10px] font-bold text-slate-500 uppercase">À la une · Sponsorisé</p>
        <p className="text-sm font-black text-slate-900 line-clamp-2">{produit.name}</p>
        <p className="text-base font-black text-suguba-brand tabular-nums">{produit.publicPrice.toLocaleString('fr-FR')} F</p>
      </div>
      <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
    </Link>
  );
}
