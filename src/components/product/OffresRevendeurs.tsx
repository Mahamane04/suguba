'use client';

import Link from 'next/link';
import { Users } from 'lucide-react';

export interface OffreRevendeurVue { nom: string; code: string; prix: number }

/**
 * Offres des revendeurs pour un article au prix de gros (lot C, 2026-09-26).
 * Chaque revendeur fixe son prix ; le client choisit une offre et commande
 * par la fiche de ce revendeur (?ref=), qui lui sera attribuée.
 */
export default function OffresRevendeurs({ slug, offres, id }: { slug: string; offres: OffreRevendeurVue[]; id?: string }) {
  return (
    <div id={id} className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2 scroll-mt-28">
      <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
        <Users className="w-4 h-4 text-suguba-profond" aria-hidden /> Vendu par nos revendeurs partenaires
      </p>
      <p className="text-xs text-slate-600">Chaque revendeur fixe son prix. Choisissez une offre : il vous accompagne jusqu’à la livraison.</p>
      <ul className="divide-y divide-slate-100">
        {offres.map((o) => (
          <li key={o.code} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900 truncate">{o.nom}</span>
              <span className="block text-sm font-bold text-suguba-brand-dark tabular-nums">{Math.round(o.prix).toLocaleString('fr-FR')} F</span>
            </span>
            <Link href={`/p/${slug}?ref=${encodeURIComponent(o.code)}`}
              className="shrink-0 h-10 px-4 rounded-2xl bg-suguba-profond hover:bg-suguba-profond-2 text-white text-xs font-bold inline-flex items-center">
              Choisir cette offre
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
