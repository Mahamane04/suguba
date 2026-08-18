'use client';

import React, { useState } from 'react';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import BannerGeneratorModal from '@/components/reseller/BannerGeneratorModal';
import { useSugubaStore } from '@/lib/store';
import { 
  Sparkles, MessageCircle, Copy, Check, Video, 
  Flame, TrendingUp, Award, Share2, Lightbulb 
} from 'lucide-react';

export default function ResellerMarketingPage() {
  const state = useSugubaStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);

  const reseller = state.resellers.find(r => r.userId === state.currentUser.id) || state.resellers[0];

  const marketingKits = [
    {
      id: 'kit-1',
      title: 'Post Statut WhatsApp — Promo Smart TV Samsung',
      target: 'Statuts WhatsApp & Groupes',
      text: `🔥 PROMO FLASH BAMAKO : Smart TV Samsung 43" Neuve !
✅ Qualité 4K Cristal avec YouTube & Netflix
✅ Garantie 12 mois offerte
💰 Prix Spécial : 145 000 FCFA
🛵 Livraison rapide partout à Bamako - Payez uniquement à la réception !
👉 Écrivez-moi directement en privé pour réserver la vôtre aujourd'hui !`,
    },
    {
      id: 'kit-2',
      title: 'Post Anti-Délestage — Kit Solaire Autonome',
      target: 'Groupes WhatsApp de quartier & Famille',
      text: `☀️ FINI LE NOIR PENDANT LES COUPURES D'ÉLECTRICITÉ !
Kit Solaire complet prêt à l'emploi : 4 ampoules lumineuses + recharge de tous les téléphones.
✅ Autonomie 10h garantie
💰 Prix : 65 000 FCFA
🛵 Livraison à domicile dans la journée.
👉 Commandez maintenant en m'écrivant directement !`,
    },
    {
      id: 'kit-3',
      title: 'Idée Vidéo TikTok / Reel Instagram',
      target: 'TikTok & Facebook Reels',
      text: `Script vidéo suggéré :
1. Montrer une vidéo d'une coupure de courant ou d'un mixeur cassé (problème).
2. Présenter le produit Suguba avec le prix clair.
3. Rappeler la garantie et le paiement à la livraison à Bamako.
4. Mettre votre lien personnel Suguba dans la bio ou en message privé !`,
    }
  ];

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Page Title & Studio CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Centre Marketing & Kits de Vente
            </h1>
            <p className="text-xs text-slate-500">
              Boostez vos ventes sur WhatsApp, Facebook et TikTok grâce à nos accroches testées et validées.
            </p>
          </div>

          <button
            onClick={() => setIsStudioOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-black rounded-2xl text-xs shadow-lg shadow-emerald-600/20 active:scale-95 transition-all self-start sm:self-auto"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Studio Affiches WhatsApp</span>
          </button>
        </div>

        {/* Reseller Tips Card */}
        <div className="bg-gradient-to-r from-emerald-800 to-green-900 text-white rounded-3xl p-5 shadow-lg space-y-3">
          <div className="flex items-center space-x-2">
            <Lightbulb className="w-5 h-5 text-amber-300" />
            <h2 className="font-bold text-sm">Les 3 Secrets des Meilleurs Revendeurs Suguba</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-emerald-100">
            <div className="bg-white/10 p-3 rounded-2xl border border-white/10">
              <strong className="text-white block mb-1">1. Régularité</strong>
              Postez 2 produits par jour sur votre statut WhatsApp (à 8h et 18h).
            </div>
            <div className="bg-white/10 p-3 rounded-2xl border border-white/10">
              <strong className="text-white block mb-1">2. Rassurer</strong>
              Rappelez toujours que le client paie à la livraison et bénéficie d&apos;une garantie.
            </div>
            <div className="bg-white/10 p-3 rounded-2xl border border-white/10">
              <strong className="text-white block mb-1">3. Réactivité</strong>
              Dès qu&apos;un client est intéressé, saisissez sa commande dans Suguba en 1 minute.
            </div>
          </div>
        </div>

        {/* Marketing Kits List */}
        <div className="space-y-4">
          <h2 className="font-black text-base text-slate-900">
            Kits Textes & Scripts Prêts à Poster
          </h2>

          <div className="space-y-3">
            {marketingKits.map((kit) => (
              <div key={kit.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xs text-slate-900">{kit.title}</h3>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                      {kit.target}
                    </span>
                  </div>

                  <button
                    onClick={() => handleCopy(kit.id, kit.text)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    {copiedId === kit.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === kit.id ? 'Copié !' : 'Copier'}</span>
                  </button>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 font-mono whitespace-pre-line leading-relaxed">
                  {kit.text}
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Banner Studio Modal */}
      {isStudioOpen && (
        <BannerGeneratorModal
          products={state.products.filter(p => p.status === 'approved')}
          reseller={reseller}
          currentUser={state.currentUser}
          isOpen={isStudioOpen}
          onClose={() => setIsStudioOpen(false)}
        />
      )}

      <BottomNav />
    </div>
  );
}
