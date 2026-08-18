'use client';

import React, { useState } from 'react';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { 
  Wallet, ArrowDownCircle, CheckCircle2, Clock, 
  Smartphone, Shield, AlertCircle, ArrowRight, Check, History
} from 'lucide-react';

export default function ResellerPayoutsPage() {
  const state = useSugubaStore();
  const [amount, setAmount] = useState<number>(10000);
  const [provider, setProvider] = useState<'Orange Money' | 'Wave' | 'Moov Money'>('Orange Money');
  const [phone, setPhone] = useState(state.currentUser.phone);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const reseller = state.resellers.find(r => r.userId === state.currentUser.id) || state.resellers[0];
  const myWithdrawals = state.withdrawals.filter(w => w.resellerId === reseller?.id);
  const myCommissions = state.commissions.filter(c => c.resellerId === reseller?.id);

  const handleWithdrawalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSuccess(false);

    try {
      sugubaStore.requestWithdrawal({
        resellerId: reseller.id,
        amount: Number(amount),
        payoutProvider: provider,
        payoutPhone: phone,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la demande de retrait');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Page Title */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Mes Commissions & Retraits
          </h1>
          <p className="text-xs text-slate-500">
            Gérez vos créances commerciales et recevez vos paiements directement par Mobile Money (Orange Money, Wave, Moov).
          </p>
        </div>

        {/* Balances Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          <div className="bg-gradient-to-br from-emerald-700 to-green-800 text-white p-5 rounded-3xl shadow-md space-y-1">
            <span className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
              Solde Retirable Immédiatement
            </span>
            <p className="text-2xl sm:text-3xl font-black">
              {reseller.availableBalance.toLocaleString('fr-FR')} <span className="text-sm font-normal">FCFA</span>
            </p>
            <p className="text-[11px] text-emerald-100">Prêt pour virement Mobile Money</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1" />
              Sécurisé en Attente (J+7)
            </span>
            <p className="text-2xl sm:text-3xl font-black text-amber-600">
              {reseller.pendingBalance.toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-500">FCFA</span>
            </p>
            <p className="text-[11px] text-slate-500">Période de garantie anti-retour</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Déjà Retiré & Reçu
            </span>
            <p className="text-2xl sm:text-3xl font-black text-slate-900">
              {(reseller.totalEarned - reseller.availableBalance - reseller.pendingBalance > 0 
                ? reseller.totalEarned - reseller.availableBalance - reseller.pendingBalance 
                : 20000).toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-500">FCFA</span>
            </p>
            <p className="text-[11px] text-slate-500">Vers vos comptes Mobile Money</p>
          </div>

        </div>

        {/* Withdrawal Form Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Wallet className="w-5 h-5 text-emerald-600" />
            <h2 className="font-black text-base text-slate-900">
              Demander un Retrait Mobile Money
            </h2>
          </div>

          {isSuccess ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-black text-base text-slate-900">
                Demande de Retrait Transmise !
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Votre demande de virement de <strong>{amount.toLocaleString('fr-FR')} FCFA</strong> vers votre compte <strong>{provider} ({phone})</strong> a été enregistrée. Le paiement sera validé sous 24h ouvrées.
              </p>
              <button
                onClick={() => setIsSuccess(false)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-colors"
              >
                Faire une autre demande
              </button>
            </div>
          ) : (
            <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
              
              {/* Payment Provider Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Sélectionnez votre moyen de réception Mobile Money *
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'Orange Money', label: 'Orange Money', color: 'border-orange-500 bg-orange-50 text-orange-950' },
                    { id: 'Wave', label: 'Wave Mali', color: 'border-blue-500 bg-blue-50 text-blue-950' },
                    { id: 'Moov Money', label: 'Moov Money', color: 'border-cyan-500 bg-cyan-50 text-cyan-950' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setProvider(item.id as any)}
                      className={`p-3 rounded-2xl border-2 text-center text-xs font-bold transition-all ${
                        provider === item.id 
                          ? `${item.color} shadow-xs scale-[1.02]` 
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone and Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Numéro {provider} *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Montant à retirer (FCFA) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setAmount(reseller.availableBalance)}
                      className="text-[10px] font-bold text-emerald-700 hover:underline"
                    >
                      Tout retirer ({reseller.availableBalance.toLocaleString('fr-FR')} F)
                    </button>
                  </div>
                  <input
                    type="number"
                    required
                    min={5000}
                    max={reseller.availableBalance}
                    step={1000}
                    value={amount}
                    onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Minimum de retrait : 5 000 FCFA
                  </span>
                </div>
              </div>

              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-bold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={reseller.availableBalance < 5000}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-2xl text-xs shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]"
              >
                <span>Confirmer la demande de retrait</span>
                <ArrowRight className="w-4 h-4" />
              </button>

            </form>
          )}
        </div>

        {/* Withdrawals History */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <History className="w-5 h-5 text-slate-600" />
            <h2 className="font-black text-base text-slate-900">
              Historique des Retraits
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {myWithdrawals.map((wth) => (
              <div key={wth.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-slate-900">
                    {wth.amount.toLocaleString('fr-FR')} FCFA vers {wth.payoutProvider}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {wth.payoutPhone} • {new Date(wth.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                  {wth.transactionReference && (
                    <p className="text-[10px] text-emerald-700 font-mono">
                      Réf: {wth.transactionReference}
                    </p>
                  )}
                </div>

                <div>
                  {wth.status === 'completed' && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                      ✅ Payé
                    </span>
                  )}
                  {wth.status === 'pending' && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                      ⏳ En cours
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
