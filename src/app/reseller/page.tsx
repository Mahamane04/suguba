'use client';

import React, { useEffect, useState } from 'react';
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
  Wallet, TrendingUp, ShoppingBag, Clock, CheckCircle2, 
  Copy, Check, Plus, ChevronRight, Award, Trophy, Users, 
  Building2, Calculator, Sparkles, MessageCircle, Star,
  MoreVertical, QrCode, ArrowUpRight
} from 'lucide-react';

export default function ResellerDashboardPage() {
  const state = useSugubaStore();
  const [selectedProductForShare, setSelectedProductForShare] = useState<Product | null>(null);
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<Product | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  const currentUser = state.currentUser;
  const reseller = state.resellers.find(r => r.userId === currentUser.id) || state.resellers[0] || {
    id: 'res-default',
    userId: currentUser.id,
    referralCode: 'SUGUBA100',
    tier: 'new',
    pendingBalance: 0,
    availableBalance: 0,
    totalEarned: 0,
    successfulOrdersCount: 0,
    momoNumber: currentUser.phone,
    momoProvider: 'Orange Money',
  };
  
  const myOrders = state.orders.filter(o => o.resellerId === reseller.id);
  const myCommissions = state.commissions.filter(c => c.resellerId === reseller.id);
  const approvedProducts = state.products.filter(p => p.status === 'approved');

  // Remplace le solde de démo par le vrai solde du grand-livre serveur dès
  // qu'il est connu (voir sugubaStore.syncResellerBalance et
  // /api/reseller/balance) — même mécanisme que /reseller/payouts, pour que
  // les deux pages restent cohérentes entre elles.
  useEffect(() => {
    fetch('/api/reseller/balance')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.cloud) {
          sugubaStore.syncResellerBalance(reseller.id, data.availableBalance, data.pendingBalance);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reseller.id]);

  const handleCopyRefCode = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(reseller.referralCode);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  // Real dynamic calculation
  const targetSales = reseller.tier === 'vip' ? 100 : reseller.tier === 'verified' ? 30 : 10;
  const currentSales = reseller.successfulOrdersCount || myOrders.filter(o => o.status === 'delivered').length;
  const progressPercent = targetSales > 0 ? Math.min(100, Math.round((currentSales / targetSales) * 100)) : 0;
  const remainingSales = Math.max(0, targetSales - currentSales);

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8f5] pb-20 md:pb-10 font-sans">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full space-y-5">
        
        {/* ── 1. Top Forest Green Hero Banner Card ── */}
        <div 
          className="rounded-3xl p-5 sm:p-7 text-white shadow-brand-md relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #005a2b 0%, #006837 50%, #064e3b 100%)' }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Left: Greeting & Referral Code */}
            <div className="lg:col-span-4 space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-emerald-200 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>Revendeur {reseller.tier === 'vip' ? 'VIP Élite' : reseller.tier === 'verified' ? 'Certifié' : 'Nouveau'}</span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Bonjour, {currentUser.fullName.split(' ')[0]} 👋
                </h1>
                <p className="text-xs text-emerald-100/90 mt-1">
                  Voici un aperçu de votre activité aujourd&apos;hui.
                </p>
              </div>

              <div className="pt-1 space-y-1.5">
                <span className="text-[11px] font-medium text-emerald-200 block">
                  Code d&apos;affiliation
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-black text-white tracking-wider">
                    {reseller.referralCode}
                  </span>
                  <button
                    onClick={handleCopyRefCode}
                    className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
                    title="Copier le code"
                  >
                    {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  onClick={handleCopyRefCode}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-200 hover:text-white transition-colors pt-0.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedRef ? 'Code copié dans le presse-papier !' : 'Copier le code'}</span>
                </button>
              </div>
            </div>

            {/* Right: 4x2 Grid of White Action Cards */}
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              
              {/* 1. Studio Stories 9:16 */}
              <Link
                href="/reseller/story-generator"
                className="bg-white rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 text-slate-900 hover:shadow-md transition-all group active:scale-95"
              >
                <div className="w-9 h-9 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900 leading-snug truncate">Studio Stories 9:16</p>
                  <p className="text-[10px] text-slate-500 truncate">Créez une publicité</p>
                </div>
              </Link>

              {/* 2. Ma Carte Pro & QR */}
              <Link
                href="/reseller/badge"
                className="bg-white rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 text-slate-900 hover:shadow-md transition-all group active:scale-95"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <QrCode className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900 leading-snug truncate">Ma Carte Pro & QR</p>
                  <p className="text-[10px] text-slate-500 truncate">Votre badge revendeur</p>
                </div>
              </Link>

              {/* 3. Simulateur Gains */}
              <Link
                href="/reseller/calculator"
                className="bg-white rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 text-slate-900 hover:shadow-md transition-all group active:scale-95"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Calculator className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900 leading-snug truncate">Simulateur Gains</p>
                  <p className="text-[10px] text-slate-500 truncate">Estimez vos revenus</p>
                </div>
              </Link>

              {/* 4. Canaux de Marques */}
              <Link
                href="/reseller/channels"
                className="bg-white rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 text-slate-900 hover:shadow-md transition-all group active:scale-95"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900 leading-snug truncate">Canaux de Marques</p>
                  <p className="text-[10px] text-slate-500 truncate">Découvrez les catalogues</p>
                </div>
              </Link>

              {/* 5. Académie & Recrutement */}
              <Link
                href="/reseller/academy"
                className="bg-white rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 text-slate-900 hover:shadow-md transition-all group active:scale-95"
              >
                <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Award className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900 leading-snug truncate">Académie & Recrutement</p>
                  <p className="text-[10px] text-slate-500 truncate">Apprenez et recrutez</p>
                </div>
              </Link>

              {/* 6. Parrainage (+1000 F) */}
              <Link
                href="/reseller/referrals"
                className="bg-white rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 text-slate-900 hover:shadow-md transition-all group active:scale-95"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900 leading-snug truncate">Parrainage (+1000 F)</p>
                  <p className="text-[10px] text-slate-500 truncate">Invitez et gagnez</p>
                </div>
              </Link>

              {/* 7. Défis & Primes */}
              <Link
                href="/reseller/challenges"
                className="bg-white rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 text-slate-900 hover:shadow-md transition-all group active:scale-95"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900 leading-snug truncate">Défis & Primes</p>
                  <p className="text-[10px] text-slate-500 truncate">Participez et gagnez</p>
                </div>
              </Link>

              {/* 8. Retirer gains */}
              <Link
                href="/reseller/payouts"
                className="bg-white rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 text-slate-900 hover:shadow-md transition-all group active:scale-95"
              >
                <div className="w-9 h-9 rounded-xl bg-yellow-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Wallet className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900 leading-snug truncate">Retirer gains</p>
                  <p className="text-[10px] text-slate-500 truncate">Retirez vos gains</p>
                </div>
              </Link>

            </div>

          </div>
        </div>

        {/* ── 2. Status / Reputation Level Progress Card ── */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-card space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 fill-emerald-600 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-black text-xs sm:text-sm text-gray-900">
                  {reseller.tier === 'vip' 
                    ? 'Statut VIP Élite : Vos commissions se débloquent à J+3 !'
                    : reseller.tier === 'verified'
                      ? 'Statut Revendeur Vérifié : Vos commissions se débloquent à J+7 !'
                      : 'Statut Nouveau Revendeur : Commissions débloquées à J+14 !'}
                </h2>
                <p className="text-[11px] text-gray-500">
                  {remainingSales > 0 
                    ? `Plus que ${remainingSales} vente(s) pour débloquer le palier supérieur !` 
                    : 'Félicitations, vous êtes au palier de déblocage maximal !'}
                </p>
              </div>
            </div>

            <span className="text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full self-start sm:self-auto">
              {currentSales} / {targetSales} ventes
            </span>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div 
                className="h-2 rounded-full bg-[#09b500] transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-black text-gray-700 shrink-0">
              {progressPercent}%
            </span>
          </div>
        </div>

        {/* ── 3. 4 KPI Metrics Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          
          {/* Card 1: Disponible */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-card space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Disponible</p>
              <p className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                {reseller.availableBalance.toLocaleString('fr-FR')} <span className="text-xs font-semibold text-gray-500">FCFA</span>
              </p>
              <p className="text-xs font-bold text-suguba-brand mt-0.5">
                Retirable immédiatement
              </p>
            </div>
          </div>

          {/* Card 2: En attente (J+7) */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-card space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">En attente</p>
              <p className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                {reseller.pendingBalance.toLocaleString('fr-FR')} <span className="text-xs font-semibold text-gray-500">FCFA</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Sécurité anti-retour
              </p>
            </div>
          </div>

          {/* Card 3: Total gagné */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-card space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Total gagné</p>
              <p className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                {reseller.totalEarned.toLocaleString('fr-FR')} <span className="text-xs font-semibold text-gray-500">FCFA</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Historique cumulé
              </p>
            </div>
          </div>

          {/* Card 4: Ventes livrées */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-card space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Ventes livrées</p>
              <p className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                {currentSales}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {myOrders.length} commandes au total
              </p>
            </div>
          </div>

        </div>

        {/* ── 4. Actions rapides ── */}
        <div className="space-y-2.5">
          <h2 className="font-black text-sm text-gray-900">
            Actions rapides
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* 1. Catalogue */}
            <Link
              href="/reseller/catalog"
              className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-card flex items-center justify-between hover:border-emerald-200 transition-all group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-gray-900 truncate">Catalogue</p>
                  <p className="text-[10px] text-gray-400 truncate">Partager sur WhatsApp</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>

            {/* 2. Créer Commande */}
            <button
              onClick={() => {
                if (approvedProducts.length > 0) setSelectedProductForOrder(approvedProducts[0]);
              }}
              className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-card flex items-center justify-between hover:border-blue-200 transition-all group text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-gray-900 truncate">Créer Commande</p>
                  <p className="text-[10px] text-gray-400 truncate">Client WhatsApp direct</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>

            {/* 3. Mes Ventes */}
            <Link
              href="/reseller/orders"
              className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-card flex items-center justify-between hover:border-purple-200 transition-all group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-gray-900 truncate">Mes Ventes</p>
                  <p className="text-[10px] text-gray-400 truncate">Suivi des colis</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>

            {/* 4. Retraits */}
            <Link
              href="/reseller/payouts"
              className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-card flex items-center justify-between hover:border-amber-200 transition-all group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-gray-900 truncate">Retraits</p>
                  <p className="text-[10px] text-gray-400 truncate">Orange Money / Wave</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>

          </div>
        </div>

        {/* ── 5. Produits Populaires & Fortes Commissions ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-black text-gray-900">
                Produits Populaires & Fortes Commissions
              </h2>
              <p className="text-xs text-gray-400">
                Partagez ces produits sur votre statut WhatsApp pour maximiser vos ventes.
              </p>
            </div>
            <Link 
              href="/reseller/catalog" 
              className="text-xs font-bold text-suguba-brand hover:underline flex items-center gap-0.5"
            >
              <span>Voir tout</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {approvedProducts.slice(0, 4).map((product) => (
              <div 
                key={product.id}
                className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-card flex flex-col justify-between space-y-3 hover:shadow-card-hover transition-all"
              >
                {/* Top: Thumbnail & Info */}
                <div className="flex gap-3">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-50 shrink-0 border border-gray-100">
                    <ProductImage src={product.images[0]} alt={product.name} fill className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <h3 className="font-bold text-xs text-gray-900 truncate">{product.name}</h3>
                    <p className="text-[11px] text-gray-400 truncate">{product.category}</p>
                    <p className="text-xs font-black text-gray-900">
                      {product.publicPrice.toLocaleString('fr-FR')} <span className="text-[10px] font-normal">FCFA</span>
                    </p>
                    <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full">
                      Vous gagnez +{product.resellerCommission.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                </div>

                {/* Bottom: Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setSelectedProductForShare(product)}
                    className="flex-1 py-2 px-3 bg-[#09b500] hover:bg-[#078000] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-brand-sm transition-transform active:scale-95"
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-current" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    onClick={() => setSelectedProductForOrder(product)}
                    className="p-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-colors shrink-0"
                    title="Créer commande directe"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 6. Bottom Row: 2-Column Grid (Dernières ventes & Timeline déblocage) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Left (7 cols): Dernières ventes */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-gray-100 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-sm text-gray-900">
                Dernières ventes
              </h2>
              <Link 
                href="/reseller/orders" 
                className="text-xs font-bold text-suguba-brand hover:underline"
              >
                Voir tout
              </Link>
            </div>

            {myOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                Aucune vente enregistrée pour le moment. Partagez votre premier produit !
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      <th className="pb-2.5">Produit</th>
                      <th className="pb-2.5">Client</th>
                      <th className="pb-2.5">Montant</th>
                      <th className="pb-2.5">Commission</th>
                      <th className="pb-2.5">Statut</th>
                      <th className="pb-2.5">Date</th>
                      <th className="pb-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {myOrders.slice(0, 4).map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 pr-2">
                          <div className="flex items-center gap-2 min-w-[130px]">
                            <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                              <ProductImage src={order.productImage} alt={order.productName} fill className="object-cover" />
                            </div>
                            <span className="font-bold text-gray-900 truncate max-w-[100px]">{order.productName}</span>
                          </div>
                        </td>

                        <td className="py-3 pr-2 whitespace-nowrap text-gray-600">
                          <div className="flex items-center gap-1">
                            <span>{order.customerPhone}</span>
                            <a
                              href={`https://wa.me/${order.customerPhone.replace(/[^\d]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-500 hover:text-emerald-600"
                              title="Discuter sur WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5 fill-current" />
                            </a>
                          </div>
                        </td>

                        <td className="py-3 pr-2 font-bold text-gray-900 whitespace-nowrap">
                          {order.totalAmount.toLocaleString('fr-FR')} FCFA
                        </td>

                        <td className="py-3 pr-2 font-black text-suguba-brand whitespace-nowrap">
                          +{order.resellerCommission.toLocaleString('fr-FR')} FCFA
                        </td>

                        <td className="py-3 pr-2 whitespace-nowrap">
                          {order.status === 'delivered' ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                              Livrée
                            </span>
                          ) : order.status === 'in_transit' ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[10px]">
                              En cours
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 font-bold text-[10px]">
                              En attente
                            </span>
                          )}
                        </td>

                        <td className="py-3 text-[11px] text-gray-400 whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>

                        <td className="py-3 text-right">
                          <button className="p-1 rounded-lg text-gray-400 hover:text-gray-600">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right (5 cols): Statut de déblocage des paiements */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-gray-100 shadow-card flex flex-col justify-between space-y-4">
            <div>
              <h2 className="font-black text-sm text-gray-900">
                Statut de déblocage des paiements
              </h2>
              
              {/* Stepper Timeline: J+14 -> J+7 -> J+3 */}
              <div className="mt-8 px-2">
                <div className="flex items-center justify-between relative">
                  
                  {/* Background Track Lines */}
                  <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-1 bg-gray-100 -z-0">
                    <div className="h-full bg-[#09b500] w-1/2" />
                  </div>

                  {/* Step 1: J+14 */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-brand-sm">
                      J+14
                    </div>
                    <span className="text-[10px] font-bold text-gray-600 mt-2 text-center">
                      Vente effectuée
                    </span>
                  </div>

                  {/* Step 2: J+7 */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      J+7
                    </div>
                    <span className="text-[10px] font-bold text-gray-600 mt-2 text-center">
                      Commission en attente
                    </span>
                  </div>

                  {/* Step 3: J+3 */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-white border-2 border-gray-300 text-gray-400 font-bold text-xs flex items-center justify-center">
                      J+3
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 mt-2 text-center">
                      Paiement VIP
                    </span>
                  </div>

                </div>
              </div>
            </div>

            {/* Bottom Status Text */}
            <p className="text-xs font-bold text-suguba-brand text-center pt-4 border-t border-gray-50">
              Votre paiement VIP sera débloqué à J+3 après J+7 d&apos;attente.
            </p>
          </div>

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

      <Footer />
      <BottomNav />
    </div>
  );
}
