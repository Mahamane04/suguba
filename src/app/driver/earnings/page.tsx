'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import PrintableReceiptModal from '@/components/common/PrintableReceiptModal';
import { useSugubaStore } from '@/lib/store';
import { Order } from '@/types';
import { 
  Wallet, Banknote, ArrowLeft, CheckCircle2, 
  Fuel, ShieldCheck, Printer, ArrowRight, Clock, MapPin, DollarSign, Sparkles
} from 'lucide-react';

export default function DriverEarningsPage() {
  const state = useSugubaStore();
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);
  const [declaredRemittance, setDeclaredRemittance] = useState(false);

  const currentUser = state.currentUser;
  const driver = state.drivers.find(d => d.userId === currentUser.id) || state.drivers[0];

  // Livraisons réalisées par ce livreur
  const myDeliveredOrders = state.orders.filter(
    o => o.driverId === driver?.id && o.status === 'delivered'
  );

  // Calculs financiers
  const courierFeePerDelivery = 1000; // 1 000 FCFA net par livraison pour le coursier
  const totalCourierEarnings = myDeliveredOrders.length * courierFeePerDelivery;
  const fuelAllowance = myDeliveredOrders.length >= 5 ? 2500 : 1000; // Prime carburant journalière
  
  // Total cash client collecté
  const totalCashInBag = myDeliveredOrders.reduce((acc, o) => acc + o.totalAmount, 0);
  
  // Net à verser à la caisse centrale Suguba = Cash collecté - Gains du livreur
  const netDueToSugubaHub = Math.max(0, totalCashInBag - totalCourierEarnings);

  const handleDeclareRemittance = () => {
    setDeclaredRemittance(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <Link 
              href="/driver" 
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour aux courses du jour</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Portefeuille & Clôture de Caisse Livreur
            </h1>
            <p className="text-xs text-slate-500">
              Suivi transparent de vos gains de course et du cash en espèces à reverser au Hub.
            </p>
          </div>

          <div className="bg-slate-900 text-white px-4 py-2 rounded-2xl text-xs flex items-center space-x-2 self-start sm:self-auto">
            <Fuel className="w-4 h-4 text-amber-400" />
            <span>Indemnité Carburant : <strong>+{fuelAllowance.toLocaleString('fr-FR')} F</strong></span>
          </div>
        </div>

        {/* 3 Main Wallet Financial Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Vos Gains Livreur */}
          <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Mes Gains de Courses</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-700">
              {(totalCourierEarnings + fuelAllowance).toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-500">FCFA</span>
            </p>
            <p className="text-[10px] text-emerald-600 font-bold">
              {myDeliveredOrders.length} courses (+ {fuelAllowance.toLocaleString('fr-FR')} F carburant)
            </p>
          </div>

          {/* Cash dans la sacoche */}
          <div className="bg-white p-5 rounded-3xl border border-amber-300 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">Cash dans ma Sacoche</span>
              <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-900">
              {totalCashInBag.toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-500">FCFA</span>
            </p>
            <p className="text-[10px] text-amber-800 font-medium">Total espèces clients encaissé</p>
          </div>

          {/* Net à verser au Hub Suguba */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-md space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">À Verser au Hub Suguba</span>
              <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-300">
              {netDueToSugubaHub.toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-300">FCFA</span>
            </p>
            <p className="text-[10px] text-slate-300">Après déduction de vos gains</p>
          </div>

        </div>

        {/* Daily Cash Clearance Action Box */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-black text-sm text-slate-900">
                Clôture Journalière & Versement Caisse
              </h2>
              <p className="text-xs text-slate-500">
                Reverser les espèces collectées au Hub Central Suguba (ACI 2000) ou par Wave / Orange Money.
              </p>
            </div>

            {declaredRemittance ? (
              <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Versement Déclaré au Hub</span>
              </span>
            ) : (
              <button
                onClick={handleDeclareRemittance}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs shadow-md transition-all active:scale-95 flex items-center space-x-1.5 self-start sm:self-auto"
              >
                <span>Déclarer mon Versement ({netDueToSugubaHub.toLocaleString('fr-FR')} F)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <strong className="text-slate-900 block">Option 1 : Dépôt Physique</strong>
              <p className="text-slate-600">Remise des espèces à la caisse du Hub Suguba ACI 2000 (derrière la Clinique Pasteur) avant 19h00.</p>
            </div>

            <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-1">
              <strong className="text-emerald-950 block">Option 2 : Virement Mobile Money</strong>
              <p className="text-slate-600">Dépôt direct sur le compte marchand Suguba Wave / Orange Money au <strong>+223 89 46 00 00</strong>.</p>
            </div>
          </div>
        </div>

        {/* Delivered Orders Manifest Table */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-black text-sm text-slate-900">
              Bordereau des Courses Validées Aujourd&apos;hui ({myDeliveredOrders.length})
            </h3>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl">
              100% Validé sous OTP
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {myDeliveredOrders.map((order) => (
              <div key={order.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-slate-900">#{order.orderNumber}</span>
                    <span className="font-bold text-slate-900">{order.customerName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{order.customerPhone}</span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    {order.productName} • {order.neighborhood} (Repère : {order.landmark})
                  </p>
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-auto">
                  <button
                    onClick={() => setSelectedOrderForReceipt(order)}
                    className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] flex items-center space-x-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Reçu</span>
                  </button>

                  <div className="text-right">
                    <span className="font-black text-slate-900 block">
                      {order.totalAmount.toLocaleString('fr-FR')} F
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold">
                      Gain : +1 000 F
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Printable Receipt Modal */}
      {selectedOrderForReceipt && (
        <PrintableReceiptModal
          order={selectedOrderForReceipt}
          isOpen={!!selectedOrderForReceipt}
          onClose={() => setSelectedOrderForReceipt(null)}
        />
      )}

      <Footer />
      <BottomNav />
    </div>
  );
}
