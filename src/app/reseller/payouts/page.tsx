'use client';

import React, { useState } from 'react';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { Withdrawal } from '@/types';
import { 
  Wallet, CheckCircle2, Clock, Smartphone,
  AlertCircle, ArrowRight, History, ExternalLink, Zap,
  Building2, QrCode, ShieldCheck, MapPin, Copy, Check
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
  const [provider, setProvider] = useState<'Orange Money' | 'Wave' | 'Moov Money' | 'Agence Suguba'>('Orange Money');
  const [phone, setPhone] = useState(state.currentUser.phone);
  const [lastWithdrawal, setLastWithdrawal] = useState<Withdrawal | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const reseller = state.resellers.find(r => r.userId === state.currentUser.id) || state.resellers[0];
  const myWithdrawals = state.withdrawals.filter(w => w.resellerId === reseller?.id);

  const handleWithdrawalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSuccess(false);

    try {
      const created = sugubaStore.requestWithdrawal({
        resellerId: reseller.id,
        amount: Number(amount),
        payoutProvider: provider,
        payoutPhone: phone,
      });
      setLastWithdrawal(created);
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la demande de retrait');
    }
  };

  const copyCode = (code: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
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
            Recevez vos gains par Mobile Money (Orange Money, Wave, Moov) ou en espèces directement au Guichet Suguba Bamako.
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
            <p className="text-[11px] text-emerald-100">Prêt pour virement ou retrait guichet</p>
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
            <p className="text-[11px] text-gray-400">Vers Mobile Money ou Guichet</p>
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
              Demander un Retrait
            </h2>
          </div>

          {isSuccess && lastWithdrawal ? (
            <div className="bg-suguba-50 border border-suguba-200 rounded-3xl p-6 text-center space-y-4 animate-fade-up">
              <div className="w-14 h-14 bg-suguba-100 text-suguba-brand rounded-2xl flex items-center justify-center mx-auto shadow-brand-sm">
                {lastWithdrawal.payoutProvider === 'Agence Suguba' ? (
                  <Building2 className="w-8 h-8" />
                ) : (
                  <CheckCircle2 className="w-8 h-8" />
                )}
              </div>

              {lastWithdrawal.payoutProvider === 'Agence Suguba' ? (
                /* Mode Retrait en Agence */
                <div className="space-y-3">
                  <h3 className="font-black text-lg text-gray-900">
                    Code de Retrait Guichet Généré !
                  </h3>
                  <p className="text-xs text-gray-600 max-w-md mx-auto">
                    Présentez ce code secret au guichet de l&apos;agence Suguba avec votre pièce d&apos;identité pour récupérer vos espèces :
                  </p>

                  {/* Big Pickup Code Box */}
                  <div className="p-4 bg-white rounded-2xl border-2 border-suguba-brand shadow-brand-md max-w-xs mx-auto space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Code Secret Guichet (72h)
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono text-3xl font-black text-gray-900 tracking-wider">
                        {lastWithdrawal.pickupCode}
                      </span>
                      <button
                        onClick={() => copyCode(lastWithdrawal.pickupCode || '')}
                        className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                        title="Copier le code"
                      >
                        {isCopied ? <Check className="w-4 h-4 text-suguba-brand" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] font-bold text-suguba-brand">
                      Montant : {lastWithdrawal.amount.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>

                  <div className="p-3 bg-white/80 rounded-xl border border-gray-200 text-left max-w-sm mx-auto space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-gray-800">
                      <MapPin className="w-4 h-4 text-suguba-brand shrink-0" />
                      <span>Agence Suguba Mali :</span>
                    </div>
                    <p className="text-gray-600 pl-5 text-[11px]">
                      Hamdallaye ACI 2000, Rue 314, Porte 88, Bamako
                    </p>
                    <p className="text-gray-400 pl-5 text-[10px]">
                      Ouvert du Lundi au Samedi de 08h30 à 18h00 • Tél : +223 89 46 00 00
                    </p>
                  </div>
                </div>
              ) : (
                /* Mode Mobile Money */
                <div className="space-y-2">
                  <h3 className="font-black text-base text-gray-900">
                    Demande de Virement Transmise !
                  </h3>
                  <p className="text-xs text-gray-600 max-w-md mx-auto">
                    Votre demande de virement de <strong>{lastWithdrawal.amount.toLocaleString('fr-FR')} FCFA</strong> vers votre compte <strong>{lastWithdrawal.payoutProvider} ({lastWithdrawal.payoutPhone})</strong> a été synchronisée dans Supabase Cloud.
                  </p>
                </div>
              )}

              <button
                onClick={() => { setIsSuccess(false); setLastWithdrawal(null); }}
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
                  Sélectionnez votre moyen de réception *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'Orange Money', label: 'Orange Money', color: 'border-orange-500 bg-orange-50 text-orange-950', badge: 'OM' },
                    { id: 'Wave', label: 'Wave Mali', color: 'border-blue-500 bg-blue-50 text-blue-950', badge: 'Wave' },
                    { id: 'Moov Money', label: 'Moov Money', color: 'border-cyan-500 bg-cyan-50 text-cyan-950', badge: 'Moov' },
                    { id: 'Agence Suguba', label: 'Agence (Espèces)', color: 'border-emerald-600 bg-emerald-50 text-emerald-950', badge: '0% Frais' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setProvider(item.id as any)}
                      className={`p-3 rounded-2xl border-2 text-center text-xs font-bold transition-all relative ${
                        provider === item.id 
                          ? `${item.color} shadow-brand-sm scale-[1.02]` 
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="block">{item.label}</span>
                      <span className="text-[9px] opacity-70 font-semibold mt-0.5 block">{item.badge}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notice for Agency */}
              {provider === 'Agence Suguba' && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900 animate-fade-up">
                  <Building2 className="w-5 h-5 text-suguba-brand shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Retrait Espèces au Guichet Suguba (0% de Frais)</p>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Un code secret unique vous sera remis. Présentez-vous à l&apos;agence d&apos;Hamdallaye ACI 2000 pour récupérer votre argent immédiatement.
                    </p>
                  </div>
                </div>
              )}

              {/* Phone and Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {provider === 'Agence Suguba' ? 'Numéro de téléphone de contact *' : `Numéro ${provider} *`}
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
                <span>{provider === 'Agence Suguba' ? 'Générer mon Code de Retrait Guichet' : 'Confirmer la demande de virement'}</span>
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
                <div key={wth.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-xs text-gray-900">
                        {wth.amount.toLocaleString('fr-FR')} FCFA vers {wth.payoutProvider}
                      </p>
                      {wth.pickupCode && (
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
                          Code: {wth.pickupCode}
                        </span>
                      )}
                    </div>
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
                        ⏳ En attente
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
