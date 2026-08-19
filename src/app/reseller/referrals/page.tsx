'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore } from '@/lib/store';
import { 
  Users, Share2, Copy, Check, Gift, 
  TrendingUp, Sparkles, ArrowRight, MessageCircle, DollarSign, Award
} from 'lucide-react';

export default function ResellerReferralsPage() {
  const state = useSugubaStore();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const currentUser = state.currentUser;
  const reseller = state.resellers.find(r => r.userId === currentUser.id) || state.resellers[0];

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.sugubaml.com';
  const referralLink = `${appUrl}/reseller/join?ref=${reseller.referralCode}`;

  // Données de simulation des filleuls du revendeur
  const referralNetwork = [
    {
      id: 'ref-usr-1',
      name: 'Fatoumata Traoré',
      phone: '+223 72 34 56 78',
      joinedDate: '01 Février 2026',
      totalSales: 12,
      passiveEarnings: 12000, // 1000 FCFA par vente
      status: 'active',
      city: 'Bamako (Kalaban-Coro)',
    },
    {
      id: 'ref-usr-2',
      name: 'Ibrahim Diarra',
      phone: '+223 68 11 22 33',
      joinedDate: '08 Février 2026',
      totalSales: 8,
      passiveEarnings: 8000,
      status: 'active',
      city: 'Bamako (Baco-Djicoroni)',
    },
    {
      id: 'ref-usr-3',
      name: 'Aïssata Coulibaly',
      phone: '+223 75 99 88 77',
      joinedDate: '14 Février 2026',
      totalSales: 3,
      passiveEarnings: 3000,
      status: 'active',
      city: 'Bamako (Hamdallaye)',
    },
  ];

  const totalPassiveEarnings = referralNetwork.reduce((acc, f) => acc + f.passiveEarnings, 0);
  const totalTeamSales = referralNetwork.reduce((acc, f) => acc + f.totalSales, 0);

  const inviteMessage = `🚀 *DEVENEZ REVENDEUR SUGUBA & GAGNEZ DES COMMISSIONS À BAMAKO !*\n\n` +
    `Je t'invite à rejoindre le réseau officiel Suguba Mali :\n` +
    `✅ Zéro stock à acheter, zéro risque\n` +
    `✅ Produits certifiés avec garantie 12 mois\n` +
    `✅ Livraison & encaissement gérés à 100% par Suguba\n` +
    `💰 Gagnez entre 3 000 et 10 000 FCFA par vente livrée, payés directement par Wave ou Orange Money !\n\n` +
    `👉 *Inscris-toi gratuitement avec mon lien d'invitation :*\n${referralLink}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleShareWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(inviteMessage)}`, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Header Title Banner */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-purple-200 text-xs font-bold">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Programme d&apos;Affiliation Réseau 2 Niveaux</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black">
                Parrainez des Revendeurs & Gagnez en Passif
              </h1>
              <p className="text-xs text-purple-200/90 max-w-lg">
                Touchez <strong>+1 000 FCFA de prime cash automatique</strong> sur chaque vente livrée et validée par vos filleuls !
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-xs border border-white/20 p-4 rounded-2xl text-center self-start sm:self-auto shrink-0">
              <span className="text-[10px] uppercase font-bold text-purple-200 block">Gains Passifs Cumulés</span>
              <span className="text-2xl font-black text-white">+{totalPassiveEarnings.toLocaleString('fr-FR')}</span>
              <span className="text-[10px] text-purple-200 block">FCFA encaissés</span>
            </div>
          </div>

          {/* Quick Copy Link Bar */}
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/20 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="w-full truncate font-mono text-xs text-purple-100 text-center sm:text-left">
              {referralLink}
            </div>

            <div className="flex space-x-2 shrink-0 w-full sm:w-auto">
              <button
                onClick={handleCopyLink}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-white text-slate-900 hover:bg-slate-100 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Lien copié !' : 'Copier le lien'}</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-xs"
              >
                <MessageCircle className="w-3.5 h-3.5 fill-current" />
                <span>Inviter sur WhatsApp</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Filleuls Actifs</span>
            <p className="text-2xl font-black text-slate-900">{referralNetwork.length} vendeurs</p>
            <p className="text-[10px] text-slate-400">Dans votre équipe à Bamako</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Ventes de votre Équipe</span>
            <p className="text-2xl font-black text-emerald-700">{totalTeamSales} commandes</p>
            <p className="text-[10px] text-emerald-600 font-bold">Livrées par vos filleuls</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-purple-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">Bonus Parrainage / Vente</span>
            <p className="text-2xl font-black text-purple-700">+1 000 FCFA</p>
            <p className="text-[10px] text-slate-400">Par colis livré par votre filleul</p>
          </div>
        </div>

        {/* Simulator Card */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-3xl border border-amber-200 space-y-3">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-amber-700" />
            <h3 className="font-black text-sm text-slate-900">Simulateur de Revenus Passifs</h3>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            💡 <strong>Exemple concret :</strong> Si vous parrainez <strong>5 revendeurs actifs</strong> qui vendent chacun seulement <strong>2 produits par semaine</strong> :
          </p>
          <div className="p-3 bg-white rounded-2xl border border-amber-300 font-bold text-xs text-amber-950 flex items-center justify-between">
            <span>5 filleuls x 2 ventes/semaine x 4 semaines = 40 ventes/mois</span>
            <span className="text-sm font-black text-emerald-700">+40 000 FCFA / mois en automatique</span>
          </div>
        </div>

        {/* Referral Network List */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-purple-600" />
              <h2 className="font-black text-sm text-slate-900">Vos Filleuls Enregistrés ({referralNetwork.length})</h2>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl">
              Actifs
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {referralNetwork.map((filleul) => (
              <div key={filleul.id} className="py-3.5 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900">{filleul.name}</h4>
                  <p className="text-[10px] text-slate-500">{filleul.phone} • {filleul.city}</p>
                  <p className="text-[9px] text-slate-400">Inscrit le {filleul.joinedDate}</p>
                </div>

                <div className="text-right">
                  <span className="font-black text-xs text-purple-800 block">
                    +{filleul.passiveEarnings.toLocaleString('fr-FR')} FCFA
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {filleul.totalSales} ventes générées
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ready-to-copy WhatsApp Invite Kit */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-xs text-slate-900 flex items-center space-x-1.5">
              <Gift className="w-4 h-4 text-emerald-600" />
              <span>Message d&apos;Invitation Prêt à l&apos;Emploi :</span>
            </h3>

            <button
              onClick={handleCopyScript}
              className="px-3 py-1 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center space-x-1"
            >
              {copiedScript ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedScript ? 'Texte copié !' : 'Copier le texte'}</span>
            </button>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 font-mono whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
            {inviteMessage}
          </div>
        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
