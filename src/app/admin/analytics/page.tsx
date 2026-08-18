'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore } from '@/lib/store';
import { 
  TrendingUp, DollarSign, Download, ArrowLeft, 
  BarChart3, PieChart, ShoppingBag, Truck, Wallet, ShieldCheck 
} from 'lucide-react';

export default function AdminAnalyticsPage() {
  const state = useSugubaStore();

  const deliveredOrders = state.orders.filter(o => o.status === 'delivered');

  // Métriques financières globales
  const totalGmv = deliveredOrders.reduce((acc, o) => acc + o.totalAmount, 0);
  const totalCommissionsPaid = deliveredOrders.reduce((acc, o) => acc + (o.resellerCommission || 0), 0);
  const totalDeliveryFees = deliveredOrders.reduce((acc, o) => acc + (o.deliveryFee || 1500), 0);
  
  // Marge Suguba = Total Produits - Prix Fournisseur - Commission Revendeur
  const totalSugubaMargin = deliveredOrders.reduce((acc, o) => {
    const product = state.products.find(p => p.id === o.productId);
    const supplierCost = (product?.supplierPrice || 0) * o.quantity;
    const margin = o.totalProductAmount - supplierCost - (o.resellerCommission || 0);
    return acc + Math.max(0, margin);
  }, 0);

  // Fonction d'exportation Comptable Excel / CSV
  const handleExportCsv = () => {
    const headers = [
      'Date',
      'Numero Commande',
      'Produit',
      'Quantite',
      'Client',
      'Telephone',
      'Quartier',
      'Repere',
      'Prix Total (FCFA)',
      'Frais Livraison (FCFA)',
      'Commission Revendeur (FCFA)',
      'Marge Nette Suguba (FCFA)',
      'Statut Paiement',
      'Livreur Assigné',
      'Code OTP'
    ];

    const rows = state.orders.map(o => {
      const product = state.products.find(p => p.id === o.productId);
      const supplierCost = (product?.supplierPrice || 0) * o.quantity;
      const margin = o.totalProductAmount - supplierCost - (o.resellerCommission || 0);

      return [
        new Date(o.createdAt).toLocaleDateString('fr-FR'),
        o.orderNumber,
        `"${o.productName.replace(/"/g, '""')}"`,
        o.quantity,
        `"${o.customerName}"`,
        `"${o.customerPhone}"`,
        `"${o.neighborhood}"`,
        `"${o.landmark}"`,
        o.totalAmount,
        o.deliveryFee || 1500,
        o.resellerCommission || 0,
        Math.max(0, margin),
        o.paymentCollected ? 'ENCAISSÉ' : 'EN ATTENTE',
        `"${o.driverName || 'Non assigné'}"`,
        o.deliveryOtp
      ].join(';');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `suguba_journal_comptable_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-16">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Navigation & Title */}
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
              Tableau de Bord Financier & Trésorerie
            </h1>
            <p className="text-xs text-slate-500">
              Suivi en temps réel des marges Suguba, volumes d&apos;affaires et export comptable.
            </p>
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl text-xs shadow-md transition-all self-start sm:self-auto"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Exporter Journal Comptable (Excel / CSV)</span>
          </button>
        </div>

        {/* Big Financial Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Marge Nette Suguba */}
          <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-xs space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Marge Nette Suguba</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-700">
              {totalSugubaMargin.toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-500">FCFA</span>
            </p>
            <p className="text-[10px] text-emerald-600 font-bold">Bénéfice net plateforme</p>
          </div>

          {/* Volume d'Affaires Total (GMV) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Volume d&apos;Affaires (GMV)</span>
              <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900">
              {totalGmv.toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-500">FCFA</span>
            </p>
            <p className="text-[10px] text-slate-500">{deliveredOrders.length} commandes encaissées</p>
          </div>

          {/* Commissions Revendeurs Distribuées */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Commissions Revendeurs</span>
              <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-700">
              {totalCommissionsPaid.toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-500">FCFA</span>
            </p>
            <p className="text-[10px] text-slate-500">Rémunération réseau</p>
          </div>

          {/* Frais de Livraison Encaissés */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Frais de Course</span>
              <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900">
              {totalDeliveryFees.toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-500">FCFA</span>
            </p>
            <p className="text-[10px] text-slate-500">Budget logistique</p>
          </div>

        </div>

        {/* Transactions Table for Accounting */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-black text-sm text-slate-900">
              Registre des Transactions & Répartition Financière
            </h2>
            <span className="text-[11px] font-bold text-slate-500">
              {state.orders.length} transactions enregistrées
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="pb-2">Commande</th>
                  <th className="pb-2">Produit</th>
                  <th className="pb-2">Client & Quartier</th>
                  <th className="pb-2 text-right">Prix Client</th>
                  <th className="pb-2 text-right">Com. Revendeur</th>
                  <th className="pb-2 text-right">Marge Suguba</th>
                  <th className="pb-2 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.orders.map((o) => {
                  const product = state.products.find(p => p.id === o.productId);
                  const supplierCost = (product?.supplierPrice || 0) * o.quantity;
                  const margin = o.totalProductAmount - supplierCost - (o.resellerCommission || 0);

                  return (
                    <tr key={o.id} className="hover:bg-slate-50/80">
                      <td className="py-3 font-mono font-bold text-slate-900">#{o.orderNumber}</td>
                      <td className="py-3 font-medium text-slate-700 max-w-[180px] truncate">{o.productName}</td>
                      <td className="py-3 text-slate-600">
                        <span className="font-bold block text-slate-900">{o.customerName}</span>
                        <span className="text-[10px] text-slate-500">{o.neighborhood}</span>
                      </td>
                      <td className="py-3 font-black text-slate-900 text-right">
                        {o.totalAmount.toLocaleString('fr-FR')} F
                      </td>
                      <td className="py-3 font-bold text-emerald-600 text-right">
                        +{o.resellerCommission.toLocaleString('fr-FR')} F
                      </td>
                      <td className="py-3 font-black text-emerald-800 text-right">
                        +{Math.max(0, margin).toLocaleString('fr-FR')} F
                      </td>
                      <td className="py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          o.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {o.status === 'delivered' ? 'ENCAISSÉ' : 'EN COURS'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
