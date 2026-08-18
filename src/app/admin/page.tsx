'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import ProductPricingModal from '@/components/admin/ProductPricingModal';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { Product, Order } from '@/types';
import { 
  ShieldCheck, PhoneCall, Truck, Wallet, ShoppingBag, 
  Clock, CheckCircle2, TrendingUp, AlertCircle, ArrowRight,
  ExternalLink, UserCheck, ShieldAlert
} from 'lucide-react';

export default function AdminDashboardPage() {
  const state = useSugubaStore();
  const [selectedProductForPricing, setSelectedProductForPricing] = useState<Product | null>(null);

  const pendingProducts = state.products.filter(p => p.status === 'submitted');
  const pendingCallOrders = state.orders.filter(o => o.status === 'pending_call');
  const confirmedOrders = state.orders.filter(o => o.status === 'confirmed');
  const inTransitOrders = state.orders.filter(o => o.status === 'in_transit');
  const pendingPayouts = state.withdrawals.filter(w => w.status === 'pending');

  const totalGMV = state.orders.reduce((acc, o) => acc + o.totalAmount, 0);
  const totalCommissionsPaid = state.commissions
    .filter(c => c.status === 'available' || c.status === 'locked')
    .reduce((acc, c) => acc + c.amount, 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Admin Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white p-5 sm:p-6 rounded-3xl shadow-lg">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-purple-800 text-purple-200 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-300" />
              <span>Tour de Contrôle Opérationnelle</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black">
              Suguba Master Ops Desk
            </h1>
            <p className="text-xs text-purple-200">
              Pilotage des flux : Fournisseurs $\rightarrow$ Revendeurs $\rightarrow$ Confirmation Appels $\rightarrow$ Dispatch Livraisons $\rightarrow$ Finances.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Link
              href="/admin/analytics"
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Analytics & Trésorerie</span>
            </Link>

            <button
              onClick={() => sugubaStore.resetDemoData()}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold transition-colors"
            >
              Réinitialiser Démo
            </button>
          </div>
        </div>

        {/* Global Financial Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Volume Global (GMV)</span>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {totalGMV.toLocaleString('fr-FR')} <span className="text-xs font-normal">F</span>
            </p>
            <p className="text-[10px] text-slate-400">{state.orders.length} commandes totales</p>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-emerald-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-emerald-700 uppercase">Commissions Générées</span>
            <p className="text-xl sm:text-2xl font-black text-emerald-600">
              {totalCommissionsPaid.toLocaleString('fr-FR')} <span className="text-xs font-normal">F</span>
            </p>
            <p className="text-[10px] text-slate-400">Pour le réseau revendeurs</p>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-amber-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-amber-700 uppercase">Appels à passer</span>
            <p className="text-xl sm:text-2xl font-black text-amber-600">
              {pendingCallOrders.length}
            </p>
            <p className="text-[10px] text-slate-400">Confirmations clients requises</p>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-purple-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-purple-700 uppercase">Retraits en attente</span>
            <p className="text-xl sm:text-2xl font-black text-purple-600">
              {pendingPayouts.length}
            </p>
            <p className="text-[10px] text-slate-400">Virements Mobile Money à exécuter</p>
          </div>
        </div>

        {/* Operational Queues & Priority Action Desks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          
          {/* Desk 1: Call Confirmation Queue (Anti-fausses commandes) */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-black text-sm text-slate-900">Desk Appel Confirmation</h2>
                  <p className="text-[10px] text-slate-500">Validation téléphonique préalable obligatoire</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black">
                {pendingCallOrders.length} en attente
              </span>
            </div>

            {pendingCallOrders.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                ✅ Tous les appels de confirmation ont été traités !
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCallOrders.map((order) => (
                  <div key={order.id} className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-xs text-slate-900">
                          {order.customerName} • <strong className="text-amber-800 font-mono">{order.customerPhone}</strong>
                        </p>
                        <p className="text-[11px] text-slate-600">
                          {order.productName} ({order.quantity}x) — {order.totalAmount.toLocaleString('fr-FR')} FCFA
                        </p>
                        <p className="text-[10px] text-slate-500">
                          📍 {order.neighborhood} ({order.landmark})
                        </p>
                      </div>
                      <span className="font-mono text-[10px] font-bold text-slate-400">#{order.orderNumber}</span>
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1.5 shadow-2xs"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Appeler Client</span>
                      </a>
                      <button
                        onClick={() => sugubaStore.confirmOrderCall(order.id, state.currentUser.fullName)}
                        className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1 shadow-2xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Valider Appel</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desk 2: Products Moderation & Pricing Control */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-black text-sm text-slate-900">Modération Catalogue & Marges</h2>
                  <p className="text-[10px] text-slate-500">Suguba fixe le prix public et la commission fixe</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-black">
                {pendingProducts.length} soumis
              </span>
            </div>

            {pendingProducts.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                ✅ Aucun produit en attente de modération.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingProducts.map((product) => (
                  <div key={product.id} className="p-3.5 bg-purple-50/50 border border-purple-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                        <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-slate-900 truncate">{product.name}</h4>
                        <p className="text-[10px] text-slate-500">Fournisseur : {product.supplierName}</p>
                        <p className="text-[11px] font-black text-blue-700">
                          Prix Fournisseur : {product.supplierPrice.toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedProductForPricing(product)}
                      className="py-2 px-3 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shrink-0 shadow-2xs"
                    >
                      Fixer Prix & Marge
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Desk 3: Driver Dispatch Queue */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-black text-sm text-slate-900">Dispatch & Assignation des Livreurs</h2>
                <p className="text-[10px] text-slate-500">Commandes confirmées prêtes pour la course</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-black">
              {confirmedOrders.length} à dispatcher
            </span>
          </div>

          {confirmedOrders.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              Toutes les livraisons confirmées sont actuellement assignées.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {confirmedOrders.map((order) => (
                <div key={order.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div>
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-900">Commande #{order.orderNumber}</span>
                      <span className="font-black text-emerald-700">{order.totalAmount.toLocaleString('fr-FR')} F</span>
                    </div>
                    <p className="text-xs text-slate-700 mt-1">{order.productName}</p>
                    <p className="text-[11px] text-slate-500">📍 Destination : {order.neighborhood} ({order.landmark})</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <select
                      id={`driver-select-${order.id}`}
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900"
                    >
                      {state.drivers.map((d) => {
                        const user = state.users.find(u => u.id === d.userId);
                        return (
                          <option key={d.id} value={d.id}>
                            {user?.fullName} ({d.vehicleType})
                          </option>
                        );
                      })}
                    </select>

                    <button
                      onClick={() => {
                        const select = document.getElementById(`driver-select-${order.id}`) as HTMLSelectElement;
                        if (select) {
                          sugubaStore.assignDriver(order.id, select.value, state.currentUser.fullName);
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                    >
                      Assigner
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desk 4: Payouts & Mobile Money Payout Validation Desk */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-black text-sm text-slate-900">Validation des Retraits Mobile Money</h2>
                <p className="text-[10px] text-slate-500">Exécuter les virements Orange Money / Wave des revendeurs</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
              {pendingPayouts.length} en attente
            </span>
          </div>

          {pendingPayouts.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              ✅ Toutes les demandes de retrait ont été traitées et payées.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingPayouts.map((wth) => (
                <div key={wth.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-xs text-slate-900">
                      {wth.amount.toLocaleString('fr-FR')} FCFA pour <strong>{wth.resellerName}</strong>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Destination : <strong className="text-slate-800">{wth.payoutProvider}</strong> ({wth.payoutPhone}) • Code : {wth.withdrawalCode}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const ref = prompt('Entrez la référence de transaction Mobile Money (ou laissez vide pour auto-générer) :');
                      sugubaStore.processWithdrawal(wth.id, ref || '', state.currentUser.fullName);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    Valider le virement effectué
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desk 5: Sécurité OTP & Déblocage des Commissions en Garantie */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-black text-sm text-slate-900">Sécurité Antifraude & Déblocage des Commissions</h2>
                <p className="text-[10px] text-slate-500">Supervision des alertes OTP et transfert des commissions verrouillées (J+7 / J+14)</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Commissions Actuellement Verrouillées en Période de Sécurité :
            </h3>

            {state.commissions.filter(c => c.status === 'locked').length === 0 ? (
              <p className="text-xs text-slate-400">Aucune commission verrouillée en ce moment.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {state.commissions.filter(c => c.status === 'locked').map((com) => (
                  <div key={com.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-slate-900">
                        {com.resellerName} — +{com.amount.toLocaleString('fr-FR')} FCFA ({com.productName})
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Période de garantie : J+{com.safetyWindowDays} • Déblocage prévu : {new Date(com.unlockAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    <button
                      onClick={() => sugubaStore.unlockCommissionToAvailable(com.id)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-2xs"
                      title="Simuler l'écoulement des 7 jours de sécurité"
                    >
                      Débloquer vers disponible (Fin J+{com.safetyWindowDays})
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Pricing Modal */}
      {selectedProductForPricing && (
        <ProductPricingModal
          product={selectedProductForPricing}
          isOpen={!!selectedProductForPricing}
          onClose={() => setSelectedProductForPricing(null)}
        />
      )}

      <BottomNav />
    </div>
  );
}
