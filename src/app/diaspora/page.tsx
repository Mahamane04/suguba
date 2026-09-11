'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ProductImage from '@/components/common/ProductImage';
import Header from '@/components/common/Header';
import type { Product } from '@/types';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore } from '@/lib/store';
import OrderRecovery from '@/components/common/OrderRecovery';
import { useOrderQuote } from '@/lib/useOrderQuote';
import type { OrderInput } from '@/lib/order-input';
import { useOrderCheckout } from '@/lib/useOrderCheckout';
import { 
  Globe2, CreditCard, HeartHandshake, ShieldCheck, 
  Truck, ArrowRight, CheckCircle2, Phone, MapPin, Sparkles, Star, Camera, Lock
} from 'lucide-react';

export default function DiasporaPortalPage() {
  const state = useSugubaStore();

  const [currency, setCurrency] = useState<'EUR' | 'USD' | 'XOF'>('EUR');
  // Seuls les produits réellement en vente : state.products[0] pouvait être
  // un produit retiré ou sans prix, payé par carte depuis l'étranger.
  const enVente = state.products.filter((p) => p.status === 'approved' && p.publicPrice > 0);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryPhone, setBeneficiaryPhone] = useState('');
  const [beneficiaryNeighborhood, setBeneficiaryNeighborhood] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerCountry, setBuyerCountry] = useState('France (Europe)');
  const paymentInFlight = useRef(false);
  const { submitOrder, recovery } = useOrderCheckout('diaspora');
  const [isProcessing, setIsProcessing] = useState(false);
  const { devis, error: erreurDevis } = useOrderQuote(selectedProduct ? {
    productId: selectedProduct.id, quantity: 1, city: 'Bamako',
  } : null);
  const [orderComplete, setOrderComplete] = useState(false);
  const [erreurPaiement, setErreurPaiement] = useState('');

  // Les produits arrivent de Supabase APRÈS le montage : selectedProduct,
  // initialisé à products[0] alors que la liste était encore vide, restait
  // indéfiniment undefined et la page annonçait un catalogue vide même quand
  // des articles existaient. On le renseigne dès que la liste se remplit.
  const idsEnVente = enVente.map((p) => p.id).join(',');
  useEffect(() => {
    const liste = state.products.filter((p) => p.status === 'approved' && p.publicPrice > 0);
    if (liste.length > 0 && (!selectedProduct || !liste.some((p) => p.id === selectedProduct.id))) {
      setSelectedProduct(liste[0]);
    }
  }, [idsEnVente, selectedProduct, state.products]);

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
   * Encaissement réel par carte bancaire via SasPay.
   *
   * L'ancienne version ne faisait qu'un `setTimeout` avant d'afficher l'écran
   * de succès : la commande était créée mais aucun paiement n'était jamais
   * demandé, et l'acheteur repartait convaincu d'avoir payé. On crée
   * désormais la commande, on s'assure qu'elle existe en base, puis on
   * redirige vers la page de paiement SasPay. L'écran de succès n'est plus
   * atteint ici : c'est le retour SasPay (return_url) qui y mène, une fois le
   * paiement réellement encaissé et vérifié côté serveur.
   *
   * Réseau `card` et non un mobile money malien : l'acheteur est à
   * l'étranger et n'a pas de numéro Orange/Moov/Mobi Cash. `card` est un
   * réseau global SasPay, facturé en USD — la conversion depuis le XOF de la
   * commande se fait chez eux, au taux configuré sur le compte. Il n'a que la
   * page hébergée, jamais de push : la redirection EST le paiement.
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

    if (!devis) return;
    await finishOrder({
        productId: selectedProduct.id,
        quantity: 1,
        customerName: beneficiaryName.trim(),
        customerPhone: beneficiaryPhone.trim(),
        city: 'Bamako',
        neighborhood: beneficiaryNeighborhood.trim(),
        landmark: `Commande Diaspora [${buyerCountry}] - Bénéficiaire : ${beneficiaryName}`,
        deliveryNotes: `Paiement en ligne Diaspora (${currency}). Email acheteur : ${buyerEmail || 'Non spécifié'}`,
      });
  };

  const finishOrder = async (data?: OrderInput) => {
    if (paymentInFlight.current) return;
    paymentInFlight.current = true;
    setIsProcessing(true);
    setErreurPaiement('');
    try {
      const commande = await submitOrder(data);
      const res = await fetch('/api/payments/saspay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Seul le numéro de commande est transmis : le montant est relu en
        // base côté serveur, jamais accepté depuis le navigateur.
        body: JSON.stringify({
          orderNumber: commande.orderNumber,
          network: 'card',
          phone: commande.customerPhone,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success || !json.urlCheckout) {
        setIsProcessing(false);
        setErreurPaiement(json.error || 'Impossible de démarrer le paiement. Réessayez.');
        return;
      }

      window.location.href = json.urlCheckout;
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      setErreurPaiement(err instanceof Error ? err.message : 'Erreur réseau lors du démarrage du paiement.');
    } finally {
      paymentInFlight.current = false;
    }
  };


  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full space-y-10">
        
        {/* Diaspora Hero Banner */}
        <div className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-10 shadow-2xl overflow-hidden space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 text-emerald-200 text-xs font-black border border-white/15">
                <Globe2 className="w-4 h-4 text-emerald-300" />
                <span>Espace Diaspora Malienne (France, USA, Europe & Afrique)</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                Offrez et Équipez votre Famille à Bamako depuis l&apos;Étranger 🌍🇲🇱
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Payez en <strong>Euros (€), Dollars ($)</strong> par carte bancaire (Visa, Mastercard). 
                Suguba livre vos proches à Bamako et en régions, et vous suivez la commande en ligne avec son numéro.
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
              {/* Seule la parité euro est fixe (655,957 F) ; le dollar varie. */}
              <p className="text-[11px] text-slate-400">Prix indicatifs convertis du franc CFA (1 € = 655,957 F)</p>
            </div>

          </div>

          {/* 4 Diaspora Guarantees */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-white/10 text-xs">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Paiement Sécurisé CB (Visa/Mastercard)</span>
            </div>
            <div className="flex items-center space-x-2">
              <Truck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Livraison à Bamako et en régions</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Suivi de la commande en ligne</span>
            </div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Service client Suguba sur WhatsApp</span>
            </div>
          </div>
        </div>

        {/* Vrais produits en vente. Remplacent trois « packs » inventés (photos
            Unsplash, prix fictifs) dont le bouton sélectionnait en réalité un
            produit quelconque du catalogue : l'acheteur payait par carte un
            article différent de celui qu'il avait choisi. */}
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h2 className="font-black text-lg text-slate-900 flex items-center space-x-2">
              <HeartHandshake className="w-5 h-5 text-suguba-brand" />
              <span>Choisissez l&apos;article pour votre famille</span>
            </h2>
          </div>

          {enVente.length === 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse" aria-busy="true" aria-label="Chargement des produits">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[3/4] bg-white border border-slate-200 rounded-3xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {enVente.slice(0, 12).map((p) => {
                const choisi = selectedProduct?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProduct(p);
                      document.getElementById('diaspora-order-form')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    aria-pressed={choisi}
                    className={`text-left bg-white rounded-3xl overflow-hidden border-2 transition-all ${
                      choisi ? 'border-suguba-brand shadow-md' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="relative aspect-square bg-slate-100">
                      <ProductImage src={p.images[0] || ''} alt={p.name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" compact />
                      {choisi && (
                        <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-suguba-brand text-white flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                    <div className="p-3 space-y-0.5">
                      <p className="font-bold text-sm text-slate-900 line-clamp-2 leading-snug">{p.name}</p>
                      <p className="text-base font-black text-slate-900">{formatPrice(p.publicPrice)}</p>
                      {currency !== 'XOF' && (
                        <p className="text-[11px] text-slate-500">{p.publicPrice.toLocaleString('fr-FR')} FCFA</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* The 1-Click Diaspora Order Form */}
        <div id="diaspora-order-form" className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xl space-y-6">
          <OrderRecovery attempt={recovery} disabled={isProcessing} onResume={() => { void finishOrder(); }} />
          
          <div className="border-b border-slate-100 pb-4">
            <span className="px-3 py-1 bg-slate-100 text-slate-700 text-[11px] font-black rounded-full uppercase tracking-wider">
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
                  Votre commande a été transmise à notre équipe logistique à Bamako. Suguba contactera <strong>{beneficiaryName}</strong> ({beneficiaryPhone}) pour organiser la livraison.
                </p>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-emerald-200 text-xs text-slate-700 max-w-sm mx-auto">
                Suivez l&apos;avancement à tout moment depuis la page « Suivi », avec le numéro de commande.
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
                    <ProductImage src={selectedProduct.images[0] || ''} alt={selectedProduct.name} fill sizes="48px" className="object-cover" compact />
                  </div>
                  <div>
                    <strong className="block text-xs text-slate-900">{selectedProduct.name}</strong>
                    <span className="text-[11px] text-slate-500">Livraison à Bamako : {devis ? formatPrice(devis.fraisLivraison) : 'calcul…'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-black text-emerald-700 font-mono">
                    {formatPrice(selectedProduct.publicPrice)}
                  </span>
                  <span className="text-[11px] text-slate-400 block">TTC</span>
                </div>
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Votre Pays de Résidence :</label>
                  <select
                    value={buyerCountry}
                    onChange={(e) => setBuyerCountry(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-base sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-base sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-base sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-base sm:text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-base sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

              </div>

              {erreurDevis && <p role="alert" className="text-sm text-red-700">{erreurDevis}</p>}
              {/* Paiement du total calculé par le serveur. */}
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
                      : devis ? `Régler ${formatPrice(devis.total)} par Carte Bancaire / Visa / Mastercard` : 'Calcul du total…'}
                  </span>
                </button>

                {erreurPaiement && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 text-center">
                    {erreurPaiement}
                  </div>
                )}

                <p className="text-[11px] text-slate-400 text-center">
                  🔒 Paiement par carte sur la page sécurisée SasPay : Suguba ne voit ni ne conserve vos données bancaires.
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
