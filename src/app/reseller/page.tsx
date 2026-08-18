'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import ShareModal from '@/components/reseller/ShareModal';
import CreateOrderModal from '@/components/reseller/CreateOrderModal';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { Product } from '@/types';
import { 
  Wallet, TrendingUp, ShoppingBag, Clock, CheckCircle2, 
  ArrowUpRight, MessageCircle, Copy, Check, Plus, 
  Share2, Shield, AlertCircle, Sparkles, ChevronRight, Award, Trophy
} from 'lucide-react';

export default function ResellerDashboardPage() {
  const state = useSugubaStore();
  const [selectedProductForShare, setSelectedProductForShare] = useState<Product | null>(null);
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<Product | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  const currentUser = state.currentUser;
  const reseller = state.resellers.find(r => r.userId === currentUser.id) || state.resellers[0];
  const myOrders = state.orders.filter(o => o.resellerId === reseller?.id);
  const myCommissions = state.commissions.filter(c => c.resellerId === reseller?.id);
  const approvedProducts = state.products.filter(p => p.status === 'approved');

  const handleCopyRefCode = () => {
    navigator.clipboard.writeText(reseller.referralCode);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-800 to-green-900 text-white p-5 sm:p-6 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="relative z-10 space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-700/80 text-emerald-200 text-[11px] font-bold">
              <Award className="w-3.5 h-3.5 text-amber-300" />
              <span>Revendeur {reseller.tier === 'vip' ? 'VIP' : reseller.tier === 'verified' ? 'Certifié' : 'Nouveau'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black">
              Bonjour, {currentUser.fullName.split(' ')[0]} 👋
            </h1>
            <p className="text-xs text-emerald-100/90">
              Code d&apos;affiliation : <strong className="font-mono text-amber-300">{reseller.referralCode}</strong>
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyRefCode}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold transition-colors"
            >
              {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedRef ? 'Code copié' : 'Copier code'}</span>
            </button>

            <Link
              href="/reseller/challenges"
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-black shadow-xs transition-all active:scale-95"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-300" />
              <span>Défis & Primes</span>
            </Link>

            <Link
              href="/reseller/payouts"
              className="flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-md transition-all active:scale-95"
            >
              <Wallet className="w-4 h-4" />
              <span>Retirer gains</span>
            </Link>
          </div>
        </div>

        {/* Reputation Tier Progress Banner (Avantage Vitesse de Paiement J+14 -> J+7 -> J+3) */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5">
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm ${
                reseller.tier === 'vip' 
                  ? 'bg-amber-100 text-amber-800' 
                  : reseller.tier === 'verified' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-blue-100 text-blue-800'
              }`}>
                {reseller.tier === 'vip' ? '👑' : reseller.tier === 'verified' ? '⭐' : '🌱'}
              </div>
              <div>
                <h3 className="font-black text-xs sm:text-sm text-slate-900">
                  {reseller.tier === 'vip' && 'Statut VIP Élite : Vos commissions se débloquent à J+3 !'}
                  {reseller.tier === 'verified' && 'Statut Revendeur Vérifié : Vos commissions se débloquent à J+7 !'}
                  {reseller.tier === 'new' && 'Nouveau Revendeur : Commissions débloquées à J+14 (Période d\'essai)'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {reseller.tier === 'new' && `Plus que ${Math.max(0, 10 - reseller.successfulOrdersCount)} vente(s) pour passer au statut Vérifié (J+7).`}
                  {reseller.tier === 'verified' && `Plus que ${Math.max(0, 30 - reseller.successfulOrdersCount)} vente(s) pour débloquer le paiement VIP à J+3 !`}
                  {reseller.tier === 'vip' && 'Félicitations, vous bénéficiez de la vitesse de paiement maximale Suguba.'}
                </p>
              </div>
            </div>

            <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-xl self-start sm:self-auto">
              {reseller.successfulOrdersCount} / {reseller.tier === 'new' ? 10 : 30} ventes
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div 
              className={`h-2.5 rounded-full transition-all duration-500 ${
                reseller.tier === 'vip' 
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400' 
                  : 'bg-gradient-to-r from-emerald-500 to-green-600'
              }`}
              style={{
                width: `${Math.min(100, (reseller.successfulOrdersCount / (reseller.tier === 'new' ? 10 : 30)) * 100)}%`
              }}
            />
          </div>
        </div>

        {/* Financial Balances Card (Registres de Commissions Suguba) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          {/* Solde Disponible */}
          <div className="bg-white p-4 rounded-3xl border border-emerald-200/80 shadow-xs space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Disponible</span>
              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-600">
              {reseller.availableBalance.toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-500">FCFA</span>
            </p>
            <p className="text-[10px] text-slate-500">Retirable immédiatement</p>
          </div>

          {/* En Attente (Période de sécurité J+7) */}
          <div className="bg-white p-4 rounded-3xl border border-amber-200/80 shadow-xs space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">En Attente (J+7)</span>
              <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-amber-600">
              {reseller.pendingBalance.toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-500">FCFA</span>
            </p>
            <p className="text-[10px] text-slate-500">Sécurité anti-retour</p>
          </div>

          {/* Total Gagné */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Gagné</span>
              <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {reseller.totalEarned.toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-500">FCFA</span>
            </p>
            <p className="text-[10px] text-slate-500">Historique cumulé</p>
          </div>

          {/* Ventes Réussies */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ventes Livrées</span>
              <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {reseller.successfulOrdersCount}
            </p>
            <p className="text-[10px] text-slate-500">{myOrders.length} commandes au total</p>
          </div>

        </div>

        {/* Quick Actions Shortcuts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/reseller/catalog"
            className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center space-x-3 hover:border-emerald-500 transition-colors group shadow-2xs"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-slate-900">Catalogue</p>
              <p className="text-[10px] text-slate-500">Partager sur WhatsApp</p>
            </div>
          </Link>

          <button
            onClick={() => {
              if (approvedProducts.length > 0) {
                setSelectedProductForOrder(approvedProducts[0]);
              }
            }}
            className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center space-x-3 hover:border-emerald-500 transition-colors group text-left shadow-2xs"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-slate-900">Créer Commande</p>
              <p className="text-[10px] text-slate-500">Client WhatsApp direct</p>
            </div>
          </button>

          <Link
            href="/reseller/orders"
            className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center space-x-3 hover:border-emerald-500 transition-colors group shadow-2xs"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-slate-900">Mes Ventes</p>
              <p className="text-[10px] text-slate-500">Suivi des colis</p>
            </div>
          </Link>

          <Link
            href="/reseller/payouts"
            className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center space-x-3 hover:border-emerald-500 transition-colors group shadow-2xs"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-slate-900">Retraits</p>
              <p className="text-[10px] text-slate-500">Orange Money / Wave</p>
            </div>
          </Link>
        </div>

        {/* Top High-Commission Products */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Produits Populaires & Fortes Commissions
              </h2>
              <p className="text-xs text-slate-500">
                Partagez ces produits sur votre statut WhatsApp pour maximiser vos ventes.
              </p>
            </div>
            <Link 
              href="/reseller/catalog" 
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center"
            >
              <span>Tout voir</span>
              <ChevronRight className="w-4 h-4 ml-0.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {approvedProducts.slice(0, 4).map((product) => (
              <div 
                key={product.id}
                className="bg-white p-3.5 rounded-3xl border border-slate-200/80 shadow-xs flex space-x-3.5 items-center"
              >
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                  <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="font-bold text-xs text-slate-900 truncate">{product.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      Prix : <strong>{product.publicPrice.toLocaleString('fr-FR')} F</strong>
                    </span>
                    <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      +{product.resellerCommission.toLocaleString('fr-FR')} F
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      onClick={() => setSelectedProductForShare(product)}
                      className="flex-1 flex items-center justify-center space-x-1 py-1.5 px-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-[11px] font-bold shadow-2xs transition-transform active:scale-95"
                    >
                      <MessageCircle className="w-3.5 h-3.5 fill-current" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      onClick={() => setSelectedProductForOrder(product)}
                      className="flex items-center justify-center px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold transition-colors"
                      title="Créer commande directe"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders & Commissions Pipeline */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900">
              Mes Dernières Ventes & Statuts
            </h2>
            <Link 
              href="/reseller/orders" 
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
            >
              Historique complet
            </Link>
          </div>

          {myOrders.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Aucune vente enregistrée pour le moment. Partagez votre premier produit pour commencer !
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {myOrders.slice(0, 5).map((order) => {
                const commission = myCommissions.find(c => c.orderId === order.id);

                return (
                  <div key={order.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                        <Image src={order.productImage} alt={order.productName} fill className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-900 truncate">{order.productName}</p>
                        <p className="text-[11px] text-slate-500">
                          {order.customerName} • {order.neighborhood}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono">#{order.orderNumber}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-xs font-black text-emerald-700">
                        +{order.resellerCommission.toLocaleString('fr-FR')} FCFA
                      </p>

                      {order.status === 'delivered' && commission?.status === 'locked' && (
                        <span className="inline-block px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-[10px] font-bold">
                          🔒 Bloquée (J+7)
                        </span>
                      )}
                      {order.status === 'delivered' && commission?.status === 'available' && (
                        <span className="inline-block px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-[10px] font-bold">
                          ✅ Disponible
                        </span>
                      )}
                      {order.status === 'in_transit' && (
                        <span className="inline-block px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-md text-[10px] font-bold">
                          🛵 En livraison
                        </span>
                      )}
                      {order.status === 'pending_call' && (
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                          📞 À confirmer
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
