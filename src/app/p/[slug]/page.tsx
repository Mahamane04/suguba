'use client';

import React, { useState, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/common/Header';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { 
  ShieldCheck, Truck, Clock, MapPin, Phone, 
  User, CheckCircle2, ArrowRight, ArrowLeft, Star, Sparkles
} from 'lucide-react';

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const state = useSugubaStore();

  const refCode = searchParams.get('ref');
  const product = state.products.find(p => p.slug === resolvedParams.slug) || state.products[0];

  const reseller = refCode ? state.resellers.find(r => r.referralCode.toUpperCase() === refCode.toUpperCase()) : null;
  const resellerUser = reseller ? state.users.find(u => u.id === reseller.userId) : null;

  // Checkout form states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [city, setCity] = useState('Bamako');
  const [neighborhood, setNeighborhood] = useState('');
  const [landmark, setLandmark] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentOption, setPaymentOption] = useState<'full_cod' | 'deposit_momo'>('full_cod');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unitPrice = product.publicPrice || product.supplierPrice;
  const deliveryFeeByCity: Record<string, number> = {
    'Bamako': 1500,
    'Kati': 2500,
    'Sikasso': 3500,
    'Ségou': 3500,
    'Kayes': 5000,
    'Mopti': 5000,
  };
  const deliveryFee = deliveryFeeByCity[city] || 1500;
  const totalAmount = (unitPrice * quantity) + deliveryFee;
  const depositAmount = totalAmount >= 30000 ? 3000 : 0;
  const remainingAtDelivery = paymentOption === 'deposit_momo' ? totalAmount - depositAmount : totalAmount;

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !neighborhood || !landmark) {
      alert('Veuillez renseigner votre nom, numéro de téléphone, quartier et repère visuel.');
      return;
    }

    setIsSubmitting(true);
    try {
      const order = sugubaStore.createOrder({
        productId: product.id,
        quantity,
        customerName,
        customerPhone,
        city,
        neighborhood,
        landmark,
        deliveryNotes,
        resellerCode: refCode || undefined,
      });

      // Déclenchement de l'envoi du SMS OTP en tâche de fond
      fetch('/api/sms/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhone: customerPhone,
          orderNumber: order.orderNumber,
          productName: product.name,
          deliveryOtp: order.deliveryOtp,
          totalAmount: order.totalAmount,
        }),
      }).catch((err) => console.warn('Notification SMS différée:', err));

      router.push(`/order-success/${order.orderNumber}`);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la validation');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-16">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Referral info banner if referred */}
        {resellerUser && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                {resellerUser.fullName.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  Offre recommandée par {resellerUser.fullName}
                </p>
                <p className="text-[10px] text-emerald-700">
                  Partenaire revendeur officiel Suguba
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
              Code : {refCode}
            </span>
          </div>
        )}

        {/* Product Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* Left: Product Images & Quality Guarantees */}
          <div className="space-y-4">
            <div className="relative h-72 sm:h-96 rounded-3xl overflow-hidden bg-white border border-slate-200 shadow-sm">
              <Image src={product.images[0]} alt={product.name} fill className="object-cover" priority />
              <div className="absolute top-3 left-3">
                <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-xs text-white text-xs font-bold">
                  {product.category}
                </span>
              </div>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-3 rounded-2xl border border-slate-200 text-slate-800 shadow-2xs space-y-1">
                <Truck className="w-5 h-5 mx-auto text-emerald-600" />
                <p className="font-bold text-[11px]">Livraison 24h</p>
                <p className="text-[9px] text-slate-500">Partout à Bamako</p>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 text-slate-800 shadow-2xs space-y-1">
                <ShieldCheck className="w-5 h-5 mx-auto text-blue-600" />
                <p className="font-bold text-[11px]">Garantie {product.warrantyMonths} mois</p>
                <p className="text-[9px] text-slate-500">Service certifié</p>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 text-slate-800 shadow-2xs space-y-1">
                <CheckCircle2 className="w-5 h-5 mx-auto text-amber-600" />
                <p className="font-bold text-[11px]">Paiement</p>
                <p className="text-[9px] text-slate-500">À la livraison</p>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-2">
              <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                Description du Produit
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {product.description}
              </p>
            </div>
          </div>

          {/* Right: 1-Click Order Form (Zero Friction) */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border-2 border-emerald-500/80 shadow-xl space-y-5">
            
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                {product.name}
              </h1>
              
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-2xl sm:text-3xl font-black text-emerald-600">
                  {unitPrice.toLocaleString('fr-FR')} FCFA
                </span>
                <span className="text-xs text-slate-400 line-through">
                  {(unitPrice * 1.2).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>

            <form onSubmit={handleOrderSubmit} className="space-y-4 pt-2 border-t border-slate-100">
              
              <div className="space-y-1">
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  Commander en 1 minute (Sans créer de compte)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Payez en espèces ou Mobile Money uniquement quand le livreur arrive chez vous.
                </p>
              </div>

              {/* Quantité */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quantité</label>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-slate-800 text-sm flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="font-black text-base text-slate-900 w-8 text-center">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-slate-800 text-sm flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Nom */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Votre Nom & Prénom *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Moussa Traoré"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-emerald-600"
                  />
                </div>
              </div>

              {/* Téléphone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Numéro de Téléphone (Appel / WhatsApp) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    placeholder="Ex: 70 12 34 56"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-emerald-600"
                  />
                </div>
              </div>

              {/* Ville & Quartier */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ville *</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                  >
                    <option value="Bamako">Bamako (1 500 F)</option>
                    <option value="Kati">Kati (2 500 F)</option>
                    <option value="Sikasso">Sikasso - Gare SONEF (3 500 F)</option>
                    <option value="Ségou">Ségou - Gare BTM (3 500 F)</option>
                    <option value="Kayes">Kayes - Gare SONEF (5 000 F)</option>
                    <option value="Mopti">Mopti / Sévaré - Gare (5 000 F)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Quartier *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Hamdallaye ACI"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Repère visuel (Indispensable) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Repère Visuel Précis (Pharmacie, École, Station...) *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: En face de la boulangerie de l'ACI, portail blanc"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Mode de règlement & Option d'Acompte */}
              {depositAmount > 0 && (
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Option de Livraison & Règlement :
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentOption('full_cod')}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        paymentOption === 'full_cod' 
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block font-black text-xs">💵 100% à la Livraison</span>
                      <span className={`text-[10px] block ${paymentOption === 'full_cod' ? 'text-slate-300' : 'text-slate-500'}`}>
                        Payez la totalité au livreur
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentOption('deposit_momo')}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        paymentOption === 'deposit_momo' 
                          ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs' 
                          : 'bg-emerald-50/50 text-emerald-950 border-emerald-200 hover:bg-emerald-100/50'
                      }`}
                    >
                      <span className="block font-black text-xs">⚡ Prioritaire (Acompte 3 000 F)</span>
                      <span className={`text-[10px] block ${paymentOption === 'deposit_momo' ? 'text-emerald-200' : 'text-emerald-700'}`}>
                        Bloqué par Wave/Orange Money
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Price summary */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Produit ({quantity}x) :</span>
                  <span className="font-semibold">{(unitPrice * quantity).toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Livraison à domicile Bamako :</span>
                  <span className="font-semibold">1 500 FCFA</span>
                </div>

                {paymentOption === 'deposit_momo' && (
                  <div className="flex justify-between text-xs font-bold text-emerald-700 bg-emerald-100/50 p-1.5 rounded-lg">
                    <span>Acompte de réservation :</span>
                    <span>- {depositAmount.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>Reste à payer au livreur :</span>
                  <span className="text-emerald-700">{remainingAtDelivery.toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-4 px-4 rounded-2xl text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]"
              >
                <span>Confirmer Ma Commande ({totalAmount.toLocaleString('fr-FR')} F)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

            </form>

          </div>

        </div>

      </main>
    </div>
  );
}
