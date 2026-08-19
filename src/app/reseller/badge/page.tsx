'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore } from '@/lib/store';
import { 
  ShieldCheck, QrCode, ArrowLeft, Download, Printer, 
  Share2, Sparkles, Award, CheckCircle2, User, Phone, MapPin, Copy, Check
} from 'lucide-react';

export default function ResellerBadgePage() {
  const state = useSugubaStore();
  const currentUser = state.currentUser;
  const reseller = state.resellers.find(r => r.userId === currentUser.id) || state.resellers[0];

  const [copiedCode, setCopiedCode] = useState(false);

  const personalCatalogUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/reseller/join?ref=${reseller.referralCode}`
    : `https://app.sugubaml.com/reseller/join?ref=${reseller.referralCode}`;

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(reseller.referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Dynamic QR Code URL using quickchart.io for high-res instant scanning
  const qrCodeImageUrl = `https://quickchart.io/qr?text=${encodeURIComponent(personalCatalogUrl)}&size=200&dark=064e3b&light=ffffff&margin=1`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 pb-20 md:pb-10 print:bg-white print:p-0 print:pb-0">
      <div className="print:hidden">
        <Header />
      </div>

      <main className="flex-1 max-w-xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Top Control Bar (Hidden on Print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <Link 
            href="/reseller" 
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 shadow-xs self-start"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à l&apos;Espace Revendeur</span>
          </Link>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl text-xs flex items-center space-x-1.5 transition-all shadow-xs active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer mon Badge</span>
            </button>

            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                `🪪 *CARTE OFFICIELLE REVENDEUR AGRÉÉ SUGUBA MALI*\n\nNom : ${currentUser.fullName}\nCode Partenaire : ${reseller.referralCode}\n\nScannez mon QR Code ou commandez via mon lien officiel :\n${personalCatalogUrl}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-2xl text-xs flex items-center space-x-1.5 transition-all shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Partager</span>
            </a>
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-1 print:hidden">
          <h1 className="text-xl font-black text-slate-900 flex items-center justify-center space-x-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span>Votre Carte Professionnelle Digitale Suguba</span>
          </h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Présentez cette carte à vos clients et commerçants à Bamako pour prouver votre statut officiel.
          </p>
        </div>

        {/* THE OFFICIAL DIGITAL BADGE CARD */}
        <div className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border-2 border-emerald-500/30 overflow-hidden space-y-6 print:border-slate-800 print:shadow-none">
          
          {/* Top Header of the Badge */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center font-black text-xl text-white shadow-md border border-white/20">
                S
              </div>
              <div>
                <span className="text-sm font-black tracking-tight text-white flex items-center">
                  SUGUBA<span className="text-emerald-400">.ML</span>
                </span>
                <span className="text-[9px] block font-bold text-emerald-300 uppercase tracking-widest -mt-0.5">
                  Réseau Officiel Mali 🇲🇱
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                Revendeur Agréé
              </span>
            </div>
          </div>

          {/* Body with Profile & QR Code */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
            
            {/* Left: Reseller Identity */}
            <div className="space-y-3 text-center sm:text-left flex-1">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Titulaire de la Carte</span>
                <h2 className="text-xl font-black text-white">{currentUser.fullName}</h2>
                <p className="text-xs text-emerald-300 font-medium flex items-center justify-center sm:justify-start space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Secteur : Hamdallaye ACI 2000 (Bamako)</span>
                </p>
              </div>

              <div className="p-3 bg-white/10 rounded-2xl border border-white/10 space-y-1 inline-block sm:block text-xs">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Code Affilié Unique</span>
                <div className="flex items-center space-x-2">
                  <strong className="text-amber-400 font-mono text-base font-black tracking-wider">
                    {reseller.referralCode}
                  </strong>
                  <button
                    onClick={handleCopyCode}
                    className="p-1 hover:bg-white/20 rounded-lg text-slate-300"
                    title="Copier le code"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: The Dynamic QR Code Box */}
            <div className="bg-white p-3 rounded-2xl shadow-lg text-center space-y-1.5 shrink-0">
              <div className="relative w-32 h-32 mx-auto rounded-xl overflow-hidden bg-white">
                <Image
                  src={qrCodeImageUrl}
                  alt={`QR Code ${reseller.referralCode}`}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
              <span className="text-[9px] font-black text-slate-900 uppercase block tracking-wider">
                Scanner pour Commander
              </span>
            </div>

          </div>

          {/* Footer Security Hologram */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Certifié par Suguba Technologies Mali SAS</span>
            </div>
            <span className="font-mono text-emerald-300 font-bold">ID: ML-BKO-2026</span>
          </div>

        </div>

        {/* Instructions Box */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3 text-xs print:hidden">
          <h3 className="font-black text-sm text-slate-900 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Comment utiliser votre Carte sur le Terrain à Bamako ?</span>
          </h3>

          <ul className="space-y-2 text-slate-600">
            <li className="flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Faites scanner le QR Code</strong> par vos clients avec leur téléphone : la boutique s&apos;ouvre avec votre commission enregistrée !</span>
            </li>
            <li className="flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Mettez votre badge en photo de profil WhatsApp</strong> pour inspirer confiance auprès de vos contacts.</span>
            </li>
            <li className="flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Imprimez-le en format badge plastique</strong> pour démarcher les bureaux et commerces de Bamako.</span>
            </li>
          </ul>
        </div>

      </main>

      <div className="print:hidden">
        <Footer />
        <BottomNav />
      </div>
    </div>
  );
}
