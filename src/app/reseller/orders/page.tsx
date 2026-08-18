'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import { useSugubaStore } from '@/lib/store';
import { 
  ShoppingBag, Phone, MapPin, Clock, CheckCircle2, 
  Truck, AlertCircle, Shield, KeyRound, Calendar
} from 'lucide-react';

export default function ResellerOrdersPage() {
  const state = useSugubaStore();
  const [filter, setFilter] = useState<string>('all');

  const reseller = state.resellers.find(r => r.userId === state.currentUser.id) || state.resellers[0];
  const myOrders = state.orders.filter(o => o.resellerId === reseller?.id);

  const filteredOrders = filter === 'all'
    ? myOrders
    : myOrders.filter(o => {
        if (filter === 'delivered') return o.status === 'delivered';
        if (filter === 'in_transit') return o.status === 'in_transit' || o.status === 'dispatched';
        if (filter === 'pending') return o.status === 'pending_call' || o.status === 'confirmed';
        return true;
      });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full space-y-5">
        
        {/* Page Title */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Mes Ventes & Suivi des Commandes
          </h1>
          <p className="text-xs text-slate-500">
            Suivez en temps réel la livraison de vos clients et le déblocage de vos commissions.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: `Toutes (${myOrders.length})` },
            { id: 'delivered', label: 'Livrées & Payées' },
            { id: 'in_transit', label: 'En cours de livraison' },
            { id: 'pending', label: 'À confirmer' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                filter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders List */}
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-xs border border-slate-200">
              Aucune commande trouvée pour ce filtre.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const commission = state.commissions.find(c => c.orderId === order.id);

              return (
                <div 
                  key={order.id}
                  className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3"
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        #{order.orderNumber}
                      </span>
                      <span className="text-[11px] text-slate-400">•</span>
                      <span className="text-[11px] text-slate-500 flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {order.status === 'delivered' && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-black flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Livré & Encaissé</span>
                        </span>
                      )}
                      {order.status === 'in_transit' && (
                        <span className="px-2.5 py-1 rounded-full bg-blue-100 border border-blue-300 text-blue-800 text-[11px] font-black flex items-center space-x-1">
                          <Truck className="w-3 h-3 text-blue-600" />
                          <span>En cours de livraison</span>
                        </span>
                      )}
                      {order.status === 'dispatched' && (
                        <span className="px-2.5 py-1 rounded-full bg-purple-100 border border-purple-300 text-purple-800 text-[11px] font-black">
                          🛵 Livreur assigné
                        </span>
                      )}
                      {order.status === 'pending_call' && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-black flex items-center space-x-1">
                          <Phone className="w-3 h-3 text-amber-600" />
                          <span>Appel Suguba en attente</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Details */}
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    
                    {/* Product info */}
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                        <Image src={order.productImage} alt={order.productName} fill className="object-cover" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <h4 className="font-bold text-xs text-slate-900 truncate">{order.productName}</h4>
                        <p className="text-[11px] text-slate-500">
                          Quantité : <strong>{order.quantity}</strong> • Montant : <strong>{order.totalAmount.toLocaleString('fr-FR')} FCFA</strong>
                        </p>
                        <p className="text-[11px] text-emerald-700 font-black">
                          Ta Commission : +{order.resellerCommission.toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>
                    </div>

                    {/* Customer & Location */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs space-y-1 sm:w-72">
                      <p className="font-bold text-slate-800 flex items-center">
                        <span className="text-slate-400 mr-1.5 font-normal">Client :</span>
                        {order.customerName} ({order.customerPhone})
                      </p>
                      <p className="text-slate-600 flex items-start">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0 mt-0.5" />
                        <span>{order.neighborhood} — {order.landmark}</span>
                      </p>
                      {order.driverName && (
                        <p className="text-slate-600 text-[11px] pt-1 border-t border-slate-200">
                          Livreur : <strong>{order.driverName}</strong>
                        </p>
                      )}
                    </div>

                  </div>

                  {/* Commission Lifecycle Step */}
                  <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      <span className="text-slate-700">
                        {commission?.status === 'available' && 'Commission disponible pour retrait immédiat !'}
                        {commission?.status === 'locked' && `Commission sécurisée en attente J+${commission.safetyWindowDays} (anti-retour).`}
                        {commission?.status === 'pending' && 'Commission en cours de validation livraison.'}
                        {commission?.status === 'potential' && 'Commission potentielle (en attente confirmation commande).'}
                      </span>
                    </div>
                    <span className="font-black text-emerald-800 text-xs">
                      +{order.resellerCommission.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>

                </div>
              );
            })
          )}
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
