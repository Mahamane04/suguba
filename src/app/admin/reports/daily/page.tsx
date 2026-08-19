'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore } from '@/lib/store';
import { 
  BarChart3, MessageCircle, Calendar, CheckCircle2, 
  TrendingUp, ShoppingBag, Truck, Users, ArrowLeft, Copy, Check, ShieldCheck
} from 'lucide-react';

export default function AdminDailyReportPage() {
  const state = useSugubaStore();
  const [copied, setCopied] = useState(false);

  const todayStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const deliveredOrders = state.orders.filter(o => o.status === 'delivered');
  const inTransitOrders = state.orders.filter(o => o.status === 'in_transit' || o.status === 'dispatched');
  const pendingCallOrders = state.orders.filter(o => o.status === 'pending_call');

  const totalGmv = deliveredOrders.reduce((acc, o) => acc + o.totalAmount, 0);
  const totalCommissions = deliveredOrders.reduce((acc, o) => acc + (o.resellerCommission || 0), 0);

  const totalSugubaMargin = deliveredOrders.reduce((acc, o) => {
    const product = state.products.find(p => p.id === o.productId);
    const supplierCost = (product?.supplierPrice || 0) * o.quantity;
    const margin = o.totalProductAmount - supplierCost - (o.resellerCommission || 0);
    return acc + Math.max(0, margin);
  }, 0);

  const savTickets = state.savTickets || [];
  const openSav = savTickets.filter(t => t.status !== 'resolved').length;

  const founderWhatsappReport = `📊 *SUGUBA MALI — RAPPORT QUOTIDIEN D'ACTIVITÉ*\n` +
    `🗓️ *Date :* ${todayStr}\n\n` +
    `📦 *FLUX DES COMMANDES :*\n` +
    `• Commandes totales : *${state.orders.length}*\n` +
    `• Livrées & Encaissées : *${deliveredOrders.length}* ✅\n` +
    `• En cours de livraison : *${inTransitOrders.length}* 🛵\n` +
    `• Appels en attente : *${pendingCallOrders.length}* 📞\n\n` +
    `💰 *PERFORMANCE FINANCIÈRE :*\n` +
    `• Volume d'Affaires (GMV) : *${totalGmv.toLocaleString('fr-FR')} FCFA*\n` +
    `• 🏢 *Marge Nette Suguba :* *${totalSugubaMargin.toLocaleString('fr-FR')} FCFA* (Bénéfice)\n` +
    `• 🤝 Commissions Revendeurs : *${totalCommissions.toLocaleString('fr-FR')} FCFA*\n\n` +
    `👥 *RÉSEAU & OPÉRATIONS :*\n` +
    `• Revendeurs actifs : *${state.resellers.length}*\n` +
    `• Livreurs déployés : *${state.drivers.length}*\n` +
    `• Dossiers SAV en cours : *${openSav}*\n\n` +
    `📲 *Plateforme en direct :* https://app.sugubaml.com/admin`;

  const founderPhone = '22389460000';
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${founderPhone}&text=${encodeURIComponent(founderWhatsappReport)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(founderWhatsappReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-16">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link 
              href="/admin" 
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à la console Suguba Ops</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Rapport Flash Quotidien du Fondateur
            </h1>
            <p className="text-xs text-slate-500 capitalize">
              Synthèse opérationnelle pour le {todayStr}.
            </p>
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-black rounded-2xl text-xs shadow-md transition-all self-start sm:self-auto active:scale-95"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            <span>Envoyer Rapport sur WhatsApp (+223 89 46 00 00)</span>
          </a>
        </div>

        {/* 4 Key Executive Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-emerald-800 uppercase">Marge Nette Suguba</span>
            <p className="text-2xl font-black text-emerald-700">
              {totalSugubaMargin.toLocaleString('fr-FR')} <span className="text-xs font-normal">F</span>
            </p>
            <p className="text-[10px] text-emerald-600 font-bold">Bénéfice net du jour</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Volume Global (GMV)</span>
            <p className="text-2xl font-black text-slate-900">
              {totalGmv.toLocaleString('fr-FR')} <span className="text-xs font-normal">F</span>
            </p>
            <p className="text-[10px] text-slate-400">Total encaissé</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Colis Livrés</span>
            <p className="text-2xl font-black text-slate-900">{deliveredOrders.length}</p>
            <p className="text-[10px] text-emerald-600 font-bold">100% avec OTP validé</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-purple-200 shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-purple-800 uppercase">Commissions Réseau</span>
            <p className="text-2xl font-black text-purple-700">
              {totalCommissions.toLocaleString('fr-FR')} <span className="text-xs font-normal">F</span>
            </p>
            <p className="text-[10px] text-purple-600 font-medium">Distribuées aux revendeurs</p>
          </div>
        </div>

        {/* Formatted Report Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              <h2 className="font-black text-sm text-slate-900">
                Aperçu du Rapport Télégram / WhatsApp du Soir
              </h2>
            </div>

            <button
              onClick={handleCopy}
              className="px-3 py-1 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copié !' : 'Copier texte'}</span>
            </button>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-800 whitespace-pre-line leading-relaxed">
            {founderWhatsappReport}
          </div>
        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
