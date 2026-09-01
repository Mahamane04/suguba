'use client';

import React, { useState } from 'react';
import { Order } from '@/types';
import { X, KeyRound, CheckCircle2, AlertTriangle, ShieldCheck, Banknote } from 'lucide-react';

interface OtpValidationModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * ⚠️ La validation se fait désormais entièrement côté serveur (voir
 * /api/driver/verify-delivery-otp) — ce composant n'a plus jamais accès au
 * code secret lui-même (`order.deliveryOtp` n'est plus renvoyé par
 * /api/orders/feed pour un livreur, précisément pour empêcher ce genre de
 * fuite). L'ancienne version affichait même le code en clair dans un
 * encart "démo" — corrigé le 2026-08-26.
 */
export default function OtpValidationModal({ order, isOpen, onClose, onSuccess }: OtpValidationModalProps) {
  const [otpInput, setOtpInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);

  if (!isOpen || !order) return null;

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/driver/verify-delivery-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, code: otpInput.trim() }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setIsSuccess(true);
        if (onSuccess) onSuccess();
        return;
      }

      if (res.status === 423) {
        setLocked(true);
      } else {
        setAttempts((a) => a + 1);
      }
      setErrorMsg(json.error || 'Code invalide.');
    } catch (err) {
      setErrorMsg('Erreur réseau, réessayez.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setOtpInput('');
    setErrorMsg('');
    setIsSuccess(false);
    setAttempts(0);
    setLocked(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">

        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-600 to-orange-600 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <KeyRound className="w-5 h-5 text-amber-200" />
            <h3 className="font-bold text-base sm:text-lg">Preuve de Livraison Sécurisée</h3>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4">

          {isSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md shadow-emerald-600/10">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-900">
                  Livraison Validée !
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Le paiement de <strong>{order.totalAmount.toLocaleString('fr-FR')} FCFA</strong> est enregistré comme encaissé.
                </p>
                <div className="mt-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-800 font-medium">
                  ✅ Statut commande : <strong>LIVRÉ</strong><br />
                  ✅ Commission revendeur ({order.resellerCommission.toLocaleString('fr-FR')} F) : <strong>VERROUILLÉE EN SÉCURITÉ</strong>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3 px-4 rounded-xl text-xs"
              >
                Terminer
              </button>
            </div>
          ) : (
            <form onSubmit={handleValidate} className="space-y-4">

              {/* Cash Collection Alert */}
              <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-4 flex items-start space-x-3">
                <Banknote className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    Montant total à encaisser au client :
                  </p>
                  <p className="text-xl font-black text-slate-900 mt-0.5">
                    {order.totalAmount.toLocaleString('fr-FR')} FCFA
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    Client : {order.customerName} ({order.customerPhone})
                  </p>
                </div>
              </div>

              {/* OTP Input Instruction */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Demandez au client son Code Secret *
                  </label>
                  {attempts > 0 && (
                    <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      Tentative {attempts} / 3
                    </span>
                  )}
                </div>

                <div className="relative">
                  <KeyRound className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    disabled={locked}
                    placeholder="Ex: 5832"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-300 focus:border-amber-500 rounded-2xl text-center text-2xl tracking-[0.5em] font-black text-slate-900 focus:bg-white focus:outline-hidden disabled:bg-slate-200 disabled:opacity-60"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 text-center">
                  Le client a reçu ce code par SMS/WhatsApp lors de la commande.
                </p>
              </div>

              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-bold flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {locked ? (
                <div className="space-y-2">
                  <div className="p-3 bg-rose-100 border border-rose-300 text-rose-950 rounded-2xl text-xs font-bold text-center">
                    ⛔ COMMANDE BLOQUÉE : 3 tentatives erronées.
                  </div>
                  <a
                    href="tel:+22389460000"
                    className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-2"
                  >
                    <span>Appeler le Support Suguba (+223 89 46 00 00)</span>
                  </a>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={otpInput.length < 4 || isSubmitting}
                  className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-2xl text-xs shadow-lg shadow-amber-600/20 flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSubmitting ? 'Vérification...' : 'Valider le Code & Encaisser'}</span>
                </button>
              )}

            </form>
          )}

        </div>

      </div>
    </div>
  );
}
