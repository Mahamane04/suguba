'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Calculator, Sparkles, TrendingUp, Users, 
  ArrowRight, Share2, CheckCircle2, DollarSign, Trophy, Wallet
} from 'lucide-react';

interface EarningsCalculatorProps {
  showCta?: boolean;
}

export default function EarningsCalculator({ showCta = true }: EarningsCalculatorProps) {
  const [salesPerDay, setSalesPerDay] = useState<number>(2);
  const [avgCommission, setAvgCommission] = useState<number>(3500);
  const [referralsCount, setReferralsCount] = useState<number>(3);

  // Calculations
  const monthlyDirectSales = salesPerDay * 30;
  const monthlyDirectIncome = monthlyDirectSales * avgCommission;

  // Referral income: each active referral makes ~10 sales/month (+1 000 F / sale)
  const monthlyReferralIncome = referralsCount * 10 * 1000;

  // Challenge Bonus based on volume
  let monthlyBonus = 0;
  if (monthlyDirectSales >= 90) {
    monthlyBonus = 50000; // Super Vendeur
  } else if (monthlyDirectSales >= 50) {
    monthlyBonus = 25000; // Vendeur Confirmé
  } else if (monthlyDirectSales >= 25) {
    monthlyBonus = 10000; // Vendeur Actif
  }

  const totalMonthlyIncome = monthlyDirectIncome + monthlyReferralIncome + monthlyBonus;

  // Real-life benchmark in Mali
  let benchmarkText = "Complément de revenu idéal pour étudiants et mères de famille";
  if (totalMonthlyIncome >= 300000) {
    benchmarkText = "🔥 Revenu supérieur à celui d'un cadre moyen à Bamako !";
  } else if (totalMonthlyIncome >= 150000) {
    benchmarkText = "🚀 Équivaut à plus de 3x le SMIG officiel au Mali !";
  } else if (totalMonthlyIncome >= 80000) {
    benchmarkText = "💡 Couvre le loyer et les dépenses quotidiennes d'un foyer à Bamako.";
  }

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6 text-left">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-black shadow-md shadow-emerald-500/20">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-base sm:text-lg text-slate-900">
              Simulateur de Revenus Mensuels Suguba
            </h3>
            <p className="text-xs text-slate-500">
              Estimez vos gains potentiels sans stock et payés par Wave & Orange Money.
            </p>
          </div>
        </div>

        <span className="px-3 py-1 bg-amber-50 text-amber-800 text-[11px] font-black rounded-full border border-amber-200 self-start sm:self-auto">
          0 FCFA d&apos;Investissement
        </span>
      </div>

      {/* Interactive Controls (Sliders) */}
      <div className="space-y-5">
        
        {/* Slider 1 : Ventes par jour */}
        <div className="space-y-2">
          <div className="flex justify-between items-baseline text-xs">
            <span className="font-bold text-slate-700 flex items-center space-x-1.5">
              <ShoppingBagIcon className="w-4 h-4 text-emerald-600" />
              <span>Nombre de ventes réalisées par jour :</span>
            </span>
            <span className="font-black text-emerald-700 font-mono text-sm bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
              {salesPerDay} {salesPerDay > 1 ? 'articles / jour' : 'article / jour'}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={salesPerDay}
            onChange={(e) => setSalesPerDay(Number(e.target.value))}
            aria-label="Nombre de ventes réalisées par jour"
            className="suguba-range text-emerald-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
            <span>1 / jour (Débutant)</span>
            <span>5 / jour (Actif)</span>
            <span>10 / jour (Pro TikTok)</span>
          </div>
        </div>

        {/* Slider 2 : Commission moyenne par produit */}
        <div className="space-y-2">
          <div className="flex justify-between items-baseline text-xs">
            <span className="font-bold text-slate-700 flex items-center space-x-1.5">
              <DollarSign className="w-4 h-4 text-amber-500" />
              <span>Commission moyenne par produit :</span>
            </span>
            <span className="font-black text-slate-900 font-mono text-sm bg-slate-100 px-2.5 py-0.5 rounded-lg">
              {avgCommission.toLocaleString('fr-FR')} FCFA
            </span>
          </div>
          <input
            type="range"
            min={2000}
            max={8000}
            step={500}
            value={avgCommission}
            onChange={(e) => setAvgCommission(Number(e.target.value))}
            aria-label="Commission moyenne par produit, en FCFA"
            className="suguba-range text-amber-500"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
            <span>2 000 F (Accessoires)</span>
            <span>4 000 F (Mode & Beauté)</span>
            <span>8 000 F (Électro & Solaire)</span>
          </div>
        </div>

        {/* Slider 3 : Amis parrainés dans votre équipe */}
        <div className="space-y-2">
          <div className="flex justify-between items-baseline text-xs">
            <span className="font-bold text-slate-700 flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-purple-600" />
              <span>Amis parrainés dans votre équipe :</span>
            </span>
            <span className="font-black text-purple-700 font-mono text-sm bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200">
              {referralsCount} {referralsCount > 1 ? 'filleuls actifs' : 'filleul actif'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={referralsCount}
            onChange={(e) => setReferralsCount(Number(e.target.value))}
            aria-label="Nombre d'amis parrainés dans votre équipe"
            className="suguba-range text-purple-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
            <span>0 filleul</span>
            <span>10 filleuls</span>
            <span>20 filleuls</span>
          </div>
        </div>

      </div>

      {/* Big Total Estimated Income Box */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-widest block">
              Revenu Mensuel Net Estimé
            </span>
            <div className="text-3xl sm:text-4xl font-black text-amber-400 font-mono tracking-tight">
              {totalMonthlyIncome.toLocaleString('fr-FR')} <span className="text-xl font-normal text-white">FCFA / mois</span>
            </div>
          </div>

          <div className="space-y-1 text-right text-xs">
            <div className="text-slate-300">
              Ventes directes : <strong className="text-white font-mono">{monthlyDirectIncome.toLocaleString('fr-FR')} F</strong>
            </div>
            {monthlyReferralIncome > 0 && (
              <div className="text-purple-300">
                Parrainage d&apos;équipe : <strong className="text-white font-mono">+{monthlyReferralIncome.toLocaleString('fr-FR')} F</strong>
              </div>
            )}
            {monthlyBonus > 0 && (
              <div className="text-amber-300">
                Prime Challenge Suguba : <strong className="text-white font-mono">+{monthlyBonus.toLocaleString('fr-FR')} F</strong>
              </div>
            )}
          </div>
        </div>

        {/* Benchmark Tag */}
        <div className="p-3 bg-white/10 rounded-2xl border border-white/10 text-xs font-semibold text-emerald-200 flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <span>{benchmarkText}</span>
        </div>
      </div>

      {/* CTA Button */}
      {showCta && (
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Link
            href="/reseller/join"
            className="flex-1 py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-transform active:scale-95 text-center"
          >
            <span>Commencer à Gagner Dès Aujourd&apos;hui (Gratuit)</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
              `💰 *Calculez vos revenus mensuels sur Suguba Mali !*\n\nEn vendant seulement ${salesPerDay} article(s)/jour, vous pouvez gagner environ *${totalMonthlyIncome.toLocaleString('fr-FR')} FCFA / mois* sans stock !\n\nFaites votre simulation ici :\nhttps://app.sugubaml.com/reseller/calculator`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="py-4 px-5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 transition-all shadow-xs"
          >
            <Share2 className="w-4 h-4" />
            <span>Partager sur WhatsApp</span>
          </a>
        </div>
      )}

    </div>
  );
}

function ShoppingBagIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
