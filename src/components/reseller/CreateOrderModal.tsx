'use client';

import React, { useState } from 'react';
import { Product } from '@/types';
import { sugubaStore, useSugubaStore } from '@/lib/store';
import { X, CheckCircle, Package, Phone, MapPin, User, FileText, ArrowRight } from 'lucide-react';
import Image from 'next/image';

interface CreateOrderModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (orderNumber: string) => void;
}

export default function CreateOrderModal({ product, isOpen, onClose, onSuccess }: CreateOrderModalProps) {
  const state = useSugubaStore();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [city, setCity] = useState('Bamako');
  const [neighborhood, setNeighborhood] = useState('');
  const [landmark, setLandmark] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);

  if (!isOpen || !product) return null;

  const currentReseller = state.resellers.find(r => r.userId === state.currentUser.id);
  const unitPrice = product.publicPrice;
  const commissionPerUnit = product.resellerCommission;
  const totalAmount = (unitPrice * quantity) + 1500;
  const totalCommission = commissionPerUnit * quantity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !neighborhood || !landmark) {
      alert('Veuillez remplir tous les champs obligatoires (Nom, Téléphone, Quartier, Repère)');
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
        resellerCode: currentReseller?.referralCode,
      });

      // Déclenchement de l'envoi du SMS OTP
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

      setCreatedOrder(order);
      if (onSuccess) onSuccess(order.orderNumber);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la création de la commande');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setCreatedOrder(null);
    setCustomerName('');
    setCustomerPhone('');
    setNeighborhood('');
    setLandmark('');
    setDeliveryNotes('');
    setQuantity(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base sm:text-lg">
              {createdOrder ? 'Commande Enregistrée !' : 'Saisir une Commande Client'}
            </h3>
          </div>
          <button 
            onClick={handleReset}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {createdOrder ? (
            /* Success State */
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md shadow-emerald-600/10">
                <CheckCircle className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-900">
                  Commande {createdOrder.orderNumber} créée !
                </h4>
                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                  Suguba a bien reçu la commande. Notre équipe va appeler <strong>{createdOrder.customerName}</strong> pour confirmer avant de dispatch le livreur.
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Client :</span>
                  <span className="font-bold text-slate-900">{createdOrder.customerName} ({createdOrder.customerPhone})</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Quartier :</span>
                  <span className="font-bold text-slate-900">{createdOrder.neighborhood}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Montant à encaisser :</span>
                  <span className="font-bold text-slate-900">{createdOrder.totalAmount.toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between text-xs pt-2 border-t border-emerald-200">
                  <span className="text-emerald-800 font-bold">Ta commission attribuée :</span>
                  <span className="font-black text-emerald-700 text-sm">+{createdOrder.resellerCommission.toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors"
              >
                Fermer et retourner au catalogue
              </button>
            </div>
          ) : (
            /* Order Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Product preview */}
              <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-200 shrink-0">
                  <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-slate-900 truncate">{product.name}</p>
                  <p className="text-[11px] text-emerald-700 font-bold">
                    Gain revendeur : +{commissionPerUnit.toLocaleString('fr-FR')} FCFA / unité
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block">Qté</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 bg-white border border-slate-300 rounded-lg text-center font-bold text-xs py-1"
                  />
                </div>
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nom & Prénom du Client *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Ibrahim Keita"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-emerald-600"
                  />
                </div>
              </div>

              {/* Customer Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Numéro de Téléphone (WhatsApp / Appel) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    placeholder="Ex: 76 12 34 56"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-emerald-600"
                  />
                </div>
              </div>

              {/* City & Neighborhood */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ville *
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
                  >
                    <option value="Bamako">Bamako</option>
                    <option value="Kati">Kati</option>
                    <option value="Sikasso">Sikasso</option>
                    <option value="Ségou">Ségou</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quartier *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Hamdallaye ACI"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Landmark (Indispensable au Mali) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Repère Visuel & Localisation Précise *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: En face de la pharmacie du pont, portail bleu"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Instructions de livraison (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Préfère être livré après 16h"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>

              {/* Summary Calculation */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Produit ({quantity}x) :</span>
                  <span className="font-semibold">{(unitPrice * quantity).toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Frais de livraison estimés :</span>
                  <span className="font-semibold">1 500 FCFA</span>
                </div>
                <div className="flex justify-between text-xs font-black text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total à payer par le client :</span>
                  <span>{totalAmount.toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-emerald-700 pt-1">
                  <span>Ta commission sur cette vente :</span>
                  <span>+{totalCommission.toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-2xl text-xs shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]"
              >
                <span>Valider et enregistrer la commande</span>
                <ArrowRight className="w-4 h-4" />
              </button>

            </form>
          )}

        </div>

      </div>
    </div>
  );
}
