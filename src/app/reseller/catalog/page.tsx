'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import ShareModal from '@/components/reseller/ShareModal';
import CreateOrderModal from '@/components/reseller/CreateOrderModal';
import { useSugubaStore } from '@/lib/store';
import { Product } from '@/types';
import { 
  Search, Filter, MessageCircle, Plus, Sparkles, 
  ShoppingBag, Check, ShieldCheck, Flame, Store, ExternalLink
} from 'lucide-react';

export default function ResellerCatalogPage() {
  const state = useSugubaStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProductForShare, setSelectedProductForShare] = useState<Product | null>(null);
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

  const filtered = approvedProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Header Title & Studio Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Catalogue Produits Rémunérés
            </h1>
            <p className="text-xs text-slate-500">
              Partagez sur WhatsApp et gagnez des commissions garanties sur chaque vente livrée.
            </p>
          </div>

          <Link
            href="/reseller/marketing"
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-black rounded-2xl text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all self-start sm:self-auto"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Studio Affiches WhatsApp</span>
          </Link>
        </div>

        {/* Ma boutique : la vitrine publique composée depuis ce catalogue. */}
        {codeRevendeur && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <Store className="w-6 h-6 text-emerald-700 shrink-0" />
              <div>
                <p className="text-sm font-black text-emerald-950">Ma boutique — {maSelection.size} article{maSelection.size > 1 ? 's' : ''}</p>
                <p className="text-[11px] text-emerald-800">
                  Ajoutez des articles ci-dessous, puis partagez votre boutique : chaque vente vous est attribuée.
                </p>
              </div>
            </div>
            <Link href={`/r/${codeRevendeur}`} target="_blank"
              className="h-11 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center justify-center space-x-1.5">
              <ExternalLink className="w-4 h-4" /><span>Voir et partager ma boutique</span>
            </Link>
          </div>
        )}
        {erreurBoutique && (
          <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl p-3">{erreurBoutique}</p>
        )}

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Rechercher TV, mixeur, solaire, téléphone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-emerald-600 shadow-2xs"
            />
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat === 'all' ? 'Toutes catégories' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((product) => (
            <div 
              key={product.id}
              className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs flex flex-col justify-between"
            >
              {/* Product Media & Badges */}
              <div className="relative h-48 bg-slate-100 overflow-hidden">
                <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold">
                    {product.category}
                  </span>
                </div>
                <div className="absolute top-3 right-3">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-black shadow-md flex items-center space-x-1">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>+{product.resellerCommission.toLocaleString('fr-FR')} F</span>
                  </span>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Stock : {product.stockQuantity} unités disponibles
                  </p>
                  <h3 className="font-bold text-sm text-slate-900 line-clamp-1">{product.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2">{product.description}</p>
                </div>

                {/* Economics Box */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block">Prix Public Client</span>
                    <span className="text-sm font-black text-slate-900">
                      {product.publicPrice.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-emerald-700 block">Ta Commission</span>
                    <span className="text-sm font-black text-emerald-600">
                      +{product.resellerCommission.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setSelectedProductForShare(product)}
                    className="flex items-center justify-center space-x-1.5 py-2.5 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-bold shadow-xs transition-transform active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4 fill-current" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    onClick={() => setSelectedProductForOrder(product)}
                    className="flex items-center justify-center space-x-1.5 py-2.5 px-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Créer vente</span>
                  </button>
                </div>

                {codeRevendeur && (
                  <button
                    onClick={() => basculerBoutique(product.id)}
                    disabled={enCours === product.id}
                    className={`w-full h-10 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border transition-colors disabled:opacity-60 ${
                      maSelection.has(product.id)
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {maSelection.has(product.id) ? <Check className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                    <span>{maSelection.has(product.id) ? 'Dans ma boutique' : 'Ajouter à ma boutique'}</span>
                  </button>
                )}

              </div>
            </div>
          ))}
        </div>

      </main>

      {/* Modals */}
      {selectedProductForShare && (
        <ShareModal
          product={selectedProductForShare}
          isOpen={!!selectedProductForShare}
          onClose={() => setSelectedProductForShare(null)}
          onCreateManualOrder={(product) => setSelectedProductForOrder(product)}
        />
      )}

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
