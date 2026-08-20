'use client';

import React, { use } from 'react';
import Link from 'next/link';
import ProductImage from '@/components/common/ProductImage';
import Header from '@/components/common/Header';
import MobileMoneyPaymentDesk from '@/components/common/MobileMoneyPaymentDesk';
import { useSugubaStore } from '@/lib/store';
import { 
  CheckCircle2, KeyRound, ShieldCheck, MapPin, 
  Phone, ArrowRight, Home, ShoppingBag, Truck
} from 'lucide-react';

export default function OrderSuccessPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const resolvedParams = use(params);
  const state = useSugubaStore();

  const order = state.orders.find(o => o.orderNumber === resolvedParams.orderNumber) || state.orders[0];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-16">
      <Header />

      <main className="flex-1 max-w-xl mx-auto px-4 sm:px-6 py-8 w-full">
        
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xl text-center space-y-6">
          
          {/* Success Icon */}
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/15">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          {/* Title */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Commande #{order.orderNumber}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 pt-2">
              Merci pour votre commande !
            </h1>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              Notre service client va vous appeler sur le <strong>{order.customerPhone}</strong> pour confirmer avant l&apos;envoi du livreur.
            </p>
          </div>

          {/* The Secret Delivery OTP Box */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-3xl p-5 shadow-lg space-y-2">
            <div className="flex items-center justify-center space-x-1.5 text-xs font-bold text-amber-100">
              <KeyRound className="w-4 h-4 text-amber-200" />
              <span>Votre Code Secret de Livraison Suguba</span>
            </div>
            
            <div className="bg-white text-slate-950 font-mono text-3xl font-black py-3 px-6 rounded-2xl tracking-[0.4em] inline-block shadow-inner">
              {order.deliveryOtp}
            </div>

            <p className="text-[11px] text-amber-100 max-w-xs mx-auto leading-tight">
              ⚠️ Donnez ce code au livreur <strong>uniquement</strong> après avoir reçu et vérifié votre colis.
            </p>
          </div>

          {/* Order Details Summary */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2.5 text-xs">
            <div className="flex items-center space-x-3 pb-2 border-b border-slate-200">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-200 shrink-0">
                <ProductImage src={order.productImage} alt={order.productName} fill className="object-cover" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 truncate">{order.productName}</p>
                <p className="text-slate-500">Quantité : {order.quantity}</p>
              </div>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Destinataire :</span>
              <span className="font-bold text-slate-900">{order.customerName} ({order.customerPhone})</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Lieu de livraison :</span>
              <span className="font-bold text-slate-900">{order.neighborhood} — {order.landmark}</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Mode de règlement :</span>
              <span className="font-bold text-slate-900">À la livraison (Espèces ou Mobile Money)</span>
            </div>

            <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
              <span>Total à payer au livreur :</span>
              <span className="text-emerald-700">{order.totalAmount.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>

          {/* Instant 1-Click Mobile Money Desk */}
          <MobileMoneyPaymentDesk
            amount={order.totalAmount}
            orderNumber={order.orderNumber}
          />

          {/* Action Links */}
          <div className="space-y-2 pt-2">
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                `🎉 *SUGUBA.ML — Reçu Commande #${order.orderNumber}*\n\nProduit : ${order.productName}\nTotal : ${order.totalAmount.toLocaleString('fr-FR')} FCFA\n🔑 Mon Code OTP : ${order.deliveryOtp}\n📍 Repère : ${order.landmark} (${order.neighborhood})`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-3.5 px-4 rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-xs"
            >
              <span>📲 Sauvegarder mon Reçu & Code sur WhatsApp</span>
            </a>

            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/track/${order.orderNumber}`}
                className="py-3 px-3 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold border border-blue-200 rounded-2xl text-xs flex items-center justify-center space-x-1.5"
              >
                <Truck className="w-4 h-4 text-blue-700" />
                <span>Suivre ma course</span>
              </Link>

              <Link
                href="/"
                className="py-3 px-3 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-1.5"
              >
                <Home className="w-4 h-4" />
                <span>Accueil</span>
              </Link>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
