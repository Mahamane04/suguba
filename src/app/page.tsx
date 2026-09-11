'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import Button from '@/components/ui/Button';
import ProductCard, { carteDepuisProduit } from '@/components/product/ProductCard';
import { useSugubaStore, useCatalogueCharge } from '@/lib/store';
import {
  ArrowRight, Search, Banknote,
  ShieldCheck, Truck, TrendingUp, X
} from 'lucide-react';

/* Page d'accueil réorganisée le 2026-09-09 en vitrine produit.
 *
 * Avant : grand hero « Gagnez des revenus sans stock », 4 cartes de rôles,
 * bandeau de statistiques, « Comment ça marche en 4 étapes », puis encore 4
 * cartes de rôles — et le catalogue tout en bas, après ~5 écrans de défilement.
 * Un client venu acheter ne voyait aucun produit sans scroller ; un visiteur
 * curieux voyait un argumentaire de recrutement avant de savoir ce qui est
 * vendu.
 *
 * Maintenant : recherche + produits immédiatement, et tout le discours
 * partenaire (revendeur / fournisseur / livreur / diaspora) déplacé sur
 * /rejoindre, expliqué étape par étape. Le produit d'abord, le recrutement
 * ensuite — le modèle Alibaba. */

export default function HomePage() {
  const state = useSugubaStore();
  const catalogueCharge = useCatalogueCharge();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Prix > 0 en plus du statut : un produit sans prix n'est pas en vente, même
  // si la mémoire locale du téléphone le croit « approuvé » (bug du 2026-09-11,
  // partage à « 0 F » vers un lien « Produit introuvable »).
  const approvedProducts = state.products.filter(p => p.status === 'approved' && p.publicPrice > 0);
  const categories = ['all', ...Array.from(new Set(approvedProducts.map(p => p.category)))];

  const requete = search.trim().toLowerCase();
  const filteredProducts = approvedProducts.filter((p) => {
    const bonneCategorie = selectedCategory === 'all' || p.category === selectedCategory;
    const correspond = !requete
      || p.name.toLowerCase().includes(requete)
      || p.description.toLowerCase().includes(requete)
      || p.category.toLowerCase().includes(requete);
    return bonneCategorie && correspond;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8f5] pb-20 md:pb-0">
      <Header />

      <main className="flex-1">

        {/* ══════════════════════════════════════════════
            BANDEAU DE RECHERCHE — compact, le produit d'abord
        ══════════════════════════════════════════════ */}
        <section className="bg-[#064e3b] px-4 sm:px-6 py-6 sm:py-8">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="text-center">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Achetez à Bamako, payez à la livraison
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/70 mt-1">
                Commande en 1 minute, sans créer de compte. Livraison 24h.
              </p>
            </div>

            {/* Recherche */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un produit (ventilateur, téléphone, solaire...)"
                className="w-full pl-11 pr-10 py-3.5 rounded-full bg-white text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#09b500]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Effacer la recherche"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Catégories */}
            {categories.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-[#09b500] text-white'
                        : 'bg-white/10 border border-white/15 text-emerald-100/80 hover:bg-white/20'
                    }`}
                  >
                    {cat === 'all' ? 'Tous les produits' : cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            CATALOGUE — immédiatement sous la recherche
        ══════════════════════════════════════════════ */}
        <section className="py-6 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">

            {approvedProducts.length === 0 && !catalogueCharge ? (
              // Squelettes pendant le chargement : l'écran « catalogue en
              // cours de constitution » s'affichait une seconde à chaque visite.
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4" aria-busy="true" aria-label="Chargement des produits">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-3xl border border-slate-100 overflow-hidden animate-pulse">
                    <div className="aspect-square bg-slate-200" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 w-4/5 rounded bg-slate-200" />
                      <div className="h-4 w-1/2 rounded bg-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : approvedProducts.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-10 text-center space-y-2">
                <p className="text-sm font-black text-slate-900">Catalogue en cours de constitution</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Nos fournisseurs partenaires référencent actuellement leurs produits.
                  Revenez très bientôt pour découvrir les premiers articles.
                </p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-10 text-center space-y-2">
                <p className="text-sm font-black text-slate-900">Aucun produit ne correspond</p>
                <p className="text-xs text-slate-500">
                  Essayez un autre mot, ou parcourez toutes les catégories.
                </p>
                <Button
                  variant="secondary"
                  size="md"
                  className="mt-2"
                  onClick={() => { setSearch(''); setSelectedCategory('all'); }}
                >
                  Voir tout le catalogue
                </Button>
              </div>
            ) : (
              // Carte produit commune (2026-09-11) : deux colonnes sur
              // téléphone comme les grandes places de marché, plusieurs
              // photos à balayer, partage WhatsApp en un clic.
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredProducts.map((product, i) => (
                  <ProductCard key={product.id} produit={carteDepuisProduit(product)} priority={i < 4} />
                ))}
              </div>
            )}

          </div>
        </section>

        {/* ══════════════════════════════════════════════
            DEVENIR PARTENAIRE — discret, une seule porte d'entrée
        ══════════════════════════════════════════════ */}
        <section className="py-6 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/rejoindre"
              className="block bg-white rounded-3xl border border-slate-100 shadow-card p-5 sm:p-6 hover:shadow-card-hover transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-suguba-50 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5 text-suguba-brand" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-black text-sm sm:text-base text-slate-900">
                    Gagner de l&apos;argent avec Suguba
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Revendeur, fournisseur ou livreur — voir comment ça marche et combien ça rapporte.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-suguba-brand group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            RÉASSURANCE CLIENT
        ══════════════════════════════════════════════ */}
        <section className="pb-8 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-card">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    icon: Banknote,
                    title: 'Payez à la livraison',
                    desc: 'Espèces ou Mobile Money, seulement quand le livreur arrive chez vous.',
                    color: 'text-suguba-brand',
                    bg: 'bg-suguba-50',
                  },
                  {
                    icon: Truck,
                    title: 'Livraison 24h à Bamako',
                    desc: 'Suivi de votre commande du dépôt jusqu\'à votre porte.',
                    color: 'text-suguba-brand',
                    bg: 'bg-suguba-50',
                  },
                  {
                    icon: ShieldCheck,
                    title: 'Code secret à la remise',
                    desc: 'Vous ne donnez votre code qu\'après avoir vérifié le colis.',
                    color: 'text-suguba-brand',
                    bg: 'bg-suguba-50',
                  },
                ].map(({ icon: Icon, title, desc, color, bg }) => (
                  <div key={title} className="flex gap-3 items-start">
                    <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
