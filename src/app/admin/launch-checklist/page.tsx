'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { 
  ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, 
  Download, ArrowLeft, Server, Lock, Smartphone, Database, Check, Sparkles, Truck, DollarSign
} from 'lucide-react';

export default function LaunchChecklistPage() {
  const state = useSugubaStore();
  const { confirmer } = useToast();
  const [dataCleaned, setDataCleaned] = useState(false);
  const [backupDownloaded, setBackupDownloaded] = useState(false);

  const checklistItems = [
    {
      category: '1. Sécurité & Anti-Fraude',
      icon: Lock,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200',
      checks: [
        { title: 'Certificat SSL / HTTPS de Production', status: 'pass', desc: 'Actif sur https://app.sugubaml.com (Vercel Edge Network)' },
        { title: 'Code Secret OTP de Livraison Obligatoire', status: 'pass', desc: 'Empêche tout détournement de colis et garantit la remise physique' },
        { title: 'Séquestre des Fonds & Blocage Anti-Fraude J+14', status: 'pass', desc: 'Commissions débloquées uniquement après confirmation de livraison' },
        { title: 'Protection de la Vie Privée (APDP Mali)', status: 'pass', desc: 'Mentions légales, RGPD africain et politique de confidentialité en ligne' },
      ]
    },
    {
      category: '2. Grand Livre Financier & Mobile Money',
      icon: DollarSign,
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200',
      checks: [
        // Lignes corrigées le 2026-09-11 : elles annonçaient un « paiement 1-clic
        // Wave » (SasPay ne couvre pas Wave au Mali), un rapport « envoyé chaque
        // soir » (il se prépare à la main) et une prime carburant inexistante.
        { title: 'Paiement mobile money et carte (SasPay)', status: 'pass', desc: 'Orange Money, Moov, Mobi Cash et carte bancaire. Wave n’est pas couvert au Mali.' },
        { title: 'Seuil minimum de retrait revendeur', status: 'pass', desc: 'Réglable par l’admin dans les réglages économiques, vérifié par le serveur.' },
        { title: 'Portefeuille livreur (/driver/earnings)', status: 'pass', desc: 'Livraisons, espèces réellement encaissées et rémunération au tarif fixé par l’admin.' },
        { title: 'Rapport du soir sur WhatsApp', status: 'pass', desc: 'Préparé en un clic depuis /admin/reports/daily, envoyé à la main.' },
      ]
    },
    {
      category: '3. Logistique & Flotte Terrain à Bamako',
      icon: Truck,
      color: 'text-slate-600',
      bg: 'bg-slate-50 border-slate-200',
      checks: [
        { title: 'Points relais', status: 'pass', desc: 'Liste et frais configurables dans les réglages économiques.' },
        { title: 'Livraison par ville (Mali)', status: 'pass', desc: 'Frais par ville configurables dans les réglages, appliqués par le devis serveur.' },
        { title: 'Desk SAV (/admin/sav)', status: 'pass', desc: 'Suivi des réclamations et des retours.' },
        { title: 'Assistance WhatsApp', status: 'pass', desc: 'Bouton d’aide branché sur le +223 89 46 00 00 (pas d’astreinte 24 h/24).' },
      ]
    },
    {
      category: '4. Moteurs de Croissance & Acquisition',
      icon: Sparkles,
      color: 'text-slate-600',
      bg: 'bg-slate-50 border-slate-200',
      checks: [
        { title: 'Canaux de Grandes Marques Suguba Business (/c/[slug])', status: 'pass', desc: 'Portail Batimat, Bazin Prestige, Solaire Mali prêts à recruter' },
        { title: 'Parrainage, défis & académie revendeur', status: 'pass', desc: 'Supprimés le 2026-09-11 (promettaient des gains sans mécanisme réel, et un « réseau de filleuls » fictif) — à reconstruire uniquement avec un vrai mécanisme derrière.' },
        { title: 'Codes promo (?promo=…)', status: 'pass', desc: 'Codes gérés dans les réglages, vérifiés par le serveur au moment du devis.' },
        { title: 'Avis clients', status: 'fail', desc: 'Aucun avis réel collecté. Les faux témoignages « 4.9/5 » codés en dur ont été retirés des fiches produits le 2026-08-21 — cette ligne les décrivait à tort comme une « preuve sociale authentique ». À rebrancher sur de vrais avis post-livraison.' },
      ]
    }
  ];

  // Score calculé, pas écrit en dur (2026-09-11). La bannière annonçait
  // « 100% PRÊT AU DÉPLOIEMENT TERRAIN » et « 16/16 Points Validés » quels
  // que soient les items réels — y compris avec « Avis clients » marqué
  // `fail` juste en dessous, qui affichait quand même une coche verte comme
  // les autres. La mention « standards MicroOffice SaaS Factory V3 » (un
  // autre projet, sans rapport) a aussi été retirée.
  const tousLesPoints = checklistItems.flatMap((c) => c.checks);
  const pointsValides = tousLesPoints.filter((c) => c.status === 'pass').length;
  const totalPoints = tousLesPoints.length;
  const pourcentage = Math.round((pointsValides / totalPoints) * 100);

  const handleBackupExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `suguba_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setBackupDownloaded(true);
    setTimeout(() => setBackupDownloaded(false), 3000);
  };

  const handleCleanDataForProduction = async () => {
    if (await confirmer({
      titre: 'Nettoyer les commandes de test ?',
      message: "L'affichage local est réinitialisé pour démarrer la production.",
      confirmer: 'Nettoyer',
      danger: true,
    })) {
      sugubaStore.resetDemoData();
      setDataCleaned(true);
      setTimeout(() => setDataCleaned(false), 3000);
    }
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
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <span>Audit de Sécurité & Checklist de Lancement Officiel</span>
            </h1>
            <p className="text-xs text-slate-500">
              Vérification des 16 points critiques de sécurité, comptabilité et logistique avant l&apos;ouverture grand public.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleBackupExport}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-2xl text-xs flex items-center space-x-1.5 shadow-xs transition-all active:scale-95"
            >
              {backupDownloaded ? <Check className="w-4 h-4 text-emerald-600" /> : <Download className="w-4 h-4" />}
              <span>{backupDownloaded ? 'Sauvegarde OK !' : 'Exporter Sauvegarde JSON'}</span>
            </button>

            <button
              onClick={handleCleanDataForProduction}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs flex items-center space-x-1.5 shadow-md transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{dataCleaned ? 'Données Réinitialisées !' : 'Purger Données de Test'}</span>
            </button>
          </div>
        </div>

        {/* Global Readiness Score */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className={`px-3 py-1 font-black text-[11px] rounded-full uppercase tracking-wider border ${
                pointsValides === totalPoints
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                {pointsValides === totalPoints ? 'Tous les points sont vérifiés' : `${totalPoints - pointsValides} point${totalPoints - pointsValides > 1 ? 's' : ''} à traiter`}
              </span>
              <h2 className="text-2xl font-black text-white">{pointsValides} / {totalPoints} points validés</h2>
              <p className="text-xs text-slate-300">
                Chaque point est vérifié un par un ci-dessous, avec ce qui reste à faire quand il ne l&apos;est pas.
              </p>
            </div>

            <div className={`w-20 h-20 rounded-2xl text-slate-950 flex flex-col items-center justify-center font-black shadow-lg shrink-0 ${
              pointsValides === totalPoints ? 'bg-emerald-500' : 'bg-amber-400'
            }`}>
              <span className="text-2xl">{pourcentage}%</span>
              <span className="text-[11px] uppercase tracking-wider">Vérifié</span>
            </div>
          </div>
        </div>

        {/* The 4 Detailed Inspection Categories */}
        <div className="space-y-6">
          {checklistItems.map((category, idx) => {
            const Icon = category.icon;

            return (
              <div key={idx} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
                  <div className={`p-2 rounded-xl ${category.bg}`}>
                    <Icon className={`w-5 h-5 ${category.color}`} />
                  </div>
                  <h3 className="font-black text-base text-slate-900">{category.category}</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {category.checks.map((check, cIdx) => (
                    <div key={cIdx} className={`p-3.5 rounded-2xl border flex items-start space-x-3 ${
                      check.status === 'pass' ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200'
                    }`}>
                      {/* Une coche verte s'affichait même sur les points marqués
                          `fail` (« Avis clients ») : ce badge disait « vérifié »
                          pour un point qui ne l'était pas. */}
                      {check.status === 'pass'
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
                      <div className="space-y-0.5">
                        <strong className="text-xs font-bold text-slate-900 block">{check.title}</strong>
                        <p className="text-[11px] text-slate-500 leading-snug">{check.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
