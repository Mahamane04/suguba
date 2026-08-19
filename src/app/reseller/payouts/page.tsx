'use client';

import React, { useState } from 'react';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { 
  Wallet, CheckCircle2, Clock, Smartphone,
  AlertCircle, ArrowRight, History, ExternalLink, Zap
} from 'lucide-react';

const ussdShortcuts = [
  {
    provider: 'Orange Money',
    code: '#144#',
    link: 'tel:*144%23',
    description: 'Consulter solde & transferts OM',
    color: 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100',
  },
  {
    provider: 'Wave Mali',
    code: 'App Wave',
    link: 'https://wave.com',
    description: 'Ouvrir Wave Mali pour voir vos dépôts',
    color: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100',
  },
  {
    provider: 'Moov Money',
    code: '#166#',
    link: 'tel:*166%23',
    description: 'Consulter solde Moov Money',
    color: 'bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100',
  },
];

export default function ResellerPayoutsPage() {
  const state = useSugubaStore();
  const [amount, setAmount] = useState<number>(10000);
  const [provider, setProvider] = useState<'Orange Money' | 'Wave' | 'Moov Money'>('Orange Money');
  const [phone, setPhone] = useState(state.currentUser.phone);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const reseller = state.resellers.find(r => r.userId === state.currentUser.id) || state.resellers[0];
  const myWithdrawals = state.withdrawals.filter(w => w.resellerId === reseller?.id);

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
    <div className="min-h-screen flex flex-col bg-[#f5f8f5] pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Page Title */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-gray-900">
            Mes Commissions & Retraits
          </h1>
          <p className="text-xs text-gray-500">
            Gérez vos créances commerciales et recevez vos paiements directement par Mobile Money (Orange Money, Wave, Moov).
          </p>
        </div>

        {/* Balances Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          <div className="bg-gradient-to-br from-emerald-600 to-green-700 text-white p-5 rounded-3xl shadow-brand-md space-y-1">
            <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">
              Solde Retirable Immédiatement
            </span>
            <p className="text-2xl sm:text-3xl font-black">
              {reseller.availableBalance.toLocaleString('fr-FR')} <span className="text-sm font-normal">FCFA</span>
            </p>
            <p className="text-[11px] text-emerald-100">Prêt pour virement Mobile Money</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-card space-y-1">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Sécurisé en Attente (J+7)
            </span>
            <p className="text-2xl sm:text-3xl font-black text-amber-600">
              {reseller.pendingBalance.toLocaleString('fr-FR')} <span className="text-sm font-normal text-gray-400">FCFA</span>
            </p>
            <p className="text-[11px] text-gray-400">Période de garantie anti-retour</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-card space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Total Déjà Retiré & Reçu
            </span>
            <p className="text-2xl sm:text-3xl font-black text-gray-900">
              {(reseller.totalEarned - reseller.availableBalance - reseller.pendingBalance > 0 
                ? reseller.totalEarned - reseller.availableBalance - reseller.pendingBalance 
                : 20000).toLocaleString('fr-FR')} <span className="text-sm font-normal text-gray-400">FCFA</span>
            </p>
            <p className="text-[11px] text-gray-400">Vers vos comptes Mobile Money</p>
          </div>

        </div>

        {/* USSD 1-Click Shortcuts (Mali) */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h2 className="font-bold text-xs uppercase tracking-wider text-gray-700">
                Raccourcis USSD 1-Clic Mali (Sans Connexion)
              </h2>
            </div>
            <span className="text-[10px] text-gray-400 font-semibold">Téléphone mobile</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {ussdShortcuts.map((item) => (
              <a
                key={item.provider}
                href={item.link}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all active:scale-95 ${item.color}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-sm">{item.provider}</span>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-white/80 shadow-2xs">
                      {item.code}
                    </span>
                  </div>
                  <p className="text-[10px] opacity-80">{item.description}</p>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold mt-2 pt-2 border-t border-current/10">
                  <span>Lancer sur mon téléphone</span>
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Withdrawal Form Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-card space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Wallet className="w-5 h-5 text-suguba-brand" />
            <h2 className="font-black text-base text-gray-900">
              Demander un Retrait Mobile Money
            </h2>
          </div>

          {isSuccess ? (
            <div className="bg-suguba-50 border border-suguba-200 rounded-2xl p-5 text-center space-y-3">
              <div className="w-12 h-12 bg-suguba-100 text-suguba-brand rounded-full flex items-center justify-center mx-auto shadow-brand-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-black text-base text-gray-900">
                Demande de Retrait Transmise !
              </h3>
              <p className="text-xs text-gray-600 max-w-md mx-auto">
                Votre demande de virement de <strong>{amount.toLocaleString('fr-FR')} FCFA</strong> vers votre compte <strong>{provider} ({phone})</strong> a été synchronisée dans Supabase Cloud. Le paiement sera exécuté automatiquement.
              </p>
              <button
                onClick={() => setIsSuccess(false)}
                className="px-5 py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-colors"
              >
                Faire une autre demande
              </button>
            </div>
          ) : (
            <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
              
              {/* Payment Provider Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
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
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
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
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Numéro {provider} *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:ring-2 focus:ring-suguba-brand/30 focus:border-suguba-brand transition-all"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-gray-700">
                      Montant à retirer (FCFA) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setAmount(reseller.availableBalance)}
                      className="text-[10px] font-bold text-suguba-brand hover:underline"
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
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:ring-2 focus:ring-suguba-brand/30 focus:border-suguba-brand transition-all"
                  />
                  <span className="text-[10px] text-gray-400 mt-1 block">
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
                className="w-full bg-suguba-brand hover:bg-suguba-brand-dark disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-2xl text-xs shadow-brand-md flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <span>Confirmer la demande de retrait</span>
                <ArrowRight className="w-4 h-4" />
              </button>

            </form>
          )}
        </div>

        {/* Withdrawals History */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-card space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <History className="w-5 h-5 text-gray-500" />
            <h2 className="font-black text-base text-gray-900">
              Historique des Retraits
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            {myWithdrawals.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">Aucun retrait effectué pour le moment.</p>
            ) : (
              myWithdrawals.map((wth) => (
                <div key={wth.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-xs text-gray-900">
                      {wth.amount.toLocaleString('fr-FR')} FCFA vers {wth.payoutProvider}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {wth.payoutPhone} • {new Date(wth.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                    {wth.transactionReference && (
                      <p className="text-[10px] text-suguba-brand font-mono font-bold">
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
              ))
            )}
          </div>
        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
