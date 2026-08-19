'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { 
  Sparkles, Video, MessageCircle, Copy, Check, 
  ArrowLeft, Users, Trophy, TrendingUp, Smartphone, Play, Share2
} from 'lucide-react';

export default function ResellerAcademyPage() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const videoScripts = [
    {
      title: 'Script 1 : Le Hook Visuel "Preuve de Retrait Wave" (TikTok / Reels)',
      target: 'Grand Public & Étudiants Bamako',
      lang: 'Français',
      content: `🎬 [PLAN 1 : Montrez votre téléphone avec une notification Wave de +25 000 FCFA reçue]
"Arrêtez de scroller ! Si vous êtes à Bamako et que vous voulez gagner entre 25 000 F et 100 000 F par semaine avec votre simple téléphone, écoutez bien ça.

🎬 [PLAN 2 : Montrez l'application Suguba avec le catalogue de produits]
Sur Suguba.ml, vous avez accès à des centaines de produits certifiés (électroménager, mode Bazin, beauté, high-tech) à prix de gros direct usine. Vous n'achetez RIEN, vous n'avez pas de stock.

🎬 [PLAN 3 : Montrez le bouton de partage WhatsApp en 1 clic]
Vous copiez les photos et le texte de vente en 1 clic, vous les postez sur votre statut WhatsApp ou TikTok. Dès qu'un client commande, les livreurs moto de Suguba livrent à domicile partout à Bamako et encaissent l'argent.

🎬 [PLAN 4 : Montrez le solde de commission]
Dès que le client donne son code secret OTP au livreur, votre commission tombe immédiatement sur votre compte Wave ou Orange Money !

👉 Cliquez sur le lien dans ma bio ou écrivez 'SUGUBA' en commentaire pour commencer gratuitement dès aujourd'hui !"`,
    },
    {
      title: 'Script 2 : Vidéo d\'Impact en Langue Locale (Bambara / Bamanankan)',
      target: 'Commerce Populaire & Marchés de Bamako',
      lang: 'Bambara',
      content: `🎬 [PLAN 1 : I ka telefone kɔnɔ kuma kɛcogo lajɛ]
"I ni ce n'i ni baara ! Yala i b'a fɛ ka wari sɔrɔ i ka telefone kan kalanso kɔnɔ walima so kɔnɔ bi wa ?

🎬 [PLAN 2 : Suguba application jirali]
Suguba Mali ye kɛrɛnkɛrɛnnenya sɔrɔ ! I tɛ foyi san, i tɛ boutique jɔ. Fenw bɛɛ bɛ yen : mixeur, fan, bazin ɲumanw.

🎬 [PLAN 3 : Statut WhatsApp kan fɛn bila]
I bɛ foto minɛ ka bila i ka WhatsApp statut kan. Ni mɔgɔ dɔ y'a fɛ, Suguba moto livreur de bɛ taa a di a ma a ka so, k'a sara minɛ.

🎬 [PLAN 4 : Wari doni Orange Money / Wave kan]
O yɔrɔnin bɛɛ, i ka commission donnen bɛ i ka Wave walima Orange Money kɔnɔ !

👉 Aw ye wari sɔrɔli daminɛ bi : aw bɛ 'SUGUBA' bila jaabi kɔnɔ !"`,
    },
    {
      title: 'Script 3 : Réponse aux objections "Est-ce que c\'est une arnaque ?"',
      target: 'Personnes méfiantes & Débutants',
      lang: 'Français',
      content: `🎬 [Face Caméra rassurante]
"Beaucoup de gens me demandent : 'Mais comment c'est possible de gagner de l'argent sans investir 1 seul franc au Mali ?'

Voici la vérité sur Suguba :
1️⃣ L'inscription est 100% GRATUITE. On ne vous demandera jamais d'argent pour commencer.
2️⃣ Vous vendez des produits réels stockés dans les entrepôts de Bamako.
3️⃣ Le client ne paye QU'À LA LIVRAISON avec un code secret de sécurité.
4️⃣ Vos commissions sont garanties et payées directement par Wave ou Orange Money.

Plus de 500 jeunes à Bamako gagnent déjà leur vie grâce à ça. Rejoignez le réseau gratuitement sur app.sugubaml.com/reseller/join !"`,
    }
  ];

  const whatsappTemplates = [
    {
      title: 'Modèle 1 : Message pour Groupes WhatsApp Étudiants / Jeunesse',
      content: `🚀 *OPPORTUNITÉ COMMERCE EN LIGNE À BAMAKO (SANS INVESTISSEMENT)* 🇲🇱

Tu as un smartphone et tu veux te faire *25 000 F à 100 000 FCFA / semaine* sans acheter de marchandise ?

✅ 0 FCFA d'investissement (Pas de stock à payer)
✅ Livraison 24h & encaissement gérés à 100% par les livreurs moto Suguba
✅ Commissions garanties payées par *Wave* et *Orange Money*

👉 Inscris-toi gratuitement en 30 secondes ici :
https://app.sugubaml.com/reseller/join

📞 Service Revendeurs : +223 89 46 00 00`,
    },
    {
      title: 'Modèle 2 : Statut WhatsApp avec Appel à l\'Action Direct',
      content: `🔥 *Je recrute 10 personnes motivées à Bamako pour vendre des produits certifiés en ligne sans stock.*

💰 Gagnez entre 3 000 F et 7 000 F de commission par article vendu.
🛵 Livraison à domicile et encaissement gérés par Suguba.

👉 Écris-moi en privé ou clique sur ce lien pour commencer : https://app.sugubaml.com/reseller/join`,
    },
    {
      title: 'Modèle 3 : Message de Parrainage (Gagnez +1 000 F par filleul)',
      content: `👋 Bonjour ! Tu cherches un complément de revenu sérieux à Bamako ?

Rejoins mon équipe sur Suguba, la 1ère plateforme de vente sans stock au Mali. On gagne de l'argent ensemble dès la 1ère vente !

🎁 Inscription gratuite via mon lien officiel :
https://app.sugubaml.com/reseller/join`,
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link 
              href="/reseller" 
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à l&apos;Espace Revendeur</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center space-x-2">
              <Sparkles className="w-6 h-6 text-amber-500" />
              <span>Académie & Kit de Recrutement Revendeurs</span>
            </h1>
            <p className="text-xs text-slate-500">
              Scripts vidéo viraux TikTok, messages de prospection WhatsApp et méthodes pour recruter 50 revendeurs à Bamako.
            </p>
          </div>

          <Link
            href="/reseller/join"
            target="_blank"
            className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs shadow-md transition-all self-start sm:self-auto active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Voir la Page d&apos;Onboarding Publique</span>
          </Link>
        </div>

        {/* Section 1 : Scripts Vidéo Viraux TikTok / Reels */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
            <Video className="w-5 h-5 text-rose-600" />
            <h2 className="font-black text-base text-slate-900">
              1. Scripts Vidéo TikTok, Reels & Facebook Ads (Prêts à Tourner)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {videoScripts.map((script, idx) => (
              <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-black">
                      {script.lang}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">{script.target}</span>
                  </div>
                  <h3 className="font-black text-xs text-slate-900 leading-snug">{script.title}</h3>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-mono text-slate-700 whitespace-pre-line leading-relaxed max-h-60 overflow-y-auto">
                    {script.content}
                  </div>
                </div>

                <button
                  onClick={() => handleCopy(script.content, idx)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Script Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copier le Script Vidéo</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2 : Messages WhatsApp & Statuts Prêts à Diffuser */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
            <MessageCircle className="w-5 h-5 text-[#25D366]" />
            <h2 className="font-black text-base text-slate-900">
              2. Messages de Prospection & Statuts WhatsApp
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {whatsappTemplates.map((template, idx) => {
              const copyId = idx + 10;
              return (
                <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-black text-xs text-slate-900 leading-snug">{template.title}</h3>
                    <div className="p-3.5 bg-emerald-50/40 border border-emerald-200 rounded-2xl text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                      {template.content}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopy(template.content, copyId)}
                    className="w-full py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-black rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-xs"
                  >
                    {copiedIndex === copyId ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Message Copié !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copier pour WhatsApp</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3 : Plan d'Action 7 Jours pour Recruter 50 Revendeurs */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="space-y-1">
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-black text-[10px] rounded-full uppercase tracking-wider border border-emerald-500/30">
              Stratégie Terrain Bamako
            </span>
            <h2 className="text-lg sm:text-xl font-black">
              Plan d&apos;Action 7 Jours pour vos 50 Premiers Revendeurs
            </h2>
            <p className="text-xs text-slate-300">
              Méthodologie simple et éprouvée pour constituer une armée de vente active à Bamako.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-white/10 rounded-2xl border border-white/10 space-y-2">
              <span className="font-black text-amber-400 block text-sm">Jour 1 & 2 : Les Cercles Proches</span>
              <p className="text-slate-300 leading-relaxed">
                Diffusez le message WhatsApp sur vos propres statuts et dans 5 groupes d&apos;amis / étudiants. Objectif : <strong>10 premiers inscrits</strong>.
              </p>
            </div>

            <div className="p-4 bg-white/10 rounded-2xl border border-white/10 space-y-2">
              <span className="font-black text-amber-400 block text-sm">Jour 3 & 4 : Vidéos TikTok & Facebook</span>
              <p className="text-slate-300 leading-relaxed">
                Tournez les 2 scripts vidéo (Preuve de gain + Démonstration catalogue). Postez 2 vidéos/jour avec le hashtag #Bamako #Mali. Objectif : <strong>25 inscrits</strong>.
              </p>
            </div>

            <div className="p-4 bg-white/10 rounded-2xl border border-white/10 space-y-2">
              <span className="font-black text-amber-400 block text-sm">Jour 5 à 7 : Activation & 1ère Vente</span>
              <p className="text-slate-300 leading-relaxed">
                Intégrez les 50 inscrits dans un Groupe WhatsApp VIP Suguba. Envoyez-leur le produit phare du jour avec son texte prêt à copier. Objectif : <strong>Premières commandes livrées !</strong>
              </p>
            </div>
          </div>
        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
