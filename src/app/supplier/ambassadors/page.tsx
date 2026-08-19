'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore } from '@/lib/store';
import { 
  Users, Store, Share2, Copy, Check, 
  ArrowLeft, Sparkles, TrendingUp, DollarSign, MessageCircle, ExternalLink, Trophy
} from 'lucide-react';

export default function SupplierAmbassadorsPage() {
  const state = useSugubaStore();
  const [copiedShowroom, setCopiedShowroom] = useState(false);
  const [copiedRecruitMsg, setCopiedRecruitMsg] = useState(false);

  const currentUser = state.currentUser;
  const supplier = state.suppliers.find(s => s.userId === currentUser.id) || state.suppliers[0];

  const showroomSlug = supplier.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const showroomUrl = `https://app.sugubaml.com/s/${showroomSlug}`;

  // Dedicated Ambassador Network Metrics
  const networkAmbassadorsCount = 14; // 14 vendeuses/filleules rattachées à la boutique
  const totalSalesByTeam = 38; // 38 ventes générées ce mois-ci
  const totalRevenueByTeam = 1330000; // 1 330 000 FCFA de CA généré
  const passiveSponsorBonusEarned = totalSalesByTeam * 1000; // 38 000 FCFA de prime marraine

  const recruitmentMessage = `🌟 *REJOIGNEZ L'ÉQUIPE DE REVENDEUSES OFFICIELLES DE ${supplier.companyName.toUpperCase()} SUR SUGUBA MALI !* 🇲🇱\n\n` +
    `Vous avez une communauté sur WhatsApp, TikTok ou Instagram ? Vendez nos produits exclusifs sans acheter de stock !\n\n` +
    `✅ Accès direct à notre collection de produits certifiés\n` +
    `✅ Gagnez entre *3 000 F et 7 000 F* de commission par vente\n` +
    `✅ Livraison 24h & encaissement gérés à 100% par Suguba à Bamako\n` +
    `✅ Paiement garanti de vos gains sur votre *Wave* ou *Orange Money*\n\n` +
    `👉 *Inscrivez-vous gratuitement dans mon équipe :*\n` +
    `https://app.sugubaml.com/reseller/join?sponsor=${supplier.companyName.substring(0, 4).toUpperCase()}`;

  const handleCopyShowroom = () => {
    navigator.clipboard.writeText(showroomUrl);
    setCopiedShowroom(true);
    setTimeout(() => setCopiedShowroom(false), 2000);
  };

  const handleCopyRecruitMsg = () => {
    navigator.clipboard.writeText(recruitmentMessage);
    setCopiedRecruitMsg(true);
    setTimeout(() => setCopiedRecruitMsg(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link 
              href="/supplier" 
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à l&apos;Espace Fournisseur</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center space-x-2">
              <Users className="w-6 h-6 text-purple-600" />
              <span>Mon Réseau d&apos;Ambassadrices & Showroom Privé</span>
            </h1>
            <p className="text-xs text-slate-500">
              Pilotez votre propre réseau de vendeuses affiliées dédiées aux produits de votre boutique.
            </p>
          </div>

          <Link
            href={`/s/${showroomSlug}`}
            target="_blank"
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl text-xs shadow-md transition-all self-start sm:self-auto active:scale-95"
          >
            <ExternalLink className="w-4 h-4 text-emerald-400" />
            <span>Voir Ma Boutique Publique</span>
          </Link>
        </div>

        {/* 4 Key Network Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-white p-5 rounded-3xl border border-purple-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">Mes Ambassadrices</span>
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-black text-purple-700">{networkAmbassadorsCount}</p>
            <p className="text-[10px] text-purple-600 font-medium">Vendeuses dans votre équipe</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Ventes Équipe</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-700">{totalSalesByTeam}</p>
            <p className="text-[10px] text-emerald-600 font-medium">Commandes générées ce mois</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Chiffre d&apos;Affaires</span>
              <DollarSign className="w-4 h-4 text-slate-700" />
            </div>
            <p className="text-2xl font-black text-slate-900">
              {(totalRevenueByTeam / 1000000).toFixed(2)}M <span className="text-xs font-normal">F</span>
            </p>
            <p className="text-[10px] text-slate-400">Total généré par vos filleules</p>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-5 rounded-3xl shadow-md space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-100 uppercase tracking-wider">Bonus Marraine (+1 000 F)</span>
              <Trophy className="w-4 h-4 text-amber-200" />
            </div>
            <p className="text-2xl font-black text-white">
              +{passiveSponsorBonusEarned.toLocaleString('fr-FR')} <span className="text-xs font-normal">F</span>
            </p>
            <p className="text-[10px] text-amber-100 font-medium">Gain passif additionnel net</p>
          </div>

        </div>

        {/* Private Showroom Link Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-black text-sm text-slate-900 flex items-center space-x-2">
                <Store className="w-4 h-4 text-emerald-600" />
                <span>Votre Lien de Boutique Dédié (Showroom Exclusif)</span>
              </h2>
              <p className="text-xs text-slate-500">
                Vos abonnées et clientes ne voient que vos articles sur cette page privée.
              </p>
            </div>

            <button
              onClick={handleCopyShowroom}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-colors self-start sm:self-auto shadow-xs active:scale-95"
            >
              {copiedShowroom ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedShowroom ? 'Lien copié !' : 'Copier Lien Showroom'}</span>
            </button>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-emerald-800 break-all">
            {showroomUrl}
          </div>
        </div>

        {/* Recruitment Kit Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-black text-sm text-slate-900 flex items-center space-x-2">
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
                <span>Message de Recrutement pour vos Statuts WhatsApp & TikTok</span>
              </h2>
              <p className="text-xs text-slate-500">
                Postez ce message pour inviter vos abonnées à devenir vos vendeuses officielles.
              </p>
            </div>

            <button
              onClick={handleCopyRecruitMsg}
              className="px-4 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-colors self-start sm:self-auto shadow-xs active:scale-95"
            >
              {copiedRecruitMsg ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedRecruitMsg ? 'Texte copié !' : 'Copier Message WhatsApp'}</span>
            </button>
          </div>

          <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-2xl text-xs text-slate-800 whitespace-pre-line leading-relaxed">
            {recruitmentMessage}
          </div>
        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
