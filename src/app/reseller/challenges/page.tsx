'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore } from '@/lib/store';
import { 
  Trophy, Flame, Award, Zap, TrendingUp, 
  CheckCircle2, Clock, Gift, ArrowRight, Sparkles, Star
} from 'lucide-react';

export default function ResellerChallengesPage() {
  const state = useSugubaStore();
  const currentUser = state.currentUser;
  const reseller = state.resellers.find(r => r.userId === currentUser.id) || state.resellers[0];

  const currentSales = reseller.successfulOrdersCount || 0;

  // Challenges Actifs
  const challenges = [
    {
      id: 'ch-1',
      title: 'Sprint Ventes de la Semaine',
      target: 5,
      current: Math.min(5, currentSales),
      reward: '5 000 FCFA',
      bonusType: 'Prime Cash Mobile Money',
      daysLeft: 3,
      badge: '🔥 Sprint',
      desc: 'Réalisez 5 ventes livrées et validées par OTP cette semaine.',
      isCompleted: currentSales >= 5,
    },
    {
      id: 'ch-2',
      title: 'Grand Défi du Mois — Bamako Élite',
      target: 20,
      current: Math.min(20, currentSales),
      reward: '25 000 FCFA',
      bonusType: 'Bonus Trésorerie VIP',
      daysLeft: 12,
      badge: '👑 Élite',
      desc: 'Atteignez 20 commandes livrées ce mois-ci et décrochez le statut VIP.',
      isCompleted: currentSales >= 20,
    },
    {
      id: 'ch-3',
      title: 'Pionnier Smart TV Samsung',
      target: 3,
      current: Math.min(3, currentSales),
      reward: '10 000 FCFA',
      bonusType: 'Prime Produit Star',
      daysLeft: 7,
      badge: '⭐ Produit Star',
      desc: 'Vendez 3 téléviseurs Smart TV 43" ou 55" via vos statuts WhatsApp.',
      isCompleted: currentSales >= 3,
    }
  ];

  // Classement des Meilleurs Vendeurs de Bamako (Top Leaderboard)
  const leaderboard = [
    { rank: 1, name: 'Moussa Coulibaly', sales: 34, earnings: 136000, badge: '🥇 Or', city: 'Bamako (ACI 2000)' },
    { rank: 2, name: 'Fatoumata Traoré', sales: 28, earnings: 112000, badge: '🥈 Argent', city: 'Bamako (Kalaban-Coro)' },
    { rank: 3, name: 'Ibrahim Diarra', sales: 22, earnings: 88000, badge: '🥉 Bronze', city: 'Bamako (Baco-Djicoroni)' },
    { rank: 4, name: 'Awa Sanogo', sales: 18, earnings: 72000, badge: '⭐ Top 5', city: 'Bamako (Badalabougou)' },
    { rank: 5, name: 'Oumar Keïta', sales: 15, earnings: 60000, badge: '⭐ Top 5', city: 'Bamako (Médina-Coura)' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-6 rounded-3xl shadow-lg">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-amber-100 text-xs font-bold">
              <Trophy className="w-4 h-4 text-amber-300" />
              <span>Programme de Primes & Challenges Suguba</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black">
              Défis & Classement des Vendeurs
            </h1>
            <p className="text-xs text-amber-100/90">
              Gagnez des primes cash Mobile Money en plus de vos commissions habituelles !
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs border border-white/20 p-3.5 rounded-2xl text-center self-start sm:self-auto">
            <span className="text-[10px] uppercase font-bold text-amber-200 block">Vos Ventes Actuelles</span>
            <span className="text-2xl font-black text-white">{currentSales}</span>
            <span className="text-[10px] text-amber-200 block">commandes livrées</span>
          </div>
        </div>

        {/* Active Challenges List */}
        <div className="space-y-4">
          <h2 className="font-black text-base text-slate-900 flex items-center">
            <Flame className="w-5 h-5 mr-1.5 text-orange-500" />
            <span>Défis Actifs de la Semaine</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {challenges.map((ch) => {
              const progressPct = Math.min(100, Math.round((ch.current / ch.target) * 100));

              return (
                <div 
                  key={ch.id}
                  className={`bg-white rounded-3xl p-5 border ${
                    ch.isCompleted ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-200'
                  } shadow-xs space-y-4 flex flex-col justify-between`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
                        {ch.badge}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium flex items-center">
                        <Clock className="w-3 h-3 mr-1 text-slate-400" />
                        Fin dans {ch.daysLeft}j
                      </span>
                    </div>

                    <h3 className="font-black text-sm text-slate-900 leading-snug">
                      {ch.title}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {ch.desc}
                    </p>
                  </div>

                  {/* Reward & Progress */}
                  <div className="space-y-3 pt-2">
                    <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-bold text-amber-800 uppercase block">Prime à Décrocher</span>
                        <span className="text-sm font-black text-amber-900">+{ch.reward}</span>
                      </div>
                      <Gift className="w-5 h-5 text-amber-600" />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-bold mb-1">
                        <span className="text-slate-600">Progression :</span>
                        <span className="text-slate-900 font-black">{ch.current} / {ch.target} ventes</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            ch.isCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {ch.isCompleted ? (
                      <div className="p-2 bg-emerald-100 text-emerald-900 rounded-xl text-center text-xs font-bold flex items-center justify-center space-x-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Défi Validé • Prime Éligible</span>
                      </div>
                    ) : (
                      <Link
                        href="/reseller/catalog"
                        className="w-full py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors"
                      >
                        <span>Partager des produits</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Resellers Leaderboard Bamako */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-black text-sm text-slate-900">Classement des Meilleurs Vendeurs de Bamako</h2>
                <p className="text-[10px] text-slate-500">Mise à jour en temps réel des performances</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl">
              Mois en cours
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {leaderboard.map((seller) => (
              <div key={seller.rank} className="py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                    seller.rank === 1 ? 'bg-amber-400 text-slate-950 font-black' :
                    seller.rank === 2 ? 'bg-slate-300 text-slate-900' :
                    seller.rank === 3 ? 'bg-amber-700 text-white' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {seller.rank}
                  </span>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">{seller.name}</h4>
                    <p className="text-[10px] text-slate-500">{seller.city}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-black text-xs text-emerald-700 block">
                    {seller.sales} ventes livrées
                  </span>
                  <span className="text-[10px] text-slate-500">
                    +{seller.earnings.toLocaleString('fr-FR')} F gagnés
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
