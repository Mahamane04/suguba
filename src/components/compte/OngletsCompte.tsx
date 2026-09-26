'use client';

import Link from 'next/link';

const ONGLETS = [
  { href: '/compte/commandes', libelle: 'Commandes' },
  { href: '/compte/favoris', libelle: 'Favoris' },
  { href: '/compte/destinataires', libelle: 'Destinataires' },
];

/** Navigation de l'espace client (C2) : trois onglets, pas davantage. */
export default function OngletsCompte({ actif }: { actif: string }) {
  return (
    <nav className="flex gap-2" aria-label="Mon compte">
      {ONGLETS.map((o) => (
        <Link key={o.href} href={o.href} aria-current={actif === o.href ? 'page' : undefined}
          className={`flex-1 h-10 rounded-2xl text-xs font-bold inline-flex items-center justify-center transition-colors ${
            actif === o.href ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
          {o.libelle}
        </Link>
      ))}
    </nav>
  );
}
