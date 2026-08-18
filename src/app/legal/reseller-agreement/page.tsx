'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import { ArrowLeft, Shield, FileText, CheckCircle2, Award } from 'lucide-react';

export default function ResellerAgreementPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-16">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
        
        <Link 
          href="/reseller" 
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l&apos;espace revendeur</span>
        </Link>

        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Contrat-Cadre d&apos;Apporteur d&apos;Affaires Revendeur
              </h1>
              <p className="text-xs text-slate-500">
                Conditions contractuelles de rémunération et d&apos;indépendance commerciale
              </p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none text-xs text-slate-700 space-y-4 leading-relaxed">
            
            <section className="space-y-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                1. Statut Juridique d&apos;Indépendance
              </h2>
              <p>
                Le revendeur agit en qualité de <strong>prestataire indépendant / apporteur d&apos;affaires</strong>. L&apos;adhésion au programme Suguba ne crée aucun lien de subordination, contrat de travail ou société de fait entre Suguba et le revendeur.
              </p>
              <p>
                Le revendeur organise librement son activité, ses horaires et ses canaux de prospection (WhatsApp, Facebook, TikTok, bouche-à-oreille).
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                2. Calcul & Conditions d&apos;Exigibilité des Commissions
              </h2>
              <p>
                La commission revendeur est un <strong>montant fixe en FCFA par produit vendu</strong>, fixé unilatéralement par Suguba et affiché en toute transparence sur le catalogue revendeur.
              </p>
              <p>
                La commission devient acquise uniquement lorsque :
              </p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Le colis a été physiquement remis au client final.</li>
                <li>Le paiement a été intégralement encaissé par le livreur.</li>
                <li>La livraison a été certifiée par la saisie du <strong>Code OTP client</strong>.</li>
                <li>Le <strong>délai de sécurité de rétention</strong> s&apos;est écoulé sans contestation, retour ni fraude.</li>
              </ol>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                3. Barème des Délais de Sécurité (Réputation)
              </h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Nouveau Revendeur (0 à 9 ventes)</strong> : Délai de sécurité de <strong>14 jours (D+14)</strong>.</li>
                <li><strong>Revendeur Vérifié (10 à 29 ventes)</strong> : Délai de sécurité de <strong>7 jours (D+7)</strong>.</li>
                <li><strong>Revendeur VIP (+30 ventes)</strong> : Délai de sécurité de <strong>3 jours (D+3)</strong>.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                4. Retraits Mobile Money
              </h2>
              <p>
                Les demandes de retrait sont possibles dès <strong>5 000 FCFA</strong> de solde disponible. Elles sont traitées vers les comptes Mobile Money déclarés (Orange Money, Wave, Moov) sous 24 à 48 heures ouvrées.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                5. Règles Déontologiques & Interdiction de Fraude
              </h2>
              <p>
                Le revendeur s&apos;engage à ne pas créer de fausses commandes, ne pas démarcher directement les fournisseurs pour court-circuiter Suguba et ne pas faire de publicité mensongère sur les caractéristiques ou prix des produits. Tout manquement entraîne la suspension immédiate du compte et le gel des commissions illégitimes.
              </p>
            </section>

          </div>

        </div>

      </main>

      <BottomNav />
    </div>
  );
}
