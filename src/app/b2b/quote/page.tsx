'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore } from '@/lib/store';
import { 
  FileText, Building2, Printer, MessageCircle, 
  ArrowLeft, CheckCircle2, ShieldCheck, Download, Sparkles, Phone, Mail
} from 'lucide-react';

export default function B2BQuotePage() {
  const state = useSugubaStore();
  const products = state.products;

  // Form states
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [nifNumber, setNifNumber] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(10);
  const [deliveryCity, setDeliveryCity] = useState('Bamako');
  const [paymentTerms, setPaymentTerms] = useState('Virement Bancaire (50% commande / 50% livraison)');
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);

  const selectedProduct = products.find(p => p.id === selectedProductId) || products[0];

  // Tiered discount based on quantity
  const getDiscountPercent = (qty: number) => {
    if (qty >= 50) return 15;
    if (qty >= 20) return 10;
    if (qty >= 10) return 5;
    return 0;
  };

  const discountPercent = getDiscountPercent(quantity);
  const unitPrice = selectedProduct?.publicPrice || 35000;
  const rawSubtotal = unitPrice * quantity;
  const discountAmount = Math.round((rawSubtotal * discountPercent) / 100);
  const subtotalAfterDiscount = rawSubtotal - discountAmount;
  const deliveryFee = quantity >= 20 ? 0 : 5000; // Livraison offerte dès 20 unités
  const totalAmount = subtotalAfterDiscount + deliveryFee;

  const quoteNumber = `DEV-BKO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsapp = () => {
    const message = `📋 *DEMANDE DE FACTURE PROFORMA B2B SUGUBA MALI*\n\n` +
      `🏢 *Société :* ${companyName || 'Non spécifié'}\n` +
      `👤 *Contact :* ${contactName} (${contactPhone})\n` +
      `📦 *Produit :* ${selectedProduct?.name} (x${quantity} unités)\n` +
      `💰 *Total HT :* ${totalAmount.toLocaleString('fr-FR')} FCFA (${discountPercent}% de remise volume)\n` +
      `📍 *Livraison :* ${deliveryCity}\n\n` +
      `Merci de nous transmettre le bon pour accord pour préparation de la commande.`;

    window.open(`https://api.whatsapp.com/send?phone=22389460000&text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <div className="print:hidden">
        <Header />
      </div>

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Navigation & Title */}
        <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link 
              href="/" 
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à l&apos;accueil</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Devis & Factures Proforma B2B (Commandes Groupées)
            </h1>
            <p className="text-xs text-slate-500">
              Générez instantanément un devis officiel Suguba pour entreprises, ONG, associations et comités d&apos;entreprise.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowInvoicePreview(!showInvoicePreview)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl text-xs transition-all active:scale-95 flex items-center space-x-2 shadow-xs"
            >
              <FileText className="w-4 h-4" />
              <span>{showInvoicePreview ? 'Modifier les données' : 'Aperçu du Devis'}</span>
            </button>
          </div>
        </div>

        {/* Input Form */}
        {!showInvoicePreview ? (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
            
            <div className="border-b border-slate-100 pb-4">
              <h2 className="font-black text-sm text-slate-900 flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>1. Informations de l&apos;Entreprise / Acheteur B2B</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Raison Sociale / Nom Entreprise *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Société Minière du Mali, BDM-SA, ONG Alafia..."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Numéro NIF / RCCM (Optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex: NIF 086419208K / RCCM MA.BKO.2024.B.120"
                  value={nifNumber}
                  onChange={(e) => setNifNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nom du Responsable Achats *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: M. Ousmane Diakité (DRH / Achats)"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Téléphone Appel / WhatsApp *</label>
                <input
                  type="tel"
                  required
                  placeholder="Ex: +223 76 00 00 00"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            <div className="border-b border-slate-100 pb-4 pt-2">
              <h2 className="font-black text-sm text-slate-900 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>2. Choix du Produit & Quantité Groupée</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Produit du Catalogue Suguba :</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.publicPrice.toLocaleString('fr-FR')} FCFA / unité)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Quantité Souhaitée : <strong className="text-emerald-700">({quantity} unités)</strong>
                </label>
                <div className="flex items-center space-x-2">
                  {[10, 20, 50, 100].map(qty => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setQuantity(qty)}
                      className={`flex-1 py-2 rounded-xl font-bold border transition-colors ${
                        quantity === qty 
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {qty} pcs {getDiscountPercent(qty) > 0 && `(-${getDiscountPercent(qty)}%)`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Financial Summary */}
            <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-300">
                <span>Prix unitaire catalogue :</span>
                <span className="font-bold">{unitPrice.toLocaleString('fr-FR')} FCFA</span>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-300">
                <span>Montant Brut ({quantity} unités) :</span>
                <span className="font-bold">{rawSubtotal.toLocaleString('fr-FR')} FCFA</span>
              </div>

              {discountPercent > 0 && (
                <div className="flex justify-between items-center text-xs text-emerald-400 font-bold">
                  <span>Remise Volume Entreprise (-{discountPercent}%) :</span>
                  <span>- {discountAmount.toLocaleString('fr-FR')} FCFA</span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs text-slate-300">
                <span>Livraison dédiée & Manutention :</span>
                <span className="font-bold">{deliveryFee === 0 ? 'OFFERTE (Dès 20 pcs)' : `${deliveryFee.toLocaleString('fr-FR')} FCFA`}</span>
              </div>

              <div className="pt-3 border-t border-white/20 flex justify-between items-center text-base font-black text-white">
                <span>Total Net Devis :</span>
                <span className="text-amber-400 text-xl font-black">{totalAmount.toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>

            <button
              onClick={() => setShowInvoicePreview(true)}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-transform active:scale-98"
            >
              <FileText className="w-4 h-4" />
              <span>Générer la Facture Proforma Officielle</span>
            </button>

          </div>
        ) : (
          /* Printable Proforma Invoice Preview */
          <div className="space-y-4">
            
            <div className="print:hidden flex flex-wrap items-center justify-between gap-2 bg-emerald-50 border border-emerald-300 p-4 rounded-2xl">
              <div className="flex items-center space-x-2 text-emerald-950 text-xs font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Devis Proforma prêt pour impression et signature.</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer / PDF</span>
                </button>
                <button
                  onClick={handleSendWhatsapp}
                  className="px-4 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-black flex items-center space-x-1.5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-current" />
                  <span>Envoyer sur WhatsApp</span>
                </button>
              </div>
            </div>

            {/* Official Document A4 Container */}
            <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-300 shadow-xl space-y-8 text-slate-900 font-sans print:border-none print:shadow-none print:p-0">
              
              {/* Header Document */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">SUGUBA MALI SAS</h1>
                  <p className="text-xs text-slate-600">Plateforme de Distribution & Social Commerce</p>
                  <p className="text-xs text-slate-600">Hamdallaye ACI 2000, Rue 314, Porte 88, Bamako, Mali</p>
                  <p className="text-xs text-slate-600">Tél : <strong>+223 89 46 00 00</strong> • Email : ops@sugubaml.com</p>
                  <p className="text-[11px] text-slate-500 font-mono mt-1">NIF : 086419208K • RCCM : MA.BKO.2026.B.14820</p>
                </div>

                <div className="text-right">
                  <span className="px-3 py-1 bg-slate-900 text-white font-mono font-black text-xs rounded-lg uppercase">
                    FACTURE PROFORMA
                  </span>
                  <p className="text-xs font-mono font-bold text-slate-900 mt-2">N° {quoteNumber}</p>
                  <p className="text-xs text-slate-500">Date : {dateStr}</p>
                  <p className="text-xs text-slate-500">Validité : 15 jours</p>
                </div>
              </div>

              {/* Client Info Card */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Destinataire / Acheteur B2B</span>
                  <p className="font-black text-sm text-slate-900">{companyName || 'Société Partenaire'}</p>
                  {nifNumber && <p className="font-mono text-slate-600">{nifNumber}</p>}
                  <p className="text-slate-700 mt-1">Attn : {contactName || 'Responsable Achats'}</p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Lieu & Modalités de Livraison</span>
                  <p className="font-bold text-slate-900">{deliveryCity} (Mali)</p>
                  <p className="text-slate-600">Contact : {contactPhone || '+223 -- -- -- --'}</p>
                  <p className="text-slate-600 font-medium mt-1">Conditions : {paymentTerms}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-slate-900 font-black">
                    <th className="py-2.5">Désignation de l&apos;Article</th>
                    <th className="py-2.5 text-center">Qté</th>
                    <th className="py-2.5 text-right">Prix Unitaire</th>
                    <th className="py-2.5 text-right">Remise</th>
                    <th className="py-2.5 text-right">Montant Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-3">
                      <strong className="block text-slate-900">{selectedProduct?.name}</strong>
                      <span className="text-[10px] text-slate-500">Garantie certifiée {selectedProduct?.warrantyMonths} mois • Neuf sous emballage d&apos;origine</span>
                    </td>
                    <td className="py-3 text-center font-bold">{quantity}</td>
                    <td className="py-3 text-right font-mono">{unitPrice.toLocaleString('fr-FR')} F</td>
                    <td className="py-3 text-right font-mono text-emerald-700">-{discountPercent}%</td>
                    <td className="py-3 text-right font-black font-mono">{subtotalAfterDiscount.toLocaleString('fr-FR')} F</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 text-slate-600">Livraison & Manutention sur site ({deliveryCity})</td>
                    <td className="py-2.5 text-center">1</td>
                    <td className="py-2.5 text-right font-mono">{deliveryFee.toLocaleString('fr-FR')} F</td>
                    <td className="py-2.5 text-right">-</td>
                    <td className="py-2.5 text-right font-bold font-mono">{deliveryFee.toLocaleString('fr-FR')} F</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-900">
                    <td colSpan={4} className="py-3 text-right font-black text-sm">TOTAL NET À PAYER :</td>
                    <td className="py-3 text-right font-black text-base text-emerald-700 font-mono">
                      {totalAmount.toLocaleString('fr-FR')} FCFA
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Signatures & Bank Details */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-xs">
                <div className="space-y-1">
                  <p className="font-bold text-slate-900">Coordonnées Bancaires de Règlement :</p>
                  <p className="text-slate-600">Banque : <strong>BDM-SA / UBA Mali</strong></p>
                  <p className="text-slate-600">Titulaire : <strong>SUGUBA MALI SAS</strong></p>
                  <p className="text-slate-600 font-mono">RIB : ML016 01201 02548963210 44</p>
                  <p className="text-slate-600">Mobile Money Marchand : <strong>+223 89 46 00 00</strong> (Wave / Orange)</p>
                </div>

                <div className="text-center flex flex-col justify-between h-28 border border-dashed border-slate-300 p-3 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold">Cachet & Signature de la Direction</span>
                  <div className="font-serif italic text-emerald-800 text-sm font-bold">
                    Pour Accord — Direction Générale Suguba
                  </div>
                  <span className="text-[9px] text-slate-400">Document généré électroniquement • Fait foi</span>
                </div>
              </div>

            </div>

          </div>
        )}

      </main>

      <div className="print:hidden">
        <Footer />
        <BottomNav />
      </div>
    </div>
  );
}
