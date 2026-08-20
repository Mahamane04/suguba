'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import CloudSyncBadge from '@/components/common/CloudSyncBadge';
import ProductPricingModal from '@/components/admin/ProductPricingModal';
import PendingProfilesPanel from '@/components/admin/PendingProfilesPanel';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { whatsappHelper } from '@/lib/whatsapp-helper';
import { Product, Order } from '@/types';
import { 
  ShieldCheck, PhoneCall, Truck, Wallet, ShoppingBag, 
  Clock, CheckCircle2, TrendingUp, AlertCircle, ArrowRight,
  ExternalLink, UserCheck, ShieldAlert, MessageCircle, BarChart3, Radio,
  Building2, QrCode, Settings, Trash2, UserCog, RotateCcw, Sparkles, X, Check
} from 'lucide-react';

export default function AdminDashboardPage() {
  const state = useSugubaStore();
  const [selectedProductForPricing, setSelectedProductForPricing] = useState<Product | null>(null);
  const [agencyCodeInput, setAgencyCodeInput] = useState('');
  const [agencyCodeFeedback, setAgencyCodeFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Admin Config & Data Purge State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [adminNameInput, setAdminNameInput] = useState(state.currentUser.fullName || 'Directeur Opérations Suguba');
  const [adminPhoneInput, setAdminPhoneInput] = useState(state.currentUser.phone || '+223 89 46 00 00');
  const [adminCityInput, setAdminCityInput] = useState(state.currentUser.city || 'Bamako (Hamdallaye ACI 2000)');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [promotePhoneInput, setPromotePhoneInput] = useState('');
  const [promoteBusy, setPromoteBusy] = useState(false);

  // Onboarding Desk Tab
  const [onboardingTab, setOnboardingTab] = useState<'suppliers' | 'drivers' | 'resellers' | 'diaspora'>('suppliers');

  const pendingProducts = state.products.filter(p => p.status === 'submitted');
  const pendingCallOrders = state.orders.filter(o => o.status === 'pending_call');
  const confirmedOrders = state.orders.filter(o => o.status === 'confirmed');
  const inTransitOrders = state.orders.filter(o => o.status === 'in_transit');
  const pendingPayouts = state.withdrawals.filter(w => w.status === 'pending');
  const pendingSuppliers = state.suppliers.filter(s => s.status === 'pending_approval');
  const pendingDrivers = state.drivers.filter(d => d.status === 'pending_approval');

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
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-purple-800 text-purple-200 text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-300" />
                <span>Tour de Contrôle Opérationnelle</span>
              </div>
              <CloudSyncBadge />
            </div>
            <h1 className="text-xl sm:text-2xl font-black">
              Suguba Master Ops Desk
            </h1>
            <p className="text-xs text-purple-200">
              Pilotage des flux : Fournisseurs $\rightarrow$ Revendeurs $\rightarrow$ Confirmation Appels $\rightarrow$ Dispatch Livraisons $\rightarrow$ Finances.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/launch-checklist"
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-black shadow-md transition-all active:scale-95"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Checklist & Audit 100%</span>
            </Link>

            <Link
              href="/admin/reports/daily"
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Rapport Flash Soir</span>
            </Link>

            <Link
              href="/admin/broadcast"
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <Radio className="w-3.5 h-3.5 text-purple-200 animate-pulse" />
              <span>Diffusion Broadcast</span>
            </Link>

            <Link
              href="/admin/sav"
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Desk SAV & Retours</span>
            </Link>

            <Link
              href="/admin/analytics"
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Analytics & Trésorerie</span>
            </Link>

            <button
              onClick={() => setShowConfigModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-md transition-all active:scale-95"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Compte Admin & Nettoyage</span>
            </button>
          </div>
        </div>

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold ${
            actionFeedback.type === 'success' 
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
              : 'bg-rose-100 text-rose-900 border border-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {actionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-700" /> : <AlertCircle className="w-4 h-4 text-rose-700" />}
              <span>{actionFeedback.message}</span>
            </div>
            <button 
              onClick={() => setActionFeedback(null)}
              className="p-1 hover:bg-black/10 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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

          <PendingProfilesPanel />

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

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="py-2 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-bold flex items-center justify-center space-x-1 shadow-2xs"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>Appeler</span>
                      </a>

                      <a
                        href={whatsappHelper.getUnreachableFollowUpLink(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-[10px] font-bold flex items-center justify-center space-x-1 shadow-2xs"
                      >
                        <MessageCircle className="w-3 h-3 fill-current" />
                        <span>Relance FR</span>
                      </a>

                      <a
                        href={whatsappHelper.getBambaraFollowUpLink(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-2 bg-[#128C7E] hover:bg-[#0e7064] text-white rounded-xl text-[10px] font-bold flex items-center justify-center space-x-1 shadow-2xs"
                      >
                        <MessageCircle className="w-3 h-3 fill-current" />
                        <span>Bambara</span>
                      </a>

                      <button
                        onClick={() => sugubaStore.confirmOrderCall(order.id, state.currentUser.fullName)}
                        className="py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black flex items-center justify-center space-x-1 shadow-2xs"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Valider</span>
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
                <h2 className="font-black text-sm text-slate-900">Validation des Retraits Mobile Money & Guichet Agence</h2>
                <p className="text-[10px] text-slate-500">Exécuter les virements Orange Money / Wave ou décaisser les espèces au Guichet</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
              {pendingPayouts.length} en attente
            </span>
          </div>

          {/* Guichet Express Code Validation Box */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
              <Building2 className="w-4 h-4 text-emerald-700" />
              <span>Guichet Express : Validation Retrait Espèces par Code (Agence Bamako)</span>
            </div>
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!agencyCodeInput.trim()) return;
                const res = sugubaStore.processAgencyPickupCode(agencyCodeInput, state.currentUser.fullName);
                setAgencyCodeFeedback(res);
                if (res.success) setAgencyCodeInput('');
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                placeholder="Entrez le Code Guichet (ex: SUG-8492)..."
                value={agencyCodeInput}
                onChange={(e) => setAgencyCodeInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-xs whitespace-nowrap active:scale-95 transition-transform"
              >
                Valider & Décaisser Espèces
              </button>
            </form>

            {agencyCodeFeedback && (
              <div className={`p-3 rounded-xl text-xs font-bold ${agencyCodeFeedback.success ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-200'}`}>
                {agencyCodeFeedback.message}
              </div>
            )}
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
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-xs text-slate-900">
                        {wth.amount.toLocaleString('fr-FR')} FCFA pour <strong>{wth.resellerName}</strong>
                      </p>
                      {wth.pickupCode && (
                        <span className="font-mono text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md">
                          Guichet: {wth.pickupCode}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Mode : <strong className="text-slate-800">{wth.payoutProvider}</strong> ({wth.payoutPhone}) • Réf : {wth.withdrawalCode}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const ref = prompt('Entrez la référence de transaction Mobile Money ou Quittance Guichet :');
                      sugubaStore.processWithdrawal(wth.id, ref || '', state.currentUser.fullName);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs whitespace-nowrap"
                  >
                    Valider le virement/paiement
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

        {/* Desk 6: Validation des Inscriptions & Onboarding Partenaires (Fournisseurs, Livreurs, Revendeurs & Diaspora) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-black text-sm text-slate-900">Validation des Inscriptions & Onboarding</h2>
                <p className="text-[10px] text-slate-500">Valider les nouveaux Fournisseurs, Livreurs et gérer les paliers Revendeurs & Diaspora</p>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setOnboardingTab('suppliers')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  onboardingTab === 'suppliers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Fournisseurs {pendingSuppliers.length > 0 && `(${pendingSuppliers.length})`}
              </button>
              <button
                onClick={() => setOnboardingTab('drivers')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  onboardingTab === 'drivers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Livreurs {pendingDrivers.length > 0 && `(${pendingDrivers.length})`}
              </button>
              <button
                onClick={() => setOnboardingTab('resellers')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  onboardingTab === 'resellers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Revendeurs ({state.resellers.length})
              </button>
              <button
                onClick={() => setOnboardingTab('diaspora')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  onboardingTab === 'diaspora' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Diaspora ({(state.diasporaProfiles || []).length})
              </button>
            </div>
          </div>

          {/* TAB 1: Fournisseurs */}
          {onboardingTab === 'suppliers' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Fournisseurs en Attente de Validation :
              </h3>
              {pendingSuppliers.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">✅ Aucun nouveau dossier fournisseur en attente de validation.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingSuppliers.map((sup) => (
                    <div key={sup.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-xs text-slate-900">
                          {sup.companyName} — Gérant : {sup.managerName || 'Non spécifié'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Contact : <strong className="text-slate-800">{sup.contactPhone}</strong> • Entrepôt : {sup.warehouseNeighborhood} ({sup.warehouseAddress})
                        </p>
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-bold">
                          Catégorie : {sup.category || 'Général'} {sup.rccmOrNif && `• NIF: ${sup.rccmOrNif}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            sugubaStore.approveSupplier(sup.id, state.currentUser.fullName);
                            setActionFeedback({
                              type: 'success',
                              message: `✅ Fournisseur ${sup.companyName} validé avec succès !`
                            });
                          }}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs whitespace-nowrap"
                        >
                          Valider Fournisseur
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Motif du rejet du dossier fournisseur :');
                            if (reason) {
                              sugubaStore.rejectSupplier(sup.id, reason, state.currentUser.fullName);
                              setActionFeedback({
                                type: 'error',
                                message: `❌ Dossier fournisseur ${sup.companyName} rejeté.`
                              });
                            }
                          }}
                          className="px-3 py-2 bg-slate-100 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors"
                        >
                          Rejeter
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Livreurs */}
          {onboardingTab === 'drivers' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Livreurs en Attente d&apos;Activation :
              </h3>
              {pendingDrivers.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">✅ Tous les livreurs inscrits sont actifs et validés.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingDrivers.map((drv) => {
                    const driverUser = state.users.find(u => u.id === drv.userId);
                    return (
                      <div key={drv.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-xs text-slate-900">
                            {driverUser?.fullName || 'Livreur'} — {drv.vehicleType}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Téléphone : <strong className="text-slate-800">{driverUser?.phone}</strong> • Immatriculation : {drv.licensePlate}
                          </p>
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold">
                            Zone d&apos;intervention : {drv.zone || 'Bamako'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              sugubaStore.approveDriver(drv.id, state.currentUser.fullName);
                              setActionFeedback({
                                type: 'success',
                                message: `✅ Livreur ${driverUser?.fullName} activé avec succès !`
                              });
                            }}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs whitespace-nowrap"
                          >
                            Activer Livreur
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Motif du refus du livreur :');
                              if (reason) {
                                sugubaStore.rejectDriver(drv.id, reason, state.currentUser.fullName);
                                setActionFeedback({
                                  type: 'error',
                                  message: `❌ Candidature livreur rejetée.`
                                });
                              }
                            }}
                            className="px-3 py-2 bg-slate-100 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors"
                          >
                            Rejeter
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Revendeurs */}
          {onboardingTab === 'resellers' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Gestion des Paliers Revendeurs :
              </h3>
              <div className="divide-y divide-slate-100">
                {state.resellers.map((res) => {
                  const resUser = state.users.find(u => u.id === res.userId);
                  return (
                    <div key={res.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs text-slate-900">{resUser?.fullName || 'Revendeur'}</p>
                          <span className="font-mono text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded">
                            {res.referralCode}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            res.tier === 'vip' ? 'bg-amber-100 text-amber-800' : res.tier === 'verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            Palier: {res.tier.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Tél : {resUser?.phone} • Ventes : {res.successfulOrdersCount} • Solde dispo : {res.availableBalance.toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            sugubaStore.updateResellerTier(res.id, 'vip', state.currentUser.fullName);
                            setActionFeedback({
                              type: 'success',
                              message: `👑 Revendeur ${resUser?.fullName} promu au statut VIP (Déblocage à J+3) !`
                            });
                          }}
                          className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black"
                          title="Accorder le statut VIP pour déblocage J+3"
                        >
                          👑 Promouvoir VIP (J+3)
                        </button>
                        <button
                          onClick={() => {
                            sugubaStore.updateResellerTier(res.id, 'verified', state.currentUser.fullName);
                            setActionFeedback({
                              type: 'success',
                              message: `⭐ Revendeur ${resUser?.fullName} passé au statut Vérifié (J+7) !`
                            });
                          }}
                          className="px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl text-xs font-bold"
                        >
                          ⭐ Vérifié (J+7)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: Diaspora */}
          {onboardingTab === 'diaspora' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Membres Diaspora Inscrits :
              </h3>
              {(state.diasporaProfiles || []).length === 0 ? (
                <p className="text-xs text-slate-400 py-3">Aucun membre diaspora inscrit pour le moment.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {(state.diasporaProfiles || []).map((dia) => (
                    <div key={dia.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs text-slate-900">{dia.fullName}</p>
                          <span className="text-[10px] bg-purple-100 text-purple-900 font-bold px-2 py-0.5 rounded">
                            {dia.countryOfResidence}
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">
                            Devise : {dia.currency}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          WhatsApp : {dia.phone} • Bénéficiaire au Mali : <strong className="text-slate-800">{dia.beneficiaryNameInMali}</strong> ({dia.beneficiaryPhoneInMali}, {dia.beneficiaryNeighborhoodInMali})
                        </p>
                      </div>

                      <a
                        href={`https://wa.me/${dia.phone.replace(/[^\d]/g, '')}?text=Bonjour%20${encodeURIComponent(dia.fullName)}%20bienvenue%20sur%20Suguba%20Diaspora%20!`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-bold flex items-center gap-1 self-start sm:self-auto"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-current" />
                        <span>Contacter WhatsApp</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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

      {/* Admin Config & Ghost Data Purge Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-gray-100 space-y-6 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center">
                  <UserCog className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-gray-900">Compte Admin & Nettoyage Données</h3>
                  <p className="text-xs text-gray-500">Paramétrer vos accès et purger les données fantômes</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1: Coordonnées Administrateur */}
            <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <h4 className="font-black text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>1. Vos Coordonnées Super Admin</span>
              </h4>

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nom Complet de l&apos;Administrateur :</label>
                  <input
                    type="text"
                    value={adminNameInput}
                    onChange={(e) => setAdminNameInput(e.target.value)}
                    placeholder="Ex: Mahamane Haidara..."
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Numéro de Téléphone (SMS / WhatsApp Ops) :</label>
                  <input
                    type="tel"
                    value={adminPhoneInput}
                    onChange={(e) => setAdminPhoneInput(e.target.value)}
                    placeholder="Ex: +223 89 46 00 00 ou +223 76 12 34 56..."
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Ville & Emplacement du Hub Central :</label>
                  <input
                    type="text"
                    value={adminCityInput}
                    onChange={(e) => setAdminCityInput(e.target.value)}
                    placeholder="Ex: Bamako (Hamdallaye ACI 2000)..."
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    sugubaStore.updateAdminProfile(adminNameInput, adminPhoneInput, adminCityInput);
                    setActionFeedback({
                      type: 'success',
                      message: `✅ Profil Super Admin mis à jour avec succès : ${adminNameInput} (${adminPhoneInput}) !`
                    });
                    setShowConfigModal(false);
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors mt-2"
                >
                  Enregistrer les Coordonnées Super Admin
                </button>
              </div>
            </div>

            {/* Section 1bis: Promouvoir un nouvel Admin (accès réel, pas la démo) */}
            <div className="space-y-3.5 bg-purple-50/70 p-4 rounded-2xl border border-purple-200">
              <h4 className="font-black text-xs text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                <UserCog className="w-4 h-4 text-purple-700" />
                <span>1bis. Promouvoir un compte Admin</span>
              </h4>
              <p className="text-[11px] text-purple-800">
                Donne le rôle admin (accès immédiat, sans validation) à un numéro déjà inscrit sur Suguba.
                Le tout premier compte admin, lui, se crée uniquement en ligne de commande — voir <code className="font-mono">scripts/create-admin.js</code>.
              </p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={promotePhoneInput}
                  onChange={(e) => setPromotePhoneInput(e.target.value)}
                  placeholder="+223 70 00 00 00"
                  className="flex-1 px-3.5 py-2 bg-white border border-purple-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="button"
                  disabled={promoteBusy || !promotePhoneInput}
                  onClick={async () => {
                    setPromoteBusy(true);
                    try {
                      const res = await fetch('/api/admin/promote', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: promotePhoneInput }),
                      });
                      const json = await res.json();
                      setActionFeedback(
                        res.ok
                          ? { type: 'success', message: `✅ ${json.phone} promu admin et activé.` }
                          : { type: 'error', message: json.error || 'Échec de la promotion.' }
                      );
                      if (res.ok) setPromotePhoneInput('');
                    } catch (_) {
                      setActionFeedback({ type: 'error', message: 'Erreur réseau.' });
                    } finally {
                      setPromoteBusy(false);
                    }
                  }}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs transition-colors whitespace-nowrap"
                >
                  {promoteBusy ? '...' : 'Promouvoir'}
                </button>
              </div>
            </div>

            {/* Section 2: Purge des Données Fantômes */}
            <div className="space-y-3.5 bg-rose-50/70 p-4 rounded-2xl border border-rose-200">
              <div className="flex items-center gap-1.5 text-rose-900 font-black text-xs uppercase tracking-wider">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>2. Nettoyage & Purge des Données Fantômes</span>
              </div>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                Remet à <strong>0</strong> toutes les commandes factices, faux retraits, et fausses commissions pour vous permettre de réaliser des tests réels de A à Z.
              </p>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Confirmez-vous la suppression de toutes les fausses commandes, faux retraits et fausses commissions ? (Les vrais produits du catalogue seront conservés)')) {
                      sugubaStore.purgeAllGhostData({ keepProducts: true });
                      setActionFeedback({
                        type: 'success',
                        message: '🗑️ Données fantômes purgées avec succès ! Commandes, retraits et commissions réinitialisés à 0. Prêt pour vos tests réels.'
                      });
                      setShowConfigModal(false);
                    }
                  }}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Purger les Données Fantômes (Garder les Produits)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm('ATTENTION : Voulez-vous tout réinitialiser à vide (y compris supprimer tous les produits du catalogue pour repartir de zéro absolu) ?')) {
                      sugubaStore.purgeAllGhostData({ keepProducts: false });
                      setActionFeedback({
                        type: 'success',
                        message: '💥 Base de données 100% vierge ! Vous pouvez maintenant ajouter vos premiers vrais produits fournisseurs.'
                      });
                      setShowConfigModal(false);
                    }
                  }}
                  className="w-full py-2 bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Tout Vider (Base 100% Vierge sans Produits)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Voulez-vous recharger le jeu complet de données de démonstration initial ?')) {
                      sugubaStore.resetDemoData();
                      setActionFeedback({
                        type: 'success',
                        message: '🔄 Jeu de données de démonstration rechargé avec succès !'
                      });
                      setShowConfigModal(false);
                    }
                  }}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Recharger le Jeu de Démo</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
