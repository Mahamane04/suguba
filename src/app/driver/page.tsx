'use client';

import React, { useState } from 'react';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import OtpValidationModal from '@/components/driver/OtpValidationModal';
import DeliveryMapModal from '@/components/driver/DeliveryMapModal';
import PrintableReceiptModal from '@/components/common/PrintableReceiptModal';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { Order } from '@/types';
import { 
  Truck, Phone, MapPin, KeyRound, CheckCircle2, 
  Banknote, Package, Navigation, AlertCircle, ArrowRight,
  Compass, MessageCircle, Printer
} from 'lucide-react';
import Image from 'next/image';

export default function DriverDashboardPage() {
  const state = useSugubaStore();
  const [selectedOrderForOtp, setSelectedOrderForOtp] = useState<Order | null>(null);
  const [selectedOrderForMap, setSelectedOrderForMap] = useState<Order | null>(null);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);

  const currentUser = state.currentUser;
  const driver = state.drivers.find(d => d.userId === currentUser.id) || state.drivers[0];

  // Courses assignées au livreur actif
  const myAssignedOrders = state.orders.filter(
    o => o.driverId === driver?.id && (o.status === 'dispatched' || o.status === 'in_transit')
  );

  const myDeliveredOrders = state.orders.filter(
    o => o.driverId === driver?.id && o.status === 'delivered'
  );

  const totalCollectedCash = myDeliveredOrders.reduce((acc, o) => acc + o.totalAmount, 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Driver Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-700 to-orange-800 text-white p-5 sm:p-6 rounded-3xl shadow-lg">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-600/80 text-amber-100 text-[11px] font-bold">
              <Truck className="w-3.5 h-3.5" />
              <span>Livreur Terrain Partenaire</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black">
              {currentUser.fullName}
            </h1>
            <p className="text-xs text-amber-100">
              Véhicule : <strong>{driver.vehicleType}</strong> ({driver.licensePlate}) • Note : ⭐ {driver.rating}/5
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs border border-white/20 px-4 py-2 rounded-2xl text-right">
            <span className="text-[10px] uppercase font-bold text-amber-200 block">Total Encaissé Aujourd&apos;hui</span>
            <span className="text-lg font-black text-white">{totalCollectedCash.toLocaleString('fr-FR')} FCFA</span>
          </div>
        </div>

        {/* Active Runs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-base text-slate-900 flex items-center">
              <Navigation className="w-4 h-4 mr-2 text-amber-600" />
              <span>Mes Courses Actives ({myAssignedOrders.length})</span>
            </h2>
          </div>

          {myAssignedOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-xs border border-slate-200 shadow-xs">
              <Truck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              Aucune livraison en attente pour le moment.
            </div>
          ) : (
            <div className="space-y-4">
              {myAssignedOrders.map((order) => {
                const product = state.products.find(p => p.id === order.productId);

                return (
                  <div 
                    key={order.id}
                    className="bg-white rounded-3xl p-5 border-2 border-amber-400 shadow-md space-y-4"
                  >
                    {/* Top Status */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="font-mono text-xs font-black text-slate-900">
                          #{order.orderNumber}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          {order.status === 'dispatched' ? 'À récupérer' : 'En cours de livraison'}
                        </span>
                      </div>

                      {/* Cash to collect badge */}
                      <div className="px-3 py-1 bg-amber-100 border border-amber-300 rounded-full text-amber-900 font-black text-xs flex items-center space-x-1">
                        <Banknote className="w-3.5 h-3.5 text-amber-700" />
                        <span>À encaisser : {order.totalAmount.toLocaleString('fr-FR')} F</span>
                      </div>
                    </div>

                    {/* Product item */}
                    <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-200 shrink-0">
                        <Image src={order.productImage} alt={order.productName} fill className="object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-slate-900 truncate">{order.productName}</h4>
                        <p className="text-[11px] text-slate-500">Quantité à remettre : <strong>{order.quantity}</strong></p>
                      </div>
                    </div>

                    {/* Step 1: Pickup Location */}
                    <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 text-xs space-y-1">
                      <div className="flex items-center space-x-1.5 text-blue-900 font-bold">
                        <Package className="w-4 h-4 text-blue-700" />
                        <span>1. Point de Récupération du Colis :</span>
                      </div>
                      <p className="text-slate-700 pl-5">
                        {product?.stockLocationType === 'suguba_hub' ? 'Hub Central Suguba (ACI 2000)' : product?.stockLocationAddress || 'Entrepôt Fournisseur'}
                      </p>
                    </div>

                    {/* Step 2: Dropoff Location & Landmark */}
                    <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100 text-xs space-y-1">
                      <div className="flex items-center space-x-1.5 text-emerald-900 font-bold">
                        <MapPin className="w-4 h-4 text-emerald-700" />
                        <span>2. Destination Client :</span>
                      </div>
                      <p className="font-bold text-slate-900 pl-5">
                        {order.customerName} — <span className="font-mono text-emerald-800">{order.customerPhone}</span>
                      </p>
                      <p className="text-slate-700 pl-5">
                        Quartier : <strong>{order.neighborhood}</strong>
                      </p>
                      <p className="text-slate-700 pl-5 bg-white p-2 rounded-xl border border-emerald-200 font-medium">
                        📍 Repère : {order.landmark}
                      </p>
                      {order.deliveryNotes && (
                        <p className="text-[11px] text-slate-500 pl-5 italic">
                          Note client : {order.deliveryNotes}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                      <button
                        onClick={() => setSelectedOrderForMap(order)}
                        className="py-3 px-2 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold border border-blue-200 rounded-2xl text-[11px] flex items-center justify-center space-x-1 transition-colors"
                      >
                        <Compass className="w-3.5 h-3.5 text-blue-700" />
                        <span>GPS</span>
                      </button>

                      <button
                        onClick={() => setSelectedOrderForReceipt(order)}
                        className="py-3 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 rounded-2xl text-[11px] flex items-center justify-center space-x-1 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-600" />
                        <span>Reçu</span>
                      </button>

                      <a
                        href={`tel:${order.customerPhone}`}
                        className="py-3 px-2 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl text-[11px] flex items-center justify-center space-x-1 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Appel</span>
                      </a>

                      <button
                        onClick={() => setSelectedOrderForOtp(order)}
                        className="py-3 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl text-[11px] shadow-md shadow-amber-600/20 flex items-center justify-center space-x-1 transition-transform active:scale-95"
                      >
                        <KeyRound className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>OTP</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Completed Runs History */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h2 className="font-black text-base text-slate-900">
            Historique des Livraisons Réussies
          </h2>

          <div className="divide-y divide-slate-100">
            {myDeliveredOrders.map((order) => (
              <div key={order.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-slate-900">
                    Commande #{order.orderNumber} • {order.customerName}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {order.neighborhood} • {order.productName}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedOrderForReceipt(order)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Reçu</span>
                  </button>
                  <div className="text-right">
                    <span className="text-xs font-black text-emerald-700 block">
                      {order.totalAmount.toLocaleString('fr-FR')} F
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold">
                      ✅ OTP Validé
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

      {/* Map & GPS Navigation Modal */}
      {selectedOrderForMap && (
        <DeliveryMapModal
          order={selectedOrderForMap}
          isOpen={!!selectedOrderForMap}
          onClose={() => setSelectedOrderForMap(null)}
        />
      )}

      {/* OTP Modal */}
      {selectedOrderForOtp && (
        <OtpValidationModal
          order={selectedOrderForOtp}
          isOpen={!!selectedOrderForOtp}
          onClose={() => setSelectedOrderForOtp(null)}
        />
      )}

      <BottomNav />
    </div>
  );
}
