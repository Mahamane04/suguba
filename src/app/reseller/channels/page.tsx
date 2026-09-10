'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { ArrowLeft, Store, ExternalLink, Copy, Check, Loader2 } from 'lucide-react';

interface BoutiqueFournisseur {
  nom: string;
  categorie: string | null;
  slug: string;
  articles: number;
}

/**
 * Boutiques des fournisseurs, à partager par le revendeur.
 *
 * Remplace les « Canaux de grandes marques partenaires », qui présentaient à
 * de vrais revendeurs quatre entreprises INVENTÉES — « BATIMAT MALI »,
 * « DIARRA ÉLECTRONIQUE », « BAZIN PRESTIGE », « SOLAIRE MALI » — avec des
 * chiffres fabriqués (« 142 promoteurs actifs ») et des fourchettes de
 * commission que rien ne garantissait. Présenter de faux partenaires comme
 * réels est trompeur, et d'autant plus que le revendeur y engage sa crédibilité
 * auprès de ses propres contacts.
 *
 * Chaque lien porte le code du revendeur : une vente passée depuis la boutique
 * d'un fournisseur lui est attribuée.
 */
export default function BoutiquesFournisseursPage() {
  const [boutiques, setBoutiques] = useState<BoutiqueFournisseur[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [copie, setCopie] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/shops/suppliers').then((r) => (r.ok ? r.json() : { boutiques: [] })),
      fetch('/api/reseller/me').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([liste, moi]) => {
        setBoutiques(liste.boutiques || []);
        setCode(moi?.reseller?.referralCode || null);
      })
      .catch(() => setBoutiques([]))
      .finally(() => setChargement(false));
  }, []);

  const lien = (slug: string) => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://app.sugubaml.com';
    return `${base}/s/${slug}${code ? `?ref=${encodeURIComponent(code)}` : ''}`;
  };

  const copier = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(lien(slug));
      setCopie(slug);
      setTimeout(() => setCopie(null), 2000);
    } catch {
      // Presse-papiers refusé : le bouton « Voir » reste utilisable.
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        <div className="space-y-1">
          <Link href="/reseller" className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" /><span>Retour à l&apos;espace revendeur</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center space-x-2">
            <Store className="w-6 h-6 text-emerald-600" /><span>Boutiques fournisseurs</span>
          </h1>
          <p className="text-xs text-slate-500">
            Partagez la boutique complète d&apos;un fournisseur : toute vente passée depuis votre lien vous est attribuée.
          </p>
        </div>

        {chargement ? (
          <div className="flex items-center space-x-2 text-xs text-slate-500 py-8">
            <Loader2 className="w-4 h-4 animate-spin" /><span>Chargement…</span>
          </div>
        ) : boutiques.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-2">
            <Store className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Aucune boutique fournisseur pour l&apos;instant</p>
            <p className="text-xs text-slate-500">
              En attendant, composez votre propre boutique depuis le{' '}
              <Link href="/reseller/catalog" className="font-bold text-emerald-700 underline">catalogue</Link>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {boutiques.map((b) => (
              <div key={b.slug} className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-black text-xl shrink-0">
                    {b.nom.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-sm text-slate-900 truncate">{b.nom}</h3>
                    <p className="text-[11px] text-slate-500">
                      {b.articles} article{b.articles > 1 ? 's' : ''} en vente{b.categorie ? ` · ${b.categorie}` : ''}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a href={lien(b.slug)} target="_blank" rel="noopener noreferrer"
                    className="h-11 rounded-2xl bg-slate-900 hover:bg-black text-white text-xs font-black flex items-center justify-center space-x-1.5">
                    <ExternalLink className="w-4 h-4" /><span>Voir</span>
                  </a>
                  <button type="button" onClick={() => copier(b.slug)}
                    className="h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black flex items-center justify-center space-x-1.5">
                    {copie === b.slug ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copie === b.slug ? 'Lien copié' : 'Copier mon lien'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
