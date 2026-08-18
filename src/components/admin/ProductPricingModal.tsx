'use client';

import React, { useState } from 'react';
import { Product } from '@/types';
import { sugubaStore, useSugubaStore } from '@/lib/store';
import { X, ShieldCheck, DollarSign, ArrowRight, Percent, AlertCircle } from 'lucide-react';
import Image from 'next/image';

interface ProductPricingModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProductPricingModal({ product, isOpen, onClose }: ProductPricingModalProps) {
  const state = useSugubaStore();
  const [publicPrice, setPublicPrice] = useState<number>(product?.publicPrice || 0);
  const [resellerCommission, setResellerCommission] = useState<number>(product?.resellerCommission || 0);
  const [sugubaMargin, setSugubaMargin] = useState<number>(product?.sugubaMargin || 0);

  // Synchronisation si le produit change
  React.useEffect(() => {
    if (product) {
      const pPrice = product.publicPrice || Math.round(product.supplierPrice * 1.3);
      const rCommission = product.resellerCommission || Math.round(product.supplierPrice * 0.1);
      const sMargin = Math.max(0, pPrice - product.supplierPrice - rCommission);
      
      setPublicPrice(pPrice);
      setResellerCommission(rCommission);
      setSugubaMargin(sMargin);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const supplierPrice = product.supplierPrice;
  const calculatedSugubaMargin = publicPrice - supplierPrice - resellerCommission;

  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault();
    if (publicPrice <= supplierPrice) {
      alert('Le prix public doit être supérieur au prix fournisseur.');
      return;
    }
    if (calculatedSugubaMargin < 0) {
      alert('Attention : La marge nette Suguba ne peut pas être négative.');
      return;
    }

    sugubaStore.approveProduct(
      product.id,
      publicPrice,
      resellerCommission,
      calculatedSugubaMargin,
      state.currentUser.fullName
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-800 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-purple-300" />
            <h3 className="font-bold text-base sm:text-lg">Contrôle Économique Suguba</h3>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleApprove} className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Product Summary */}
          <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-200 shrink-0">
              <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Fournisseur : {product.supplierName}
              </p>
              <h4 className="font-bold text-xs text-slate-900 truncate">{product.name}</h4>
              <p className="text-xs font-black text-blue-700 mt-0.5">
                Prix Fournisseur garanti : {supplierPrice.toLocaleString('fr-FR')} FCFA
              </p>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 text-xs text-purple-900 leading-relaxed">
            💡 <strong>Règle d&apos;or Suguba</strong> : Le fournisseur exige son prix plancher ({supplierPrice.toLocaleString('fr-FR')} F). Suguba fixe librement le prix de vente final, la commission fixe revendeur et préserve sa marge opérationnelle.
          </div>

          {/* Pricing Controls */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Prix de Vente Public Client (FCFA) *
              </label>
              <input
                type="number"
                required
                min={supplierPrice + 1000}
                step={500}
                value={publicPrice}
                onChange={(e) => setPublicPrice(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:outline-purple-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Commission Fixe par Vente Revendeur (FCFA) *
              </label>
              <input
                type="number"
                required
                min={1000}
                step={500}
                value={resellerCommission}
                onChange={(e) => setResellerCommission(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-emerald-700 focus:bg-white focus:outline-emerald-600"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Affiché directement au revendeur : &quot;Gagne {resellerCommission.toLocaleString('fr-FR')} F par vente&quot;
              </p>
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Décomposition Financière Unitaire :
            </p>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Prix de Vente Public :</span>
              <span className="font-bold text-white">{publicPrice.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-xs text-blue-300">
              <span>− Reversement Fournisseur :</span>
              <span className="font-bold">− {supplierPrice.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-xs text-emerald-400">
              <span>− Commission Revendeur :</span>
              <span className="font-bold">− {resellerCommission.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-sm font-black text-purple-300 pt-2 border-t border-slate-800">
              <span>= Marge Brute Suguba :</span>
              <span className="text-base">{calculatedSugubaMargin.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>

          {calculatedSugubaMargin < 0 && (
            <div className="flex items-center space-x-2 text-rose-600 text-xs font-bold">
              <AlertCircle className="w-4 h-4" />
              <span>Attention : La marge Suguba est négative avec ces paramètres !</span>
            </div>
          )}

          {/* Action */}
          <button
            type="submit"
            disabled={calculatedSugubaMargin < 0}
            className="w-full bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-2xl text-xs shadow-lg shadow-purple-900/20 flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Approuver & Publier dans le Catalogue Revendeurs</span>
          </button>

        </form>

      </div>
    </div>
  );
}
