'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import { ArrowLeft, ShieldCheck, Lock } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-16">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
        
        <Link 
          href="/" 
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l&apos;accueil</span>
        </Link>

        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Politique de Confidentialité & Données Personnelles
              </h1>
              <p className="text-xs text-slate-500">
                Conformité Loi n°2013-015 (APDP Mali) & Cadre Communautaire UEMOA
              </p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none text-xs text-slate-700 space-y-4 leading-relaxed">
            
            <section className="space-y-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                1. Données Collectées & Finalités
              </h2>
              <p>
                Suguba collecte uniquement les informations strictement nécessaires à la bonne exécution des commandes et au versement des commissions :
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Pour les Clients</strong> : Nom, numéro de téléphone, quartier de livraison et repère visuel (pour permettre l&apos;acheminement du colis).</li>
                <li><strong>Pour les Revendeurs</strong> : Nom, téléphone, numéro Mobile Money de réception des gains.</li>
                <li><strong>Pour les Fournisseurs & Livreurs</strong> : Coordonnées professionnelles, adresses d&apos;entrepôt et immatriculation des véhicules de livraison.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                2. Non-Divulgation & Sécurité des Données
              </h2>
              <p>
                Suguba s&apos;interdit formellement de vendre, louer ou céder les données personnelles de ses utilisateurs et clients à des tiers. Les numéros de téléphone des clients finaux ne sont jamais transmis aux fournisseurs afin d&apos;éviter toute sollicitation commerciale non consentie.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                3. Vos Droits d&apos;Accès, Rectification & Suppression
              </h2>
              <p>
                Conformément à la réglementation applicable au Mali, tout utilisateur peut exercer son droit d&apos;accès, de modification ou de suppression de ses données sur simple demande à l&apos;adresse <strong>contact@sugubaml.com</strong>.
              </p>
            </section>

          </div>

        </div>

      </main>

      <BottomNav />
    </div>
  );
}
