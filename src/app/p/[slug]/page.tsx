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
  const promoParam = searchParams.get('promo');
  const product = state.products.find(p => p.slug === resolvedParams.slug) || state.products[0];

  const reseller = refCode ? state.resellers.find(r => r.referralCode.toUpperCase() === refCode.toUpperCase()) : null;
  const resellerUser = reseller ? state.users.find(u => u.id === reseller.userId) : null;

  // Checkout form states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'home_delivery' | 'pickup_point'>('home_delivery');
  const [selectedPickupPoint, setSelectedPickupPoint] = useState<string>('Hub Central Suguba — Hamdallaye ACI 2000 (Gratuit)');
  const [city, setCity] = useState('Bamako');
  const [neighborhood, setNeighborhood] = useState('');
  const [landmark, setLandmark] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentOption, setPaymentOption] = useState<'full_cod' | 'deposit_momo'>('full_cod');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Promo Code State
  const [promoCodeInput, setPromoCodeInput] = useState(promoParam || '');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(
    promoParam && promoParam.toUpperCase() === 'RAMADAN' ? { code: 'RAMADAN', discount: 2000 } :
    promoParam && promoParam.toUpperCase() === 'TABASKI' ? { code: 'TABASKI', discount: 2000 } :
    promoParam && promoParam.toUpperCase() === 'SUGUBAVIP' ? { code: 'SUGUBAVIP', discount: 1500 } :
    promoParam && promoParam.toUpperCase() === 'BAMAKO' ? { code: 'BAMAKO', discount: 1000 } : null
  );
  const [promoError, setPromoError] = useState('');

  const PROMO_DATABASE: Record<string, number> = {
    'RAMADAN': 2000,
    'TABASKI': 2000,
    'SUGUBAVIP': 1500,
    'BAMAKO': 1000,
    'PROMO2026': 1000,
  };

  const handleApplyPromo = () => {
    setPromoError('');
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) return;

    if (PROMO_DATABASE[code]) {
      setAppliedPromo({ code, discount: PROMO_DATABASE[code] });
    } else {
      setPromoError('Code promo invalide ou expiré');
    }
  };

  const PICKUP_POINTS = [
    { id: 'hub-aci', name: 'Hub Central Suguba — Hamdallaye ACI 2000 (Derrière Clinique Pasteur)', fee: 0, hours: '08h - 19h30' },
    { id: 'relais-badala', name: 'Point Relais Badalabougou — Station Total Pont Fahd', fee: 500, hours: '07h - 21h00' },
    { id: 'relais-marche', name: 'Point Relais Grand Marché — Carrefour Vox Daoula', fee: 500, hours: '08h - 18h30' },
    { id: 'relais-faladie', name: 'Point Relais Faladié — Tour d\'Afrique / Rond-Point', fee: 500, hours: '07h30 - 20h30' },
    { id: 'relais-kalaban', name: 'Point Relais Kalaban-Coro — Face Mairie', fee: 500, hours: '08h - 20h00' },
    { id: 'relais-yirimadio', name: 'Point Relais Yirimadio — Près du Stade du 26 Mars', fee: 500, hours: '08h - 20h00' },
  ];

  const unitPrice = product.publicPrice || product.supplierPrice;
  const deliveryFeeByCity: Record<string, number> = {
    'Bamako': 1500,
    'Kati': 2500,
    'Sikasso': 3500,
    'Ségou': 3500,
    'Kayes': 5000,
    'Mopti': 5000,
  };

  const activePickup = PICKUP_POINTS.find(p => p.name === selectedPickupPoint) || PICKUP_POINTS[0];
  const deliveryFee = fulfillmentMethod === 'pickup_point' ? activePickup.fee : (deliveryFeeByCity[city] || 1500);
  const discountAmount = appliedPromo ? appliedPromo.discount : 0;
  const totalAmount = Math.max(0, (unitPrice * quantity) + deliveryFee - discountAmount);
  const depositAmount = totalAmount >= 30000 ? 3000 : 0;
  const remainingAtDelivery = paymentOption === 'deposit_momo' ? totalAmount - depositAmount : totalAmount;

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone) {
      alert('Veuillez renseigner votre nom et votre numéro de téléphone.');
      return;
    }

    if (fulfillmentMethod === 'home_delivery' && (!neighborhood || !landmark)) {
      alert('Veuillez renseigner votre quartier et votre repère visuel pour la livraison à domicile.');
      return;
    }

    const finalNeighborhood = fulfillmentMethod === 'pickup_point' ? 'Point Relais Partenaire' : neighborhood;
    const finalLandmark = fulfillmentMethod === 'pickup_point' ? selectedPickupPoint : landmark;

    setIsSubmitting(true);
    try {
      const order = sugubaStore.createOrder({
        productId: product.id,
        quantity,
        customerName,
        customerPhone,
        city: fulfillmentMethod === 'pickup_point' ? 'Bamako' : city,
        neighborhood: finalNeighborhood,
        landmark: finalLandmark,
        deliveryNotes: fulfillmentMethod === 'pickup_point' ? `Retrait en Point Relais : ${selectedPickupPoint}` : deliveryNotes,
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

              {/* Choix du mode de livraison */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold text-slate-700">
                  Mode de Réception du Colis :
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFulfillmentMethod('home_delivery')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      fulfillmentMethod === 'home_delivery'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block font-black text-xs">🛵 À Domicile</span>
                    <span className={`text-[10px] block ${fulfillmentMethod === 'home_delivery' ? 'text-slate-300' : 'text-slate-500'}`}>
                      Livré devant votre porte
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFulfillmentMethod('pickup_point')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      fulfillmentMethod === 'pickup_point'
                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                        : 'bg-emerald-50/50 text-emerald-950 border-emerald-200 hover:bg-emerald-100/50'
                    }`}
                  >
                    <span className="block font-black text-xs">🏪 Point Relais</span>
                    <span className={`text-[10px] block ${fulfillmentMethod === 'pickup_point' ? 'text-emerald-200' : 'text-emerald-700'}`}>
                      Gratuit ou 500 F à Bamako
                    </span>
                  </button>
                </div>
              </div>

              {/* Si Point Relais Partenaire sélectionné */}
              {fulfillmentMethod === 'pickup_point' ? (
                <div className="space-y-2 bg-emerald-50/40 p-3.5 rounded-2xl border border-emerald-200">
                  <label className="block text-xs font-bold text-emerald-950">
                    Sélectionner le Point Relais Partenaire à Bamako :
                  </label>
                  <select
                    value={selectedPickupPoint}
                    onChange={(e) => setSelectedPickupPoint(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-emerald-600"
                  >
                    {PICKUP_POINTS.map(point => (
                      <option key={point.id} value={point.name}>
                        {point.name} — {point.fee === 0 ? 'GRATUIT' : `${point.fee} F`} ({point.hours})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-emerald-800">
                    💡 Votre colis sera déposé sous 24h. Vous recevrez un SMS avec votre code de retrait OTP.
                  </p>
                </div>
              ) : (
                <>
                  {/* Ville & Quartier pour Livraison à Domicile */}
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
                        required={fulfillmentMethod === 'home_delivery'}
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
                        required={fulfillmentMethod === 'home_delivery'}
                        placeholder="Ex: En face de la boulangerie de l'ACI, portail blanc"
                        value={landmark}
                        onChange={(e) => setLandmark(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                      />
                    </div>
                  </div>
                </>
              )}

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

              {/* Champ Code Promo */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-bold text-slate-700">
                  Code Promo / Réduction Partenaire :
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Ex: RAMADAN, TABASKI, SUGUBAVIP"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs transition-colors"
                  >
                    Appliquer
                  </button>
                </div>
                {promoError && (
                  <p className="text-[10px] font-bold text-rose-600">{promoError}</p>
                )}
                {appliedPromo && (
                  <p className="text-[10px] font-bold text-emerald-700 flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Code {appliedPromo.code} validé : -{appliedPromo.discount.toLocaleString('fr-FR')} FCFA de réduction !
                  </p>
                )}
              </div>

              {/* Price summary */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Produit ({quantity}x) :</span>
                  <span className="font-semibold">{(unitPrice * quantity).toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Livraison ({city}) :</span>
                  <span className="font-semibold">{deliveryFee.toLocaleString('fr-FR')} FCFA</span>
                </div>

                {appliedPromo && (
                  <div className="flex justify-between text-xs font-bold text-emerald-700 bg-emerald-100/50 p-1.5 rounded-lg">
                    <span>Remise Code Promo ({appliedPromo.code}) :</span>
                    <span>- {appliedPromo.discount.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                )}

                {paymentOption === 'deposit_momo' && (
                  <div className="flex justify-between text-xs font-bold text-amber-700 bg-amber-100/50 p-1.5 rounded-lg">
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

        {/* Section Avis Clients Vérifiés sous OTP */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-base text-slate-900">Avis & Expériences Clients Vérifiés</h3>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full">
                  100% Authentifiés par OTP
                </span>
              </div>
              <p className="text-xs text-slate-500">Témoignages de clients livrés à domicile à Bamako et dans les régions.</p>
            </div>

            <div className="flex items-center space-x-1 text-amber-500 font-black text-sm self-start sm:self-auto">
              <Star className="w-4 h-4 fill-current text-amber-400" />
              <Star className="w-4 h-4 fill-current text-amber-400" />
              <Star className="w-4 h-4 fill-current text-amber-400" />
              <Star className="w-4 h-4 fill-current text-amber-400" />
              <Star className="w-4 h-4 fill-current text-amber-400" />
              <span className="text-slate-900 ml-1.5 text-xs font-black">4.9 / 5 (42 avis)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900 font-bold">Fatoumata Bamba</strong>
                <span className="text-[10px] text-slate-400">Hamdallaye ACI 2000</span>
              </div>
              <div className="flex text-amber-400">
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
              </div>
              <p className="text-slate-600 italic">
                « Livré le jour même devant mon bureau. Le livreur était très poli et m&apos;a demandé le code secret de sécurité. Produit 100% conforme ! »
              </p>
              <div className="flex items-center space-x-1 text-[10px] font-bold text-emerald-700">
                <ShieldCheck className="w-3 h-3" />
                <span>Achat Vérifié par OTP</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900 font-bold">Ousmane Coulibaly</strong>
                <span className="text-[10px] text-slate-400">Kalaban-Coro</span>
              </div>
              <div className="flex text-amber-400">
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
              </div>
              <p className="text-slate-600 italic">
                « Très satisfait de la qualité. J&apos;ai pu tester le produit avant de payer le livreur en espèces. Je recommande Suguba à tout le monde. »
              </p>
              <div className="flex items-center space-x-1 text-[10px] font-bold text-emerald-700">
                <ShieldCheck className="w-3 h-3" />
                <span>Achat Vérifié par OTP</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <strong className="text-slate-900 font-bold">Mariam Traoré</strong>
                <span className="text-[10px] text-slate-400">Badalabougou</span>
              </div>
              <div className="flex text-amber-400">
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
                <Star className="w-3 h-3 fill-current" />
              </div>
              <p className="text-slate-600 italic">
                « Commande passée en 30 secondes sans créer de compte. Paiement par Wave à l&apos;arrivée. Bravo pour le sérieux ! »
              </p>
              <div className="flex items-center space-x-1 text-[10px] font-bold text-emerald-700">
                <ShieldCheck className="w-3 h-3" />
                <span>Achat Vérifié par OTP</span>
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}
