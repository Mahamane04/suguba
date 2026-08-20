'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import ProductImage from '@/components/common/ProductImage';
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
  Share2, Zap, Wallet, ChevronRight, Users, Star,
  Package
} from 'lucide-react';

/* ── Stats Banner Data ── */
const stats = [
  { label: 'Revendeurs actifs',   value: '142+',  icon: Users   },
  { label: 'Commandes livrées',   value: '1.2K+', icon: Package },
  { label: 'Satisfaction client', value: '4.8/5', icon: Star    },
  { label: 'Gains distribués',    value: '12M F', icon: Wallet  },
];

/* ── Role Cards Data ── */
const portalCards = [
  {
    role: 'reseller' as const,
    title: 'Revendeur',
    subtitle: 'Gagnez des commissions',
    description: 'Partagez les produits sur WhatsApp & TikTok, nous livrons, vous encaissez.',
    icon: Store,
    gradient: 'from-emerald-500 to-green-600',
    glow: 'shadow-[0_8px_24px_rgb(22_163_74/0.3)]',
    href: '/reseller',
    commission: '14% de commission',
    highlight: 'bg-emerald-50 text-emerald-700',
  },
  {
    role: 'supplier' as const,
    title: 'Fournisseur',
    subtitle: 'Gérez votre stock',
    description: 'Déposez vos produits, Suguba les distribue via son réseau de revendeurs.',
    icon: ShoppingBag,
    gradient: 'from-blue-500 to-indigo-600',
    glow: 'shadow-[0_8px_24px_rgb(59_130_246/0.3)]',
    href: '/supplier',
    commission: '80% du prix plancher',
    highlight: 'bg-blue-50 text-blue-700',
  },
  {
    role: 'driver' as const,
    title: 'Livreur',
    subtitle: 'Courses rémunérées',
    description: 'Recevez vos missions, naviguez avec repères, validez la livraison par OTP.',
    icon: Truck,
    gradient: 'from-amber-500 to-orange-600',
    glow: 'shadow-[0_8px_24px_rgb(245_158_11/0.3)]',
    href: '/driver',
    commission: 'Par course + bonus',
    highlight: 'bg-amber-50 text-amber-700',
  },
  {
    role: 'admin' as const,
    title: 'Suguba Ops',
    subtitle: 'Contrôle total',
    description: 'Modération, pricing, dispatch livreurs, comptabilité et paiements.',
    icon: Shield,
    gradient: 'from-purple-500 to-violet-600',
    glow: 'shadow-[0_8px_24px_rgb(139_92_246/0.3)]',
    href: '/admin',
    commission: 'Marge Suguba : 6%',
    highlight: 'bg-purple-50 text-purple-700',
  },
];

