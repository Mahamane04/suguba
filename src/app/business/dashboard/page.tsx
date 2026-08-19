'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore } from '@/lib/store';
import { 
  Building2, Users, TrendingUp, PackageCheck, AlertTriangle, 
  Wallet, Share2, Copy, Check, Download, ArrowRight, Star, ExternalLink, ShieldCheck
} from 'lucide-react';

export default function BusinessDashboardPage() {
  const state = useSugubaStore();
  const [copiedLink, setCopiedLink] = useState(false);

  // Exemple pour Batimat Mali (ou toute autre grande structure partenaire)
  const enterpriseName = 'BATIMAT MALI';
  const brandSlug = 'batimat';
  const activePromotersCount = 142; // 142 jeunes revendeurs actifs à Bamako
  const totalOrdersCount = 86;
  const deliveredOrdersCount = 84;
  const returnedOrdersCount = 2;
  const totalVolumeGmv = 4980000; // 4 980 000 FCFA de CA généré
  const totalCommissionsPaid = 620000; // 620 000 FCFA distribués aux revendeurs

  const channelUrl = `https://app.sugubaml.com/c/${brandSlug}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(channelUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleExportCsv = () => {
    const csvContent = "data:text/csv;charset=utf-8," +
      "ID_Vente,Date,Produit,Revendeur_Partageur,Montant_Client_FCFA,Commission_Revendeur_FCFA,Statut_Livraison,OTP_Validation\n" +
      "VTE-901,2026-02-18,Perceuse à Percussion Pro 850W,Moussa Coulibaly,45000,5000,LIVRE_CLIENT,VALIDE\n" +
      "VTE-902,2026-02-18,Pack Outillage 108 Pièces Inox,Fatoumata Diarra,65000,7500,LIVRE_CLIENT,VALIDE\n" +
      "VTE-903,2026-02-17,Groupe Électrogène Silencieux,Oumar Cissé,185000,15000,LIVRE_CLIENT,VALIDE\n" +
      "VTE-904,2026-02-17,Robinetterie Mitigeur Luxe,Mariam Traoré,32000,4000,LIVRE_CLIENT,VALIDE\n";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rapport_ventes_${brandSlug}_suguba.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full space-y-8">
        
        {/* Enterprise Brand Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            <div className="flex items-start space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-2xl text-white border-2 border-white/20 shrink-0 shadow-lg">
                B
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-wider border border-blue-500/30">
                    Portail Suguba Business Entreprise
                  </span>
                  <span className="text-emerald-400 text-xs font-bold flex items-center">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    Compte Marchand Agréé
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">{enterpriseName}</h1>
                <p className="text-xs text-slate-300">
                  Pilotage de vos campagnes de vente partagée et de votre réseau de revendeurs à Bamako.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-xs font-bold transition-colors flex items-center space-x-1.5"
              >
                <Share2 className="w-4 h-4 text-emerald-400" />
                <span>{copiedLink ? 'Lien copié !' : 'Lien Onboarding Canal'}</span>
              </button>

              <Link
                href={`/c/${brandSlug}`}
                target="_blank"
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition-colors flex items-center space-x-1.5 shadow-xs"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Voir Mon Canal Public</span>
              </Link>
            </div>

          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-white/10 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Revendeurs Actifs</span>
              <p className="text-2xl font-black text-white">{activePromotersCount}</p>
              <p className="text-[10px] text-blue-300">Partageurs mobilisés</p>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Chiffre d&apos;Affaires Écoulé</span>
              <p className="text-2xl font-black text-emerald-400">
                {(totalVolumeGmv / 1000000).toFixed(2)}M <span className="text-xs font-normal">F</span>
              </p>
              <p className="text-[10px] text-emerald-300 font-medium">100% Encaissé sous OTP</p>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Taux de Réussite Livraison</span>
              <p className="text-2xl font-black text-white">97.6%</p>
              <p className="text-[10px] text-slate-300">{deliveredOrdersCount} livrés / {returnedOrdersCount} retours</p>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Commissions Distribuées</span>
              <p className="text-2xl font-black text-amber-300">
                {totalCommissionsPaid.toLocaleString('fr-FR')} <span className="text-xs font-normal">F</span>
              </p>
              <p className="text-[10px] text-amber-200">Reversées aux jeunes</p>
            </div>
          </div>
        </div>

        {/* Campaign Management & Export Box */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-black text-sm text-slate-900">
                Campagnes Actives & Historique des Ventes Réseau
              </h2>
              <p className="text-xs text-slate-500">
                Téléchargez les relevés de ventes certifiés pour votre comptabilité et audit de stock.
              </p>
            </div>

            <button
              onClick={handleExportCsv}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs flex items-center space-x-2 transition-all self-start sm:self-auto shadow-xs active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Exporter Rapport de Ventes (Excel / CSV)</span>
            </button>
          </div>

          {/* Table Preview */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase font-bold text-[10px]">
                  <th className="py-3">Réf Vente</th>
                  <th className="py-3">Article Vendu</th>
                  <th className="py-3">Revendeur Partageur</th>
                  <th className="py-3 text-right">Prix Client</th>
                  <th className="py-3 text-right">Commission</th>
                  <th className="py-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                <tr>
                  <td className="py-3 font-mono font-bold text-slate-900">#VTE-901</td>
                  <td className="py-3 font-bold">Perceuse à Percussion Pro 850W</td>
                  <td className="py-3">Moussa Coulibaly (Kalaban)</td>
                  <td className="py-3 text-right font-mono font-bold">45 000 F</td>
                  <td className="py-3 text-right font-mono text-emerald-600 font-bold">5 000 F</td>
                  <td className="py-3 text-center">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                      LIVRÉ (OTP)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-mono font-bold text-slate-900">#VTE-902</td>
                  <td className="py-3 font-bold">Pack Outillage 108 Pièces Inox</td>
                  <td className="py-3">Fatoumata Diarra (ACI 2000)</td>
                  <td className="py-3 text-right font-mono font-bold">65 000 F</td>
                  <td className="py-3 text-right font-mono text-emerald-600 font-bold">7 500 F</td>
                  <td className="py-3 text-center">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                      LIVRÉ (OTP)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-mono font-bold text-slate-900">#VTE-903</td>
                  <td className="py-3 font-bold">Groupe Électrogène Silencieux 3.5kVA</td>
                  <td className="py-3">Oumar Cissé (Badalabougou)</td>
                  <td className="py-3 text-right font-mono font-bold">185 000 F</td>
                  <td className="py-3 text-right font-mono text-emerald-600 font-bold">15 000 F</td>
                  <td className="py-3 text-center">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                      LIVRÉ (OTP)
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
