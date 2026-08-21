'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { cloudSyncService } from '@/lib/cloud-sync';
import { 
  Globe2, CreditCard, HeartHandshake, ShieldCheck, 
  Truck, ArrowRight, CheckCircle2, Phone, MapPin, Sparkles, Star, Camera, Lock
} from 'lucide-react';

export default function DiasporaPortalPage() {
  const state = useSugubaStore();

  const [currency, setCurrency] = useState<'EUR' | 'USD' | 'XOF'>('EUR');
  const [selectedProduct, setSelectedProduct] = useState(state.products[0]);
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryPhone, setBeneficiaryPhone] = useState('');
  const [beneficiaryNeighborhood, setBeneficiaryNeighborhood] = useState('Hamdallaye ACI 2000');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerCountry, setBuyerCountry] = useState('France (Europe)');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [erreurPaiement, setErreurPaiement] = useState('');

  // Les produits arrivent de Supabase APRÈS le montage : selectedProduct,
  // initialisé à products[0] alors que la liste était encore vide, restait
  // indéfiniment undefined et la page annonçait un catalogue vide même quand
  // des articles existaient. On le renseigne dès que la liste se remplit.
  useEffect(() => {
    if (!selectedProduct && state.products.length > 0) {
      setSelectedProduct(state.products[0]);
    }
  }, [state.products, selectedProduct]);

  // Conversion rates
  const eurRate = 655.957; // Taux fixe officiel BCEAO
  const usdRate = 610.0;

  const formatPrice = (xofPrice: number) => {
    if (currency === 'EUR') {
      return `${(xofPrice / eurRate).toFixed(2)} €`;
    }
    if (currency === 'USD') {
      return `$${(xofPrice / usdRate).toFixed(2)}`;
    }
    return `${xofPrice.toLocaleString('fr-FR')} FCFA`;
  };

  /**
   * Encaissement réel par carte via PayDunya.
   *
   * L'ancienne version ne faisait qu'un `setTimeout` avant d'afficher l'écran
   * de succès : la commande était créée mais aucun paiement n'était jamais
   * demandé, et l'acheteur repartait convaincu d'avoir payé. On crée
   * désormais la commande, on s'assure qu'elle existe en base, puis on
   * redirige vers la facture PayDunya. L'écran de succès n'est plus atteint
   * ici : c'est le retour de PayDunya (return_url) qui y mène, une fois le
   * paiement réellement encaissé et l'IPN reçu.
   */
  const handleDiasporaCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreurPaiement('');

    if (!beneficiaryName.trim() || !beneficiaryPhone.trim()) {
      setErreurPaiement('Veuillez renseigner le nom et le numéro du bénéficiaire à Bamako.');
      return;
    }
    if (!selectedProduct) {
      setErreurPaiement('Aucun article sélectionné.');
      return;
    }

    setIsProcessing(true);
    try {
      const commande = sugubaStore.createOrder({
        productId: selectedProduct.id,
        quantity: 1,
        customerName: beneficiaryName.trim(),
        customerPhone: beneficiaryPhone.trim(),
        city: 'Bamako',
        neighborhood: beneficiaryNeighborhood.trim() || 'Hamdallaye ACI 2000',
        landmark: `Commande Diaspora [${buyerCountry}] - Bénéficiaire : ${beneficiaryName}`,
        deliveryNotes: `Paiement en ligne Diaspora (${currency}). Email acheteur : ${buyerEmail || 'Non spécifié'}`,
      });

      // createOrder pousse vers Supabase en arrière-plan sans attendre : sans
      // cette synchro explicite, la facture pourrait être demandée avant que
      // la commande existe en base, et l'API répondrait « introuvable ». La
      // route de synchro est idempotente, ce second envoi est donc sans risque.
      await cloudSyncService.pushOrderToCloud(commande);

      const res = await fetch('/api/payments/paydunya/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Seul le numéro de commande est transmis : le montant est relu en
        // base côté serveur, jamais accepté depuis le navigateur.
        body: JSON.stringify({ orderNumber: commande.orderNumber }),
      });
      const json = await res.json();

      if (!res.ok || !json.success || !json.urlPaiement) {
        setIsProcessing(false);
        setErreurPaiement(json.error || 'Impossible de démarrer le paiement. Réessayez.');
        return;
      }

      window.location.href = json.urlPaiement;
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      setErreurPaiement('Erreur réseau lors du démarrage du paiement.');
    }
  };

  const diasporaPacks = [
    {
      id: 'pack-1',
      title: 'Pack Confort & Autonomie Solaire',
      subtitle: 'Pour vos parents à Bamako (Ventilateur Rechargeable 16" + Kit LED)',
      priceXof: 42000,
      image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&auto=format&fit=crop&q=80',
      badge: 'Bestseller Diaspora',
    },
    {
      id: 'pack-2',
      title: 'Pack Équipement Cuisine Inox 6.5L',
      subtitle: 'Robot Pétrin & Mixeur Pâtissier Haute Puissance 1200W',
      priceXof: 65000,
      image: 'https://images.unsplash.com/photo-1594385208974-2e75f8d7bb48?w=600&auto=format&fit=crop&q=80',
      badge: 'Cadeau Idéal Maman',
    },
    {
      id: 'pack-3',
      title: 'Pack Grand Bazin Riche Fête',
      subtitle: 'Tenue traditionnelle 3 pièces broderie fil doré Getzner',
      priceXof: 75000,
      image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&auto=format&fit=crop&q=80',
      badge: 'Fêtes & Cérémonies',
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full space-y-10">
        
        {/* Diaspora Hero Banner */}
        <div className="relative bg-gradient-to-br from-slate-950 via-indigo-950 to-emerald-950 text-white rounded-3xl p-6 sm:p-10 shadow-2xl overflow-hidden space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-black border border-indigo-500/30">
                <Globe2 className="w-4 h-4 text-indigo-400" />
                <span>Espace Diaspora Malienne (France, USA, Europe & Afrique)</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                Offrez et Équipez votre Famille à Bamako depuis l&apos;Étranger 🌍🇲🇱
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Payez en <strong>Euros (€), Dollars ($)</strong> par Carte Bancaire (Visa / Mastercard) ou Apple Pay. 
                Suguba livre directement vos proches à Bamako sous 24h et vous envoie la <strong>photo de remise du colis sur WhatsApp</strong> !
              </p>
            </div>

            {/* Currency Switcher */}
            <div className="bg-white/10 backdrop-blur-xs p-4 rounded-3xl border border-white/20 space-y-3 shrink-0 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
                Devise d&apos;affichage :
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['EUR', 'USD', 'XOF'] as const).map((curr) => (
                  <button
                    key={curr}
                    onClick={() => setCurrency(curr)}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
                      currency === curr
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {curr === 'EUR' ? '€ EUR' : curr === 'USD' ? '$ USD' : 'FCFA'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">Taux officiel BCEAO garanti</p>
            </div>

          </div>

          {/* 4 Diaspora Guarantees */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-white/10 text-xs">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Paiement Sécurisé CB (Visa/Mastercard)</span>
            </div>
            <div className="flex items-center space-x-2">
              <Truck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Livraison 24h à Bamako & Régions</span>
            </div>
            <div className="flex items-center space-x-2">
              <Camera className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Photo de Remise envoyée sur WhatsApp</span>
            </div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Garantie Totale 12 Mois & SAV Suguba</span>
            </div>
          </div>
        </div>

        {/* Selected Packs for Diaspora */}
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h2 className="font-black text-lg text-slate-900 flex items-center space-x-2">
              <HeartHandshake className="w-5 h-5 text-rose-600" />
              <span>Packs Préférés de la Diaspora pour la Famille</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {diasporaPacks.map((pack) => (
              <div
                key={pack.id}
                className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-48 w-full bg-slate-100">
                    <Image src={pack.image} alt={pack.title} fill className="object-cover" />
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold rounded-lg">
                        {pack.badge}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <h3 className="font-black text-sm text-slate-900 leading-snug">{pack.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{pack.subtitle}</p>

                    <div className="pt-2">
                      <span className="text-xl font-black text-emerald-600 font-mono">
                        {formatPrice(pack.priceXof)}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        ({pack.priceXof.toLocaleString('fr-FR')} FCFA)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <button
                    onClick={() => {
                      const match = state.products.find(p => p.publicPrice === pack.priceXof) || state.products[0];
                      setSelectedProduct(match);
                      document.getElementById('diaspora-order-form')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full py-3 bg-slate-900 hover:bg-emerald-600 text-white font-black rounded-2xl text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-xs"
                  >
                    <span>Choisir ce Pack pour ma Famille</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The 1-Click Diaspora Order Form */}
        <div id="diaspora-order-form" className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xl space-y-6">
          
          <div className="border-b border-slate-100 pb-4">
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-[10px] font-black rounded-full uppercase tracking-wider">
              Commande Sécurisée Internationale
            </span>
            <h2 className="text-xl font-black text-slate-900 pt-2">
              Commander et Faire Livrer à Bamako
            </h2>
            <p className="text-xs text-slate-500">
              Remplissez les coordonnées de votre parent à Bamako. Le paiement se fait par Carte Bancaire en toute sécurité.
            </p>
          </div>

          {orderComplete ? (
            <div className="p-8 bg-emerald-50 border border-emerald-200 rounded-3xl text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-emerald-950">Paiement Validé & Commande Confirmée !</h3>
                <p className="text-xs text-emerald-800 max-w-md mx-auto">
                  Votre commande a été transmise à notre équipe logistique à Bamako. Votre parent <strong>{beneficiaryName}</strong> ({beneficiaryPhone}) sera livré sous 24h.
                </p>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-emerald-200 text-xs text-slate-700 max-w-sm mx-auto">
                📸 La photo de remise du colis vous sera envoyée sur WhatsApp dès la livraison effectuée !
              </div>
            </div>
          ) : !selectedProduct ? (
            /* Catalogue vide : depuis le retrait des produits de démo
               (mock-data.ts), state.products peut légitimement être vide tant
               qu'aucun fournisseur n'a référencé d'article. Sans ce garde-fou,
               selectedProduct est undefined et la page plante au build. */
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-black text-slate-900">Catalogue en cours de constitution</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Aucun article n&apos;est disponible à la commande pour le moment. Revenez très
                bientôt — nos fournisseurs partenaires référencent leurs produits.
              </p>
            </div>
          ) : (
            <form onSubmit={handleDiasporaCheckout} className="space-y-6">

              {/* Product recap */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-200 shrink-0">
                    <Image src={selectedProduct.images[0]} alt={selectedProduct.name} fill className="object-cover" />
                  </div>
                  <div>
                    <strong className="block text-xs text-slate-900">{selectedProduct.name}</strong>
                    <span className="text-[11px] text-slate-500">Livraison Express Bamako Offerte</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-black text-emerald-700 font-mono">
                    {formatPrice(selectedProduct.publicPrice)}
                  </span>
                  <span className="text-[10px] text-slate-400 block">TTC</span>
                </div>
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Votre Pays de Résidence :</label>
                  <select
                    value={buyerCountry}
                    onChange={(e) => setBuyerCountry(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="France (Europe)">🇫🇷 France (Europe)</option>
                    <option value="États-Unis / Canada">🇺🇸 / 🇨🇦 États-Unis / Canada</option>
                    <option value="Côte d'Ivoire">🇨🇮 Côte d&apos;Ivoire</option>
                    <option value="Sénégal">🇸🇳 Sénégal</option>
                    <option value="Autre pays">🌍 Autre pays</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Votre Email (pour le reçu de paiement) :</label>
                  <input
                    type="email"
                    required
                    placeholder="votre.email@gmail.com"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nom du Bénéficiaire à Bamako :</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Maman Aïssata Diarra"
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Numéro Téléphone du Bénéficiaire (Mali) :</label>
                  <input
                    type="tel"
                    required
                    placeholder="+223 76 00 00 00"
                    value={beneficiaryPhone}
                    onChange={(e) => setBeneficiaryPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-slate-700">Quartier & Repère de Livraison à Bamako :</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Kalaban-Coro, non loin du Marché / Station Shell"
                    value={beneficiaryNeighborhood}
                    onChange={(e) => setBeneficiaryNeighborhood(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

              </div>

              {/* Payment Button (Stripe / Visa / Mastercard Simulation) */}
              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-sm flex items-center justify-center space-x-2 shadow-xl shadow-emerald-600/30 transition-transform active:scale-98"
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {isProcessing
                      ? 'Redirection vers le paiement sécurisé...'
                      : `Régler ${formatPrice(selectedProduct.publicPrice)} par Carte Bancaire / Visa / Mastercard`}
                  </span>
                </button>

                {erreurPaiement && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 text-center">
                    {erreurPaiement}
                  </div>
                )}

                <p className="text-[11px] text-slate-400 text-center">
                  🔒 Transaction 3D-Secure 256-bit cryptée • Aucune donnée bancaire n&apos;est conservée
                </p>
              </div>

            </form>
          )}

        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
