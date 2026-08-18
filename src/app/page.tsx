'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import ShareModal from '@/components/reseller/ShareModal';
import CreateOrderModal from '@/components/reseller/CreateOrderModal';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { Product } from '@/types';
import { 
  Store, ShoppingBag, Truck, Shield, ArrowRight, 
  MessageCircle, Sparkles, CheckCircle2, TrendingUp,
  Share2, Zap, PhoneCall, Wallet, ChevronRight, Lock
} from 'lucide-react';

export default function HomePage() {
  const state = useSugubaStore();
  const [selectedProductForShare, setSelectedProductForShare] = useState<Product | null>(null);
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const approvedProducts = state.products.filter(p => p.status === 'approved');
  const categories = ['all', ...Array.from(new Set(approvedProducts.map(p => p.category)))];

  const filteredProducts = selectedCategory === 'all'
    ? approvedProducts
    : approvedProducts.filter(p => p.category === selectedCategory);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1">
        
        {/* Hero Section — Mobile-First */}
        <section className="bg-gradient-to-b from-emerald-900 via-emerald-950 to-slate-950 text-white pt-8 pb-14 px-4 sm:px-6 relative overflow-hidden">
          {/* Subtle decoration */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-4xl mx-auto text-center relative z-10 space-y-4">
            
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-emerald-300 text-xs font-semibold backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>N°1 du Social Commerce & Réseau de Revendeurs au Mali</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Gagnez des revenus <span className="text-emerald-400">sans stock</span>, simplement avec WhatsApp.
            </h1>

            <p className="text-sm sm:text-base text-emerald-100/90 max-w-xl mx-auto leading-relaxed">
              Suguba connecte les grossistes de Bamako avec des milliers de revendeurs. Partagez les produits, nous livrons, vous touchez vos commissions par <strong>Orange Money</strong> ou <strong>Wave</strong>.
            </p>

            {/* Quick Action CTA Cards for the 4 key roles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 max-w-3xl mx-auto">
              
              <button
                onClick={() => sugubaStore.switchRole('reseller')}
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/15 rounded-2xl text-left transition-all hover:scale-105 active:scale-95 group"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/30 flex items-center justify-center mb-2">
                  <Store className="w-4 h-4 text-emerald-300" />
                </div>
                <p className="font-bold text-xs text-white group-hover:text-emerald-300">Espace Revendeur</p>
                <p className="text-[10px] text-emerald-200/70">Catalogue & Gains</p>
              </button>

              <button
                onClick={() => sugubaStore.switchRole('supplier')}
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/15 rounded-2xl text-left transition-all hover:scale-105 active:scale-95 group"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-500/30 flex items-center justify-center mb-2">
                  <ShoppingBag className="w-4 h-4 text-blue-300" />
                </div>
                <p className="font-bold text-xs text-white group-hover:text-blue-300">Espace Fournisseur</p>
                <p className="text-[10px] text-blue-200/70">Ajout & Stock</p>
              </button>

              <button
                onClick={() => sugubaStore.switchRole('driver')}
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/15 rounded-2xl text-left transition-all hover:scale-105 active:scale-95 group"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/30 flex items-center justify-center mb-2">
                  <Truck className="w-4 h-4 text-amber-300" />
                </div>
                <p className="font-bold text-xs text-white group-hover:text-amber-300">Espace Livreur</p>
                <p className="text-[10px] text-amber-200/70">Courses & OTP</p>
              </button>

              <button
                onClick={() => sugubaStore.switchRole('admin')}
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/15 rounded-2xl text-left transition-all hover:scale-105 active:scale-95 group"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-500/30 flex items-center justify-center mb-2">
                  <Shield className="w-4 h-4 text-purple-300" />
                </div>
                <p className="font-bold text-xs text-white group-hover:text-purple-300">Suguba Ops</p>
                <p className="text-[10px] text-purple-200/70">Modération & Marges</p>
              </button>

            </div>

          </div>
        </section>

        {/* How It Works (Le cycle parfait Fournisseur -> Suguba -> Revendeur -> Client -> Livreur -> Commission) */}
        <section className="max-w-5xl mx-auto px-4 -mt-6">
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-200/80">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 text-center">
              Le Modèle Suguba Contrôlé en 4 Étapes
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center sm:text-left">
              
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex sm:flex-col items-center sm:items-start space-x-3 sm:space-x-0 sm:space-y-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">Fournisseur Dépose</h3>
                  <p className="text-[11px] text-slate-500">Fixe son prix plancher (ex: 30 000 F).</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-purple-50 border border-purple-100 flex sm:flex-col items-center sm:items-start space-x-3 sm:space-x-0 sm:space-y-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">Suguba Fixe les Gains</h3>
                  <p className="text-[11px] text-slate-500">Prix public 40k + Commission 4k + Marge.</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 flex sm:flex-col items-center sm:items-start space-x-3 sm:space-x-0 sm:space-y-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">Revendeur Partage</h3>
                  <p className="text-[11px] text-slate-500">En 1-clic sur WhatsApp & TikTok.</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100 flex sm:flex-col items-center sm:items-start space-x-3 sm:space-x-0 sm:space-y-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 font-black text-xs flex items-center justify-center shrink-0">
                  4
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">Livraison OTP & Pay</h3>
                  <p className="text-[11px] text-slate-500">Paiement encaissé, commission sécurisée.</p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Live Products Showcase — Mobile Responsive Grid */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Catalogue Produits Rémunérés
              </h2>
              <p className="text-xs text-slate-500">
                Gagnez de l&apos;argent sur chaque vente sans acheter de stock préalable.
              </p>
            </div>

            {/* Category pills */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cat === 'all' ? 'Tous les produits' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <div 
                key={product.id}
                className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col"
              >
                {/* Image & Badge */}
                <div className="relative h-48 bg-slate-100 overflow-hidden group">
                  <Image
                    src={product.images[0]}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold">
                      {product.category}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-black shadow-md">
                      +{product.resellerCommission.toLocaleString('fr-FR')} F de gain
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                      {product.description}
                    </p>
                  </div>

                  {/* Pricing Box */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Prix Client</p>
                      <p className="text-sm font-black text-slate-900">
                        {product.publicPrice.toLocaleString('fr-FR')} FCFA
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase">Ta Commission</p>
                      <p className="text-sm font-black text-emerald-600">
                        +{product.resellerCommission.toLocaleString('fr-FR')} FCFA
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => setSelectedProductForShare(product)}
                      className="flex items-center justify-center space-x-1.5 py-2.5 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-bold transition-transform active:scale-95 shadow-xs"
                    >
                      <MessageCircle className="w-4 h-4 fill-current" />
                      <span>Partager</span>
                    </button>

                    <Link
                      href={`/p/${product.slug}`}
                      className="flex items-center justify-center space-x-1.5 py-2.5 px-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      <span>Acheter / Voir</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                </div>
              </div>
            ))}
          </div>

        </section>

      </main>

      {/* Modals */}
      {selectedProductForShare && (
        <ShareModal
          product={selectedProductForShare}
          isOpen={!!selectedProductForShare}
          onClose={() => setSelectedProductForShare(null)}
          onCreateManualOrder={(product) => {
            setSelectedProductForOrder(product);
          }}
        />
      )}

      {selectedProductForOrder && (
        <CreateOrderModal
          product={selectedProductForOrder}
          isOpen={!!selectedProductForOrder}
          onClose={() => setSelectedProductForOrder(null)}
        />
      )}

      <Footer />
      <BottomNav />
    </div>
  );
}
