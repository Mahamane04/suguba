'use client';

import React, { useEffect } from 'react';
import { Megaphone } from 'lucide-react';
import ProductCard, { carteDepuisProduit } from '@/components/product/ProductCard';
import { useSugubaStore } from '@/lib/store';
import { compterVues, useSponsorises } from '@/lib/sponsorises';

/**
 * « Produits sponsorisés » du tableau de bord revendeur (§ 17). N'apparaît
 * que s'il y en a : une section vide annonçant des produits mis en avant
 * ferait croire à une plateforme sans annonceurs.
 */
export default function SectionSponsorises() {
  const state = useSugubaStore();
  const sponsorises = useSponsorises('reseller_dashboard');
  const produits = state.products
    .filter((p) => sponsorises.has(p.id) && p.status === 'approved' && p.resellerCommission > 0)
    .slice(0, 6);
  const ids = produits.map((p) => sponsorises.get(p.id)!).join(',');
  useEffect(() => { if (ids) compterVues(ids.split(',')); }, [ids]);

  if (produits.length === 0) return null;
  return (
    <section className="space-y-3" aria-labelledby="titre-sponsorises">
      <h2 id="titre-sponsorises" className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
        <Megaphone className="w-4 h-4 text-slate-500" />Produits sponsorisés
      </h2>
      <div className="flex gap-3 overflow-x-auto snap-x pb-1 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {produits.map((p) => (
          <div key={p.id} className="snap-start shrink-0 w-44">
            <ProductCard produit={carteDepuisProduit(p)} afficherCommission partageEnAvant sponsorisationId={sponsorises.get(p.id)} />
          </div>
        ))}
      </div>
    </section>
  );
}
