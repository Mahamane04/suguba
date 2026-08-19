'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore } from '@/lib/store';
import { 
  Radio, Send, MessageCircle, Smartphone, Users, 
  ArrowLeft, Sparkles, CheckCircle2, Copy, Check, Clock, Flame, Trophy, Bell
} from 'lucide-react';

export default function AdminBroadcastPage() {
  const state = useSugubaStore();

  const [targetGroup, setTargetGroup] = useState<'resellers' | 'drivers' | 'suppliers'>('resellers');
  const [selectedChannel, setSelectedChannel] = useState<'whatsapp' | 'sms' | 'push'>('whatsapp');
  const [messageText, setMessageText] = useState<string>(
    `🔥 *ARRIVAGE DE NOUVEAU STOCK FLASH — SUGUBA MALI !* 🇲🇱\n\n` +
    `📦 *200 Ventilateurs Solaires Rechargeables 16"* viennent d'arriver à l'entrepôt ACI 2000 !\n\n` +
    `💰 *Commission Spéciale : 5 000 FCFA / vente* (au lieu de 3 500 F) pour les 48 prochaines heures !\n` +
    `🛵 Livraisons 24h garanties à Bamako.\n\n` +
    `👉 *Téléchargez vos visuels et partagez sur vos statuts :*\n` +
    `https://app.sugubaml.com/reseller/catalog`
  );
  const [sentSuccess, setSentSuccess] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const presets = [
    {
      title: '🔥 Arrivage Nouveau Stock Flash',
      target: 'resellers',
      content: `🔥 *ARRIVAGE DE NOUVEAU STOCK FLASH — SUGUBA MALI !* 🇲🇱\n\n📦 *200 Ventilateurs Solaires Rechargeables 16"* viennent d'arriver à l'entrepôt ACI 2000 !\n\n💰 *Commission Spéciale : 5 000 FCFA / vente* pour les 48h !\n\n👉 *Téléchargez vos visuels :* https://app.sugubaml.com/reseller/catalog`,
    },
    {
      title: '🏆 Défi Flash Weekend (+15 000 F)',
      target: 'resellers',
      content: `🏆 *DÉFI FLASH DU WEEKEND SUGUBA !* 🚀\n\nLes 10 premiers revendeurs qui réalisent 3 ventes d'ici dimanche soir reçoivent une *Prime Exceptionnelle de +15 000 FCFA* sur leur compte Wave !\n\nÀ vos statuts WhatsApp ! 🔥\nhttps://app.sugubaml.com/reseller`,
    },
    {
      title: '🛵 Alerte Dispatch & Primes Courses Livreurs',
      target: 'drivers',
      content: `🛵 *ALERTE LIVREURS SUGUBA — FORTE DEMANDE SUR ACI 2000 & BADALA !*\n\n+500 FCFA de prime carburant supplémentaire par course livrée avant 18h aujourd'hui avec code OTP validé.\n\n👉 Ouvrez votre feuille de route : https://app.sugubaml.com/driver`,
    },
    {
      title: '💳 Notification Virements Wave / Orange Envoyés',
      target: 'resellers',
      content: `🎉 *CLÔTURE DES RETRAITS DU JOUR EFFECTUÉE !*\n\nToutes les demandes de paiement de commissions ont été virées avec succès sur vos comptes Wave et Orange Money.\n\nConsultez votre historique : https://app.sugubaml.com/reseller/payouts`,
    }
  ];

  const handleApplyPreset = (preset: typeof presets[0]) => {
    setMessageText(preset.content);
    setTargetGroup(preset.target as any);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    setSentSuccess(true);
    setTimeout(() => setSentSuccess(false), 4000);
  };

  const audienceCounts = {
    resellers: 142,
    drivers: 18,
    suppliers: 12,
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link 
              href="/admin" 
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à l&apos;Espace Admin Ops</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center space-x-2">
              <Radio className="w-6 h-6 text-indigo-600 animate-pulse" />
              <span>Console de Diffusion & Alertes en Masse (Broadcast)</span>
            </h1>
            <p className="text-xs text-slate-500">
              Diffusez des alertes de stock, défis et notifications WhatsApp / SMS à tout votre réseau à Bamako.
            </p>
          </div>

          <div className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl text-xs font-bold flex items-center space-x-2 self-start sm:self-auto">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Audience Totale : 172 Utilisateurs Actifs</span>
          </div>
        </div>

        {/* Quick Presets Carousel */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Modèles de Messages Rapides Prêts à l&apos;Emploi :
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {presets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handleApplyPreset(preset)}
                className="p-3 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-2xl text-left transition-all shadow-2xs group"
              >
                <strong className="block text-xs font-black text-slate-900 group-hover:text-indigo-950 truncate">
                  {preset.title}
                </strong>
                <span className="text-[10px] text-slate-500 block capitalize">
                  Cible : {preset.target === 'resellers' ? 'Revendeurs (142)' : 'Livreurs (18)'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Compose & Preview Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: Compose Form (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
            
            {/* Target Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                1. Sélectionner l&apos;Audience Cible :
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetGroup('resellers')}
                  className={`p-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center space-y-1 ${
                    targetGroup === 'resellers'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>📲 Revendeurs</span>
                  <span className="text-[10px] opacity-80">142 inscrits</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetGroup('drivers')}
                  className={`p-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center space-y-1 ${
                    targetGroup === 'drivers'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>🛵 Livreurs Moto</span>
                  <span className="text-[10px] opacity-80">18 coursiers</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetGroup('suppliers')}
                  className={`p-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center space-y-1 ${
                    targetGroup === 'suppliers'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>🏬 Grossistes</span>
                  <span className="text-[10px] opacity-80">12 partenaires</span>
                </button>
              </div>
            </div>

            {/* Channel Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                2. Canal de Diffusion :
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChannel('whatsapp')}
                  className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                    selectedChannel === 'whatsapp'
                      ? 'bg-[#25D366] text-white shadow-xs'
                      : 'bg-slate-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp VIP</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChannel('sms')}
                  className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                    selectedChannel === 'sms'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>SMS Flash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChannel('push')}
                  className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                    selectedChannel === 'push'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Push Web</span>
                </button>
              </div>
            </div>

            {/* Message Area */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold text-slate-700">3. Contenu du Message :</label>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center space-x-1"
                >
                  {copiedText ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedText ? 'Copié !' : 'Copier texte'}</span>
                </button>
              </div>

              <textarea
                rows={7}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono leading-relaxed"
                placeholder="Rédigez votre message de diffusion..."
              />
            </div>

            {/* Actions */}
            {sentSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <strong className="block text-xs font-black text-emerald-950">
                  Diffusion Réussie avec Succès !
                </strong>
                <p className="text-[11px] text-emerald-700">
                  Message envoyé à {audienceCounts[targetGroup]} destinataires via le canal {selectedChannel.toUpperCase()}.
                </p>
              </div>
            ) : (
              <div className="flex items-center space-x-2 pt-2">
                <button
                  onClick={handleSendBroadcast}
                  className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30 transition-transform active:scale-98"
                >
                  <Send className="w-4 h-4" />
                  <span>Diffuser aux {audienceCounts[targetGroup]} {targetGroup.toUpperCase()}</span>
                </button>

                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-2xl transition-colors"
                  title="Ouvrir dans WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              </div>
            )}

          </div>

          {/* Right: Real-Time Smartphone Mockup (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Aperçu en Direct sur Smartphone :
            </span>

            <div className="w-full max-w-xs mx-auto bg-slate-900 rounded-[2.5rem] p-3.5 shadow-2xl border-4 border-slate-800 space-y-3">
              {/* Speaker / Dynamic Island */}
              <div className="w-24 h-4 bg-black rounded-full mx-auto"></div>

              {/* Screen Content */}
              <div className="bg-[#EFEAE2] rounded-3xl p-4 min-h-[380px] flex flex-col justify-between space-y-3">
                {/* Chat Top Bar */}
                <div className="flex items-center space-x-2 bg-white/90 backdrop-blur-xs p-2 rounded-2xl shadow-2xs">
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                    S
                  </div>
                  <div>
                    <strong className="block text-[11px] font-bold text-slate-900 leading-tight">
                      Suguba Mali Official 🇲🇱
                    </strong>
                    <span className="text-[9px] text-emerald-600 font-semibold">Canal de Diffusion VIP</span>
                  </div>
                </div>

                {/* Message Bubble */}
                <div className="bg-white p-3.5 rounded-2xl rounded-tl-xs shadow-xs text-xs text-slate-900 space-y-2 whitespace-pre-line leading-relaxed border border-slate-100 font-sans">
                  {messageText}
                  <div className="text-[9px] text-slate-400 text-right font-medium">
                    12:30 • Envoyé par Suguba Ops
                  </div>
                </div>

                {/* Quick Reply Bar */}
                <div className="bg-white/80 backdrop-blur-xs p-2 rounded-xl text-[10px] text-slate-400 text-center">
                  📱 Réception instantanée sur smartphone
                </div>
              </div>
            </div>
          </div>

        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
