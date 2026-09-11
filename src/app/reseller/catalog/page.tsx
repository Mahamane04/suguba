'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import CreateOrderModal from '@/components/reseller/CreateOrderModal';
import ProductCard, { carteDepuisProduit } from '@/components/product/ProductCard';
import Button from '@/components/ui/Button';
import { useSugubaStore } from '@/lib/store';
import { Product } from '@/types';
import { Search, Plus, Sparkles, Check, Store, ExternalLink } from 'lucide-react';

/**
 * Catalogue revendeur — refondu le 2026-09-11 sur la carte produit commune :
 * plusieurs photos, partage WhatsApp en un clic (photo + texte + lien), deux
 * colonnes sur téléphone. Le partage y est l'action principale : c'est le
 * métier du revendeur.
 */
export default function ResellerCatalogPage() {
  const state = useSugubaStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<Product | null>(null);

  // Code revendeur et sélection de la boutique /r/<code>.
  const [codeRevendeur, setCodeRevendeur] = useState<string | null>(null);
  const [maSelection, setMaSelection] = useState<Set<string>>(new Set());
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreurBoutique, setErreurBoutique] = useState('');

  useEffect(() => {
    fetch('/api/reseller/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.reseller?.referralCode && setCodeRevendeur(j.reseller.referralCode))
      .catch(() => {});
    fetch('/api/reseller/shop')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.articles && setMaSelection(new Set(j.articles)))
      .catch(() => {});
  }, []);

  const basculerBoutique = async (productId: string) => {
    setErreurBoutique('');
    setEnCours(productId);
    const dedans = maSelection.has(productId);
    try {
      const res = await fetch('/api/reseller/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, action: dedans ? 'retirer' : 'ajouter' }),
      });
      const json = await res.json();
      if (!res.ok) { setErreurBoutique(json.error || 'Action impossible.'); return; }
      setMaSelection((prev) => {
        const suivant = new Set(prev);
        if (dedans) suivant.delete(productId); else suivant.add(productId);
        return suivant;
      });
    } catch {
      setErreurBoutique('Erreur réseau.');
    } finally {
      setEnCours(null);
    }
  };

  // Seuls les produits qui rapportent une commission sont proposés au partage.
  // Un article sous le plancher ou à commission trop faible afficherait
  // « +0 F » : aucun sens pour un revendeur (voir src/lib/pricing.ts).
  const approvedProducts = state.products.filter(p => p.status === 'approved' && p.resellerCommission > 0);
  const categories = ['all', ...Array.from(new Set(approvedProducts.map(p => p.category)))];

  const recherche = searchTerm.trim().toLowerCase();
  const filtered = approvedProducts.filter(p => {
    const matchesSearch = !recherche || p.name.toLowerCase().includes(recherche) ||
                          p.description.toLowerCase().includes(recherche);
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full space-y-5">

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">Catalogue à partager</h1>
            <p className="text-xs text-slate-500">
              Un clic sur « Partager sur WhatsApp » envoie la photo, le prix et votre lien. Chaque vente livrée vous rapporte la commission affichée.
            </p>
          </div>
          <Button href="/reseller/marketing" variant="ghost" size="sm" className="self-start sm:self-auto">
            <Sparkles className="w-4 h-4" />
            <span>Studio affiches</span>
          </Button>
        </div>

        {/* Ma boutique : la vitrine publique composée depuis ce catalogue. */}
        {codeRevendeur && (
          <div className="bg-white border border-slate-200 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Store className="w-6 h-6 text-slate-700 shrink-0" />
              <div>
                <p className="text-sm font-black text-slate-900">Ma boutique — {maSelection.size} article{maSelection.size > 1 ? 's' : ''}</p>
                <p className="text-[11px] text-slate-500">
                  Ajoutez des articles ci-dessous, puis partagez votre boutique : chaque vente vous est attribuée.
                </p>
              </div>
            </div>
            <Button href={`/r/${codeRevendeur}`} target="_blank" variant="secondary" size="sm">
              <ExternalLink className="w-4 h-4" />
              <span>Voir ma boutique</span>
            </Button>
          </div>
        )}
        {erreurBoutique && (
          <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl p-3">{erreurBoutique}</p>
        )}

        {/* Recherche et catégories */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Rechercher un produit…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-suguba-brand/30 focus:border-suguba-brand"
            />
          </div>
          {categories.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cat === 'all' ? 'Tout' : cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            {approvedProducts.length === 0
              ? 'Le catalogue est en cours de remplissage. Les produits apparaîtront ici dès leur validation.'
              : 'Aucun produit ne correspond à votre recherche.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map((product, i) => (
              <ProductCard
                key={product.id}
                produit={carteDepuisProduit(product)}
                afficherCommission
                partageEnAvant
                priority={i < 4}
              >
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setSelectedProductForOrder(product)}
                    className="h-8 rounded-xl border border-slate-200 hover:bg-slate-50 text-[11px] font-bold text-slate-700 inline-flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Vente</span>
                  </button>
                  {codeRevendeur ? (
                    <button
                      onClick={() => basculerBoutique(product.id)}
                      disabled={enCours === product.id}
                      className={`h-8 rounded-xl border text-[11px] font-bold inline-flex items-center justify-center gap-1 transition-colors disabled:opacity-60 ${
                        maSelection.has(product.id)
                          ? 'bg-suguba-brand/10 border-suguba-brand/30 text-suguba-brand'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {maSelection.has(product.id) ? <Check className="w-3.5 h-3.5" /> : <Store className="w-3.5 h-3.5" />}
                      <span>{maSelection.has(product.id) ? 'En boutique' : 'Boutique'}</span>
                    </button>
                  ) : (
                    <Link
                      href={`/p/${product.slug}`}
                      className="h-8 rounded-xl border border-slate-200 hover:bg-slate-50 text-[11px] font-bold text-slate-700 inline-flex items-center justify-center"
                    >
                      Voir
                    </Link>
                  )}
                </div>
              </ProductCard>
            ))}
          </div>
        )}

      </main>

      {selectedProductForOrder && (
        <CreateOrderModal
          product={selectedProductForOrder}
          isOpen={!!selectedProductForOrder}
          onClose={() => setSelectedProductForOrder(null)}
        />
      )}

      <BottomNav />
    </div>
  );
}