/* ── How It Works Steps ── */
const steps = [
  {
    num: '01',
    title: 'Fournisseur dépose',
    desc: 'Prix plancher défini (ex. 30 000 F)',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
  {
    num: '02',
    title: 'Suguba fixe les gains',
    desc: 'Prix public + Commission revendeur + Marge',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
  },
  {
    num: '03',
    title: 'Revendeur partage',
    desc: '1-clic vers WhatsApp, TikTok & Facebook',
    color: 'text-suguba-brand',
    bg: 'bg-suguba-50',
    border: 'border-suguba-100',
  },
  {
    num: '04',
    title: 'Livraison OTP & Paiement',
    desc: 'Commission versée par Orange Money ou Wave',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
  },
];

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
    <div className="min-h-screen flex flex-col bg-[#f5f8f5] pb-20 md:pb-0">
      <Header />

      <main className="flex-1">

        {/* ══════════════════════════════════════════════
            HERO SECTION
        ══════════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-[#064e3b]">
          {/* Bg decorations */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#09b500]/15 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-800/30 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full"
              style={{
                backgroundImage: 'radial-gradient(ellipse at center, rgb(9 181 0 / 0.05) 0%, transparent 70%)'
              }}
            />
          </div>

          <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-16 text-center">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-emerald-200 text-xs font-semibold mb-6 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              N°1 Social Commerce & Réseau Revendeurs au Mali
            </div>

            {/* H1 */}
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.1] mb-4 text-balance">
              Gagnez des revenus{' '}
              <span
                className="relative inline-block"
                style={{
                  background: 'linear-gradient(90deg, #4ade80, #09b500)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                sans stock
              </span>
              ,{' '}
              <br className="sm:hidden" />
              avec WhatsApp.
            </h1>

            <p className="text-base text-emerald-100/80 max-w-lg mx-auto leading-relaxed mb-8">
              Suguba connecte les grossistes de Bamako avec des milliers de revendeurs.
              Vous partagez, nous livrons, vous touchez vos commissions par{' '}
              <strong className="text-white">Orange Money</strong> ou{' '}
              <strong className="text-white">Wave</strong>.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#09b500] hover:bg-[#078000] text-white font-bold rounded-full transition-all shadow-[0_4px_16px_rgb(9_181_0/0.4)] hover:shadow-[0_6px_24px_rgb(9_181_0/0.5)] hover:-translate-y-0.5"
              >
                <Zap className="w-4 h-4" />
                Commencer gratuitement
              </Link>
              <Link
                href="/p/smart-tv-samsung-43"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full transition-all border border-white/20"
              >
                Voir les produits
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Portal Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-3xl mx-auto">
              {portalCards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.role}
                    onClick={() => sugubaStore.switchRole(card.role)}
                    className="p-3.5 bg-white/8 hover:bg-white/15 border border-white/10 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-2.5 shadow-sm`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <p className="font-bold text-xs text-white group-hover:text-emerald-300 transition-colors">
                      {card.title}
                    </p>
                    <p className="text-[10px] text-white/50 mt-0.5">{card.subtitle}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wave divider */}
          <div className="relative h-12 sm:h-16 overflow-hidden">
            <svg viewBox="0 0 1440 64" fill="none" xmlns="http://www.w3.org/2000/svg"
              className="absolute bottom-0 w-full" preserveAspectRatio="none"
            >
              <path d="M0 64L1440 64L1440 0C1200 48 960 64 720 64C480 64 240 48 0 0L0 64Z"
                fill="#f5f8f5" />
            </svg>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            STATS BAR
        ══════════════════════════════════════════════ */}
        <section className="py-6 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Revendeurs inscrits', value: `${state.resellers.length}`, icon: Users },
                { label: 'Commandes livrées', value: `${state.orders.filter(o => o.status === 'delivered').length}`, icon: Package },
                { label: 'Articles vérifiés', value: `${approvedProducts.length}`, icon: Star },
                { label: 'Commissions générées', value: `${state.commissions.filter(c => c.status === 'available' || c.status === 'paid' || c.status === 'locked').reduce((a, b) => a + b.amount, 0).toLocaleString('fr-FR')} F`, icon: Wallet },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-card text-center">
                  <Icon className="w-4 h-4 text-suguba-brand mx-auto mb-1.5" />
                  <p className="font-black text-gray-900 text-lg leading-none">{value}</p>
                  <p className="text-[10px] text-gray-400 mt-1 font-medium">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            HOW IT WORKS
        ══════════════════════════════════════════════ */}
        <section className="py-8 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-card border border-gray-100">
              <div className="text-center mb-6">
                <span className="inline-block px-3 py-1 rounded-full bg-suguba-50 text-suguba-brand text-[11px] font-bold uppercase tracking-wider mb-2">
                  Le modèle contrôlé Suguba
                </span>
                <h2 className="text-lg font-black text-gray-900">Comment ça marche en 4 étapes</h2>
              </div>

              {/* Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {steps.map((step, i) => (
                  <div key={step.num} className="relative flex sm:flex-col items-start gap-3 sm:gap-2">
                    {/* Connector line (desktop) */}
                    {i < steps.length - 1 && (
                      <div className="hidden sm:block absolute top-5 left-[calc(50%+1.5rem)] right-[-50%] h-px bg-gray-100 z-0" />
                    )}
                    <div className={`relative z-10 flex shrink-0 sm:mx-auto items-center justify-center w-10 h-10 rounded-2xl ${step.bg} border ${step.border}`}>
                      <span className={`font-black text-xs ${step.color}`}>{step.num}</span>
                    </div>
                    <div className="sm:text-center">
                      <h3 className="font-bold text-sm text-gray-900">{step.title}</h3>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            PORTAL SHOWCASE
        ══════════════════════════════════════════════ */}
        <section className="py-6 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-xl font-black text-gray-900">Votre espace de travail</h2>
              <p className="text-sm text-gray-500 mt-1">Choisissez votre rôle et accédez à votre dashboard</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {portalCards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link
                    key={card.role}
                    href={card.href}
                    onClick={() => sugubaStore.switchRole(card.role)}
                    className="group bg-white rounded-3xl p-5 border border-gray-100 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 flex gap-4 items-start"
                  >
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${card.gradient} ${card.glow} flex items-center justify-center shrink-0 transition-transform group-hover:scale-110`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-gray-900">{card.title}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${card.highlight}`}>
                          {card.commission}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{card.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 mt-1 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            PRODUCTS CATALOGUE
        ══════════════════════════════════════════════ */}
        <section className="py-8 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-black text-gray-900">Catalogue Produits</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Gagnez une commission sur chaque vente — sans achat de stock préalable
                </p>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-suguba-brand text-white shadow-brand-sm'
                        : 'bg-white border border-gray-200 text-gray-500 hover:border-suguba-200 hover:text-suguba-brand'
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
                  className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 flex flex-col touch-card"
                >
                  {/* Image */}
                  <div className="relative h-48 bg-gray-50 overflow-hidden">
                    <ProductImage
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {/* Category badge */}
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 rounded-full bg-gray-900/70 backdrop-blur-sm text-white text-[10px] font-bold">
                        {product.category}
                      </span>
                    </div>
                    {/* Commission badge */}
                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 rounded-full bg-suguba-brand text-white text-[10px] font-black shadow-brand-sm">
                        +{product.resellerCommission.toLocaleString('fr-FR')} F
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col gap-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-1">
                        {product.name}
                      </h3>
                      <p className="text-xs text-gray-400 line-clamp-2 mt-1 leading-relaxed">
                        {product.description}
                      </p>
                    </div>

                    {/* Pricing */}
                    <div className="p-3 bg-gray-50 rounded-2xl flex items-center justify-between border border-gray-100">
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Prix client</p>
                        <p className="text-sm font-black text-gray-900 mt-0.5">
                          {product.publicPrice.toLocaleString('fr-FR')} F
                        </p>
                      </div>
                      <div className="w-px h-8 bg-gray-200" />
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-suguba-brand uppercase tracking-wider">Ta commission</p>
                        <p className="text-sm font-black text-suguba-brand mt-0.5">
                          +{product.resellerCommission.toLocaleString('fr-FR')} F
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSelectedProductForShare(product)}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#25D366] hover:bg-[#1eb558] text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-current" />
                        Partager
                      </button>
                      <Link
                        href={`/p/${product.slug}`}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                      >
                        Acheter
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ══════════════════════════════════════════════
            TRUST SIGNALS
        ══════════════════════════════════════════════ */}
        <section className="py-8 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-3xl p-5 sm:p-8 border border-gray-100 shadow-card">
              <div className="text-center mb-6">
                <h2 className="text-lg font-black text-gray-900">
                  Pourquoi choisir Suguba ?
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    icon: CheckCircle2,
                    title: '0 F de stock initial',
                    desc: 'Commencez à vendre immédiatement sans investir dans des produits.',
                    color: 'text-suguba-brand',
                    bg: 'bg-suguba-50',
                  },
                  {
                    icon: Zap,
                    title: 'Commissions garanties',
                    desc: 'Versement Mobile Money dès validation de livraison par OTP.',
                    color: 'text-amber-600',
                    bg: 'bg-amber-50',
                  },
                  {
                    icon: TrendingUp,
                    title: 'Réseau croissant',
                    desc: 'Rejoignez 142 revendeurs actifs et grandissez avec Suguba.',
                    color: 'text-blue-600',
                    bg: 'bg-blue-50',
                  },
                ].map(({ icon: Icon, title, desc, color, bg }) => (
                  <div key={title} className="flex gap-3 items-start">
                    <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">{title}</h3>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

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

      <Footer />
      <BottomNav />
    </div>
  );
}
