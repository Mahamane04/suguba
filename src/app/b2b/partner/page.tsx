'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { 
  Building2, Users, Truck, ShieldCheck, Printer, 
  Share2, ArrowRight, CheckCircle2, Phone, Mail, MapPin, Sparkles, DollarSign
} from 'lucide-react';

export default function B2BPartnerPitchPage() {
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 pb-20 md:pb-10 print:bg-white print:p-0 print:pb-0">
      <div className="print:hidden">
        <Header />
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
        
        {/* Top Control Bar (Hidden on Print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center space-x-2">
              <Building2 className="w-6 h-6 text-emerald-600" />
              <span>Dossier de Partenariat Commercial B2B</span>
            </h1>
            <p className="text-xs text-slate-500">
              Document officiel de présentation pour directeurs généraux, grossistes et enseignes de Bamako.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl text-xs flex items-center space-x-2 transition-all shadow-md active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer en A4 / Exporter PDF</span>
            </button>

            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                `🏢 *SUGUBA MALI — DOSSIER DE PARTENARIAT GRANDES ENSEIGNES & GROSSISTES*\n\nAccédez à une force de vente de +500 revendeurs à Bamako sans recruter de commerciaux supplémentaires !\n\nConsultez le dossier officiel ici :\nhttps://app.sugubaml.com/b2b/partner`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-2xl text-xs flex items-center space-x-2 transition-all shadow-xs"
            >
              <Share2 className="w-4 h-4" />
              <span>Envoyer sur WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Printable A4 Executive Document */}
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-xl space-y-8 print:border-none print:shadow-none print:p-0 print:rounded-none">
          
          {/* Header with Official Corporate Info */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-6 gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-lg">
                  S
                </div>
                <span className="text-2xl font-black tracking-tight text-slate-900">
                  SUGUBA<span className="text-emerald-600">.ML</span>
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Plateforme B2B2C de Distribution & Social Commerce au Mali
              </p>
            </div>

            <div className="text-right text-[11px] text-slate-600 space-y-0.5 sm:max-w-xs">
              <p className="font-bold text-slate-900">SUGUBA MALI SAS</p>
              <p>Hamdallaye ACI 2000, Rue 314, Porte 88, Bamako</p>
              <p>NIF : <strong>086419208K</strong> • RCCM : <strong>MA.BKO.2026.B.14820</strong></p>
              <p>Service Entreprises : <strong>+223 89 46 00 00</strong></p>
            </div>
          </div>

          {/* Headline Proposition */}
          <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200 space-y-2">
            <span className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-black rounded-full uppercase tracking-wider">
              Offre Partenaire Distribution Exclusive
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-emerald-950">
              Multipliez vos ventes au Mali grâce à une force de vente de +500 revendeurs digitaux, sans recruter un seul salarié supplémentaire.
            </h2>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Suguba connecte votre stock de marchandises à une armée de micro-vendeurs formés à Bamako, tout en assurant l&apos;intégralité de la logistique du dernier kilomètre et de l&apos;encaissement sécurisé.
            </p>
          </div>

          {/* The 4 Pillars for Enterprise Brands */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center space-x-2 text-slate-900 font-black text-sm">
                <Users className="w-5 h-5 text-emerald-600" />
                <span>1. Force de Vente Dédiée</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Vos produits sont mis en avant dans votre propre <strong>Canal de Marque</strong> partagé quotidiennement par des centaines de jeunes sur WhatsApp, TikTok et Instagram.
              </p>
            </div>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center space-x-2 text-slate-900 font-black text-sm">
                <Truck className="w-5 h-5 text-blue-600" />
                <span>2. Logistique 24h & Flotte Moto</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Nos coursiers moto professionnels récupèrent les colis à votre entrepôt et livrent directement les clients finaux dans tous les quartiers de Bamako sous 24h.
              </p>
            </div>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center space-x-2 text-slate-900 font-black text-sm">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                <span>3. Sécurité Anti-Fraude par Code OTP</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Aucun colis n&apos;est remis sans validation du <strong>Code Secret OTP</strong> du client. L&apos;argent liquide ou Mobile Money (Wave / Orange Money) est encaissé avec une traçabilité à 100%.
              </p>
            </div>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center space-x-2 text-slate-900 font-black text-sm">
                <DollarSign className="w-5 h-5 text-amber-600" />
                <span>4. Reversement Garanti & Zéro Frais Fixes</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Zéro abonnement mensuel. Vous fixez votre prix de gros net garanti. Votre chiffre d&apos;affaires est reversé par virement bancaire (BDM-SA) ou Mobile Money selon votre calendrier.
              </p>
            </div>

          </div>

          {/* Process Timeline */}
          <div className="space-y-4 pt-2">
            <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider">
              Déploiement de Votre Canal en 3 Étapes Simples (24h Chrono)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-1">
                <span className="font-black text-amber-400 block">Étape 1 : Référencement</span>
                <p className="text-slate-300">
                  Dépôt de vos fiches produits, prix de gros et stocks disponibles dans votre console Suguba Business.
                </p>
              </div>

              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-1">
                <span className="font-black text-emerald-400 block">Étape 2 : Mobilisation</span>
                <p className="text-slate-300">
                  Votre canal est ouvert aux revendeurs avec les affiches marketing générées par le Studio Suguba.
                </p>
              </div>

              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-1">
                <span className="font-black text-blue-400 block">Étape 3 : Ventes & Reversements</span>
                <p className="text-slate-300">
                  Les commandes affluent, Suguba livre et vous encaissez votre chiffre d&apos;affaires sans vous déplacer.
                </p>
              </div>
            </div>
          </div>

          {/* Signatures & Contact Footer */}
          <div className="pt-6 border-t-2 border-slate-900 flex flex-col sm:flex-row justify-between items-end gap-6 text-xs">
            <div className="space-y-1 text-slate-600">
              <p className="font-bold text-slate-900">Contact Direction des Partenariats :</p>
              <p>📞 Téléphone / WhatsApp : <strong>+223 89 46 00 00</strong></p>
              <p>✉️ Email : <strong>partenaires@sugubaml.com</strong></p>
              <p>🌐 Portail Entreprise : <strong>https://app.sugubaml.com/business/dashboard</strong></p>
            </div>

            <div className="text-center border border-slate-300 rounded-2xl p-4 w-48 space-y-4">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Cachet & Signature Suguba</p>
              <div className="text-emerald-800 font-serif italic text-sm font-black py-2">
                Direction Générale<br />Suguba Mali SAS
              </div>
            </div>
          </div>

        </div>

      </main>

      <div className="print:hidden">
        <Footer />
        <BottomNav />
      </div>
    </div>
  );
}
