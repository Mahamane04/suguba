'use client';

import React, { useState } from 'react';
import { Order, SavResolutionType } from '@/types';
import { X, ShieldAlert, CheckCircle2, ArrowRight, RefreshCw } from 'lucide-react';

interface CreateSavTicketModalProps {
  orders: Order[];
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export default function CreateSavTicketModal({ orders, isOpen, onClose, onCreated }: CreateSavTicketModalProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [resolutionType, setResolutionType] = useState<SavResolutionType>('swap_new');
  const [issueDescription, setIssueDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erreur, setErreur] = useState('');

  if (!isOpen) return null;

  const selectedOrder = orders.find(o => o.id === selectedOrderId) || orders[0];

  // Le ticket part vers /api/admin/sav : il n'est plus enfermé dans le
  // navigateur de l'admin qui l'ouvre. Seuls la commande, le motif et le type
  // de résolution sont transmis — le serveur relit lui-même les informations
  // client et produit sur la commande, et génère le numéro de ticket.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setIsSubmitting(true);
    setErreur('');

    try {
      const res = await fetch('/api/admin/sav', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          issueDescription: `${issueDescription}${notes ? ` — ${notes}` : ''}`,
          resolutionType,
        }),
      });
      const json = await res.json();
      setIsSubmitting(false);

      if (!res.ok || !json.success) {
        setErreur(json.error || "Le ticket n'a pas pu être enregistré.");
        return;
      }
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      setIsSubmitting(false);
      setErreur('Erreur réseau, réessayez.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-rose-300" />
            <h3 className="font-bold text-base sm:text-lg">Ouvrir un Dossier SAV & Garantie</h3>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {/* Order Selection */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Sélectionner la Commande Concernée :
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900"
            >
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  #{o.orderNumber} — {o.customerName} ({o.productName})
                </option>
              ))}
            </select>
          </div>

          {selectedOrder && (
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1 text-slate-600">
              <p>Client : <strong className="text-slate-900">{selectedOrder.customerName}</strong> ({selectedOrder.customerPhone})</p>
              <p>Produit : <strong className="text-slate-900">{selectedOrder.productName}</strong></p>
              <p>Quartier : {selectedOrder.neighborhood} (Repère : {selectedOrder.landmark})</p>
            </div>
          )}

          {/* Resolution Type */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Type de Résolution Garantie :
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setResolutionType('swap_new')}
                className={`py-2 px-2 rounded-xl font-bold border text-center transition-colors ${
                  resolutionType === 'swap_new' 
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs' 
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                🔄 Échange Neuf 72h
              </button>
              <button
                type="button"
                onClick={() => setResolutionType('repair')}
                className={`py-2 px-2 rounded-xl font-bold border text-center transition-colors ${
                  resolutionType === 'repair' 
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs' 
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                🛠️ Réparation Atelier
              </button>
              <button
                type="button"
                onClick={() => setResolutionType('refund')}
                className={`py-2 px-2 rounded-xl font-bold border text-center transition-colors ${
                  resolutionType === 'refund' 
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs' 
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                💰 Remboursement
              </button>
            </div>
          </div>

          {/* Issue description */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Description de la Panne / Motif du Retour :
            </label>
            <textarea
              required
              rows={3}
              placeholder="Ex: Le moteur s'arrête après 2 minutes, bruit inhabituel ou pièce cassée à l'ouverture..."
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Internal notes */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Instructions Internes pour le Coursier / Fournisseur (Optionnel) :
            </label>
            <input
              type="text"
              placeholder="Ex: Récupérer le carton d'origine et vérifier les accessoires..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
            />
          </div>

          {erreur && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
              {erreur}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-rose-600/20 active:scale-98 transition-all"
          >
            <span>{isSubmitting ? 'Création en cours...' : 'Ouvrir le Ticket SAV & Déclencher la Procédure'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

        </form>

      </div>
    </div>
  );
}
