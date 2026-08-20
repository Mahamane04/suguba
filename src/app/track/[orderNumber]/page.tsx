'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ProductImage from '@/components/common/ProductImage';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import MobileMoneyPaymentDesk from '@/components/common/MobileMoneyPaymentDesk';
import { useSugubaStore } from '@/lib/store';
import { whatsappHelper } from '@/lib/whatsapp-helper';
import { 
  CheckCircle2, Clock, Phone, MapPin, Truck, 
  KeyRound, ShieldCheck, MessageCircle, AlertCircle, ArrowLeft
} from 'lucide-react';

export default function OrderTrackingPage() {
  const params = useParams();
  const orderNumber = params?.orderNumber as string;
  const state = useSugubaStore();

  const order = state.orders.find(
    (o) => o.orderNumber.toUpperCase() === orderNumber?.toUpperCase()
  );

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 max-w-lg mx-auto p-6 flex flex-col items-center justify-center text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500" />
          <h1 className="text-xl font-black text-slate-900">Commande introuvable</h1>
          <p className="text-xs text-slate-600">
            Le numéro de commande #{orderNumber} n&apos;existe pas ou a expiré.
          </p>
          <Link
            href="/"
            className="py-2.5 px-4 bg-slate-900 text-white rounded-xl text-xs font-bold"
          >
            Retour au catalogue
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  // Étapes de la commande
  const steps = [
    {
      id: 'step-1',
      title: 'Commande Reçue',
      desc: 'Enregistrée sur la plateforme',
      done: true,
      current: order.status === 'pending_call',
    },
    {
      id: 'step-2',
      title: 'Confirmation Téléphonique',
      desc: order.callVerifiedBy ? `Confirmé par ${order.callVerifiedBy}` : "En attente d'appel Suguba",
      done: ['confirmed', 'dispatched', 'in_transit', 'delivered'].includes(order.status),
      current: order.status === 'confirmed',
    },
    {
      id: 'step-3',
      title: 'Livreur en Route',
      desc: order.driverName ? `${order.driverName} (${order.driverPhone})` : 'Assignation en cours',
      done: ['in_transit', 'delivered'].includes(order.status),
      current: order.status === 'dispatched' || order.status === 'in_transit',
    },
    {
      id: 'step-4',
      title: 'Livré & Encaissé',
      desc: order.deliveredAt ? 'Validation par Code OTP' : 'Remise physique du colis',
      done: order.status === 'delivered',
      current: order.status === 'delivered',
    },
  ];

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://sugubaml.com';
  const whatsappReceiptLink = whatsappHelper.getCustomerReceiptLink(order, appUrl);
  const supportChatLink = whatsappHelper.getSupportChatLink(order.orderNumber);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-16">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        <Link 
          href="/" 
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour au catalogue</span>
        </Link>

        {/* Status Card Header */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Suivi en direct</span>
              <h1 className="text-xl font-black text-slate-900">
                Commande #{order.orderNumber}
              </h1>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-black ${
              order.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
              order.status === 'in_transit' ? 'bg-blue-100 text-blue-800 animate-pulse' :
              'bg-amber-100 text-amber-800'
            }`}>
              {order.status === 'delivered' && 'LIVRÉE'}
              {order.status === 'in_transit' && 'EN COURS DE LIVRAISON'}
              {order.status === 'dispatched' && 'LIVREUR ASSIGNÉ'}
              {order.status === 'confirmed' && 'CONFIRMÉE PAR APPEL'}
              {order.status === 'pending_call' && "EN ATTENTE D'APPEL"}
            </span>
          </div>

          {/* Product Summary */}
          <div className="flex items-center space-x-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-200 shrink-0">
              <ProductImage src={order.productImage} alt={order.productName} fill className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-xs text-slate-900 truncate">{order.productName}</h3>
              <p className="text-[11px] text-slate-500">Quantité : <strong>{order.quantity}</strong></p>
              <p className="text-xs font-black text-emerald-700">Total : {order.totalAmount.toLocaleString('fr-FR')} FCFA</p>
            </div>
          </div>

          {/* Secret OTP Display */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-5 shadow-lg space-y-2 text-center">
            <div className="flex items-center justify-center space-x-1.5 text-xs font-bold text-amber-100 uppercase tracking-wider">
              <KeyRound className="w-4 h-4" />
              <span>Votre Code Secret de Livraison</span>
            </div>
            
            <div className="text-4xl font-black tracking-[0.4em] text-white py-1">
              {order.deliveryOtp}
            </div>

            <p className="text-[11px] text-amber-100/90 leading-tight">
              À donner <strong>UNIQUEMENT</strong> au livreur lors de la remise physique de votre colis.
            </p>
          </div>

          {/* Timeline */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Étapes d&apos;Acheminement
            </h3>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {steps.map((step, idx) => (
                <div key={step.id} className="relative">
                  <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white ${
                    step.done ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}>
                    {step.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <h4 className={`text-xs font-bold ${step.done ? 'text-slate-900' : 'text-slate-400'}`}>
                      {step.title}
                    </h4>
                    <p className="text-[11px] text-slate-500">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Instant 1-Click Mobile Money Desk */}
          {order.status !== 'delivered' && (
            <MobileMoneyPaymentDesk
              amount={order.totalAmount}
              orderNumber={order.orderNumber}
            />
          )}

          {/* WhatsApp Support & Share Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-100">
            <a
              href={whatsappReceiptLink}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-1.5 shadow-xs"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>Recevoir Reçu WhatsApp</span>
            </a>

            <a
              href={supportChatLink}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-3 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-1.5"
            >
              <Phone className="w-4 h-4" />
              <span>Assistance Suguba (+223)</span>
            </a>
          </div>

        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
