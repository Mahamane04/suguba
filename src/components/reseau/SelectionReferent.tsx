'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Sparkles } from 'lucide-react';

/**
 * « La sélection de <revendeur> », en tête de l'accueil, pour un visiteur
 * arrivé par un revendeur (lien ?ref=, lien court /go/, QR code).
 *
 * Le code est mémorisé 30 jours dans le cookie `suguba_ref` (même cookie que
 * /go/<code>) : le client qui revient trois jours plus tard retrouve la
 * sélection de celui qui l'a invité, et sa commande lui reste attribuée.
 */

const COOKIE = 'suguba_ref';

function lireCookie(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)suguba_ref=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

interface Selection {
  nom: string;
  code: string;
  lienBoutique: string;
  produits: { slug: string; nom: string; prix: number; image: string | null }[];
}

export default function SelectionReferent() {
  const [selection, setSelection] = useState<Selection | null>(null);

  useEffect(() => {
    const parametre = new URLSearchParams(window.location.search).get('ref');
    const code = (parametre || lireCookie() || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,40}$/.test(code)) return;
    if (parametre) {
      document.cookie = `${COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    }
    fetch(`/api/reseau/referent?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((d) => setSelection(d.selection || null))
      .catch(() => undefined);
  }, []);

  if (!selection) return null;

  return (
    <section className="space-y-3" aria-labelledby="titre-selection-referent">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-suguba-brand-dark uppercase flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />Recommandé pour vous</p>
          <h2 id="titre-selection-referent" className="text-lg font-bold text-slate-900 truncate">La sélection de {selection.nom}</h2>
        </div>
        <Link href={selection.lienBoutique} className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-slate-700 min-h-[40px]">
          Tout voir <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto snap-x pb-1 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {selection.produits.map((p) => (
          <Link key={p.slug} href={`/p/${p.slug}?ref=${encodeURIComponent(selection.code)}`}
            className="snap-start shrink-0 w-36 bg-white rounded-3xl border border-slate-200 overflow-hidden active:scale-[0.98] transition-transform">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.image ? <img src={p.image} alt="" className="w-full aspect-square object-cover" loading="lazy" /> : <div className="w-full aspect-square bg-slate-100" />}
            <div className="p-2.5 space-y-0.5">
              <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight">{p.nom}</p>
              <p className="text-sm font-bold text-slate-900 tabular-nums">{p.prix.toLocaleString('fr-FR')} F</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
