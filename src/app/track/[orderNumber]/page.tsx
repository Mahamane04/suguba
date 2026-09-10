'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ProductImage from '@/components/common/ProductImage';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import SasPayPaymentDesk from '@/components/common/SasPayPaymentDesk';
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

  // Commande retrouvée par le serveur après vérification du téléphone. Elle
  // prend le pas sur le store local, qui ne contient rien sur un autre appareil.
  const [commandeDistante, setCommandeDistante] = useState<any>(null);
  const [telephone, setTelephone] = useState('');
  const [erreurSuivi, setErreurSuivi] = useState('');
  const [recherche, setRecherche] = useState(false);

  const orderLocal = state.orders.find(
    (o) => o.orderNumber.toUpperCase() === orderNumber?.toUpperCase()
  );
  const order = orderLocal || commandeDistante;

  const rechercher = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreurSuivi('');
    setRecherche(true);
    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, phone: telephone }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErreurSuivi(json.error || 'Commande introuvable avec ces informations.');
        return;
      }
      setCommandeDistante(json.commande);
    } catch {
      setErreurSuivi('Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setRecherche(false);
    }
  };

  // Le store local ne contient les commandes que sur l'appareil qui les a
  // passées. Ailleurs — téléphone changé, cache vidé, cybercafé — on demande
  // le numéro du client pour prouver que la commande est bien la sienne,
  // plutôt que d'annoncer bêtement « introuvable ».
  if (!order) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 max-w-lg mx-auto p-6 w-full flex flex-col justify-center space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-black text-slate-900">Confirmez que c&apos;est bien vous</h1>
            <p className="text-xs text-slate-600">
              Entrez le numéro de téléphone donné lors de la commande
              <strong className="text-slate-900"> #{orderNumber}</strong>.
            </p>
          </div>

          <form onSubmit={rechercher} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="space-y-2">
              <label htmlFor="tel-suivi" className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                Votre numéro de téléphone
              </label>
              <input
                id="tel-suivi"
                type="tel"
                inputMode="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="Ex : 70 12 34 56"
                className="w-full h-12 px-4 rounded-2xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-slate-900"
              />
            </div>

            {erreurSuivi && (
              <div className="flex items-start space-x-2 bg-red-50 border border-red-200 rounded-2xl p-3">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-800 font-medium">{erreurSuivi}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={recherche || telephone.replace(/\D/g, '').length < 8}
              className="w-full h-[52px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:bg-slate-300 disabled:active:scale-100 text-white font-black px-4 rounded-2xl text-sm transition-all"
            >
              {recherche ? 'Recherche…' : 'Voir ma commande'}
            </button>

            <p className="text-[10px] text-slate-400 text-center">
              Ce numéro nous sert uniquement à vérifier que la commande est la vôtre.
            </p>
          </form>

          <Link href="/" className="text-center text-xs font-bold text-slate-500 hover:text-slate-900">
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

          {/* Encaissement mobile money via SasPay. Le composant vérifie
              lui-même à l'ouverture si la commande est déjà réglée. */}
          {order.status !== 'delivered' && !order.paymentCollected && (
            <SasPayPaymentDesk
              amount={order.totalAmount}
              orderNumber={order.orderNumber}
              defaultPhone={order.customerPhone}
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
