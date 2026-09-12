'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ProductImage from '@/components/common/ProductImage';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import CloudSyncBadge from '@/components/common/CloudSyncBadge';
import OtpValidationModal from '@/components/driver/OtpValidationModal';
import DeliveryMapModal from '@/components/driver/DeliveryMapModal';
import PrintableReceiptModal from '@/components/common/PrintableReceiptModal';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { cloudSyncService } from '@/lib/cloud-sync';
import EmptyState from '@/components/ui/EmptyState';
import { Order } from '@/types';
import { 
  Truck, Phone, MapPin, KeyRound, CheckCircle2, 
  Banknote, Package, Navigation, AlertCircle, ArrowRight,
  Compass, MessageCircle, Printer, Wallet, ShieldCheck
} from 'lucide-react';

export default function DriverDashboardPage() {
  const state = useSugubaStore();
  const [selectedOrderForOtp, setSelectedOrderForOtp] = useState<Order | null>(null);
  const [selectedOrderForMap, setSelectedOrderForMap] = useState<Order | null>(null);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);

  const currentUser = state.currentUser;
  const [driver, setDriver] = useState<{ vehicleType: string | null; licensePlate: string | null; verifie?: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/driver/me')
      .then((res) => (res.ok ? res.json() : { driver: null }))
      .then((json) => setDriver(json.driver || null))
      .catch(() => setDriver(null));
  }, []);

  // /api/orders/feed ne renvoie déjà que les courses assignées à CE livreur
  // (voir ce fichier — corrigé le 2026-08-26, il renvoyait auparavant TOUTES
  // les commandes à n'importe quel livreur connecté). Filtrer ici par un
  // `driverId` de mock n'aurait plus aucun sens : state.orders EST déjà le
  // périmètre du livreur, seul le statut reste à trier côté client.
  const myAssignedOrders = state.orders.filter(
    o => o.status === 'dispatched' || o.status === 'in_transit'
  );

  const myDeliveredOrders = state.orders.filter(o => o.status === 'delivered');

  // Seulement ce que le livreur a réellement encaissé : une commande déjà
  // payée en ligne (carte diaspora, mobile money) n'entre pas dans sa sacoche.
  const totalCollectedCash = myDeliveredOrders
    .filter((o) => !o.paymentCollected)
    .reduce((acc, o) => acc + o.totalAmount, 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* En-tête livreur — design system (2026-09-11). Il affichait le nom du
            compte de démonstration « Moussa Coulibaly », un badge technique
            « Cloud Live (PostgreSQL Sync) » et le texte brut
            « voir /register/complete ». */}
        <div className="bg-white border border-slate-200 p-5 rounded-3xl space-y-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
              <Truck className="w-3.5 h-3.5" />
              <span>Espace livreur</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              {currentUser.fullName ? `Bonjour, ${currentUser.fullName.split(' ')[0]}` : 'Bonjour'}
            </h1>
            {driver?.vehicleType ? (
              <p className="text-xs text-slate-500">
                Véhicule : <strong className="text-slate-700">{driver.vehicleType}</strong>
                {driver.licensePlate ? ` (${driver.licensePlate})` : ''}
              </p>
            ) : (
              <Link href="/register/complete" className="text-xs font-bold text-suguba-brand hover:underline">
                Compléter mon dossier (véhicule, zone)
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Encaissé à la livraison</p>
              <p className="text-lg font-black text-slate-900">{totalCollectedCash.toLocaleString('fr-FR')} F</p>
            </div>
            <Link
              href="/driver/earnings"
              className="rounded-2xl border border-slate-200 hover:bg-slate-50 p-3 flex items-center gap-2 transition-colors"
            >
              <Wallet className="w-5 h-5 text-slate-700 shrink-0" />
              <span className="text-sm font-bold text-slate-900">Mon portefeuille</span>
            </Link>
          </div>
        </div>

        {/* Active Runs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-base text-slate-900 flex items-center">
              <Navigation className="w-4 h-4 mr-2 text-amber-600" />
              <span>Mes courses en cours ({myAssignedOrders.length})</span>
            </h2>
          </div>

          {myAssignedOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center text-slate-500 text-xs border border-slate-200 shadow-xs">
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

                      {/* Un badge « à encaisser » inconditionnel ferait réclamer
                          au client une somme qu'il a déjà réglée en ligne. */}
                      {order.paymentCollected ? (
                        <div className="px-3 py-1 bg-emerald-100 border border-emerald-300 rounded-full text-emerald-900 font-black text-xs flex items-center space-x-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Déjà payé — ne rien encaisser</span>
                        </div>
                      ) : (
                        <div className="px-3 py-1 bg-amber-100 border border-amber-300 rounded-full text-amber-900 font-black text-xs flex items-center space-x-1">
                          <Banknote className="w-3.5 h-3.5 text-amber-700" />
                          <span>À encaisser : {order.totalAmount.toLocaleString('fr-FR')} F</span>
                        </div>
                      )}
                    </div>

                    {/* Product item */}
                    <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-200 shrink-0">
                        <ProductImage src={order.productImage} alt={order.productName} fill className="object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-slate-900 truncate">{order.productName}</h4>
                        <p className="text-[11px] text-slate-500">Quantité à remettre : <strong>{order.quantity}</strong></p>
                      </div>
                    </div>

                    {/* Step 1: Pickup Location */}
                    {/* Retrait : le fournisseur réel. L'ancien texte affichait
                        « Hub Central Suguba (ACI 2000) », ou l'adresse de stock
                        — toujours « Bamako », la base ne l'enregistre pas. */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center space-x-1.5 text-slate-900 font-bold">
                        <Package className="w-4 h-4 text-slate-600" />
                        <span>1. Récupérer le colis</span>
                      </div>
                      <p className="text-slate-700 pl-5">
                        Chez <strong>{product?.supplierName || 'le fournisseur'}</strong>
                      </p>
                    </div>

                    {/* Step 2: Dropoff Location & Landmark */}
                    <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100 text-xs space-y-1">
                      <div className="flex items-center space-x-1.5 text-emerald-900 font-bold">
                        <MapPin className="w-4 h-4 text-emerald-700" />
                        <span>2. Livrer au client</span>
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
                        className="py-3 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold border border-slate-200 rounded-2xl text-xs flex items-center justify-center space-x-1 transition-colors"
                      >
                        <Compass className="w-4 h-4 text-slate-600" />
                        <span>Itinéraire</span>
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
                        <KeyRound className="w-4 h-4 stroke-[2.5]" />
                        {/* « OTP » : jargon. Le client parle de son « code secret ». */}
                        <span>Code client</span>
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
            Livraisons effectuées
          </h2>

          <div className="divide-y divide-slate-100">
            {myDeliveredOrders.length === 0 && (
              <EmptyState icon={Package} title="Aucune livraison effectuée pour le moment." />
            )}
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
                    <span className="text-[11px] text-emerald-700 font-bold">
                      {order.paymentCollected ? 'Payé en ligne' : 'Encaissé'}
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
          // La validation se fait désormais côté serveur (voir le
          // composant) : sans ce rafraîchissement, la commande resterait
          // affichée "en cours" jusqu'au prochain rechargement de page.
          onSuccess={() => { cloudSyncService.fetchOrdersFromCloud(); }}
        />
      )}

      <BottomNav />
    </div>
  );
}
