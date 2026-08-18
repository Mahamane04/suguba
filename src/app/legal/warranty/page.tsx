'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import { ArrowLeft, ShieldCheck, RefreshCw, CheckCircle } from 'lucide-react';

export default function WarrantyPage() {
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
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Garantie, SAV & Politique de Retour
              </h1>
              <p className="text-xs text-slate-500">
                Règles de prise en charge des pannes, retours et échanges à Bamako
              </p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none text-xs text-slate-700 space-y-4 leading-relaxed">
            
            <section className="space-y-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                1. Vérification à la Réception
              </h2>
              <p>
                Le client a le droit d&apos;inspecter visuellement l&apos;état extérieur du produit en présence du livreur avant de lui communiquer son <strong>Code Secret OTP</strong>.
              </p>
              <p>
                Si le produit est non-conforme, endommagé ou défectueux à l&apos;arrivée, le client refuse le colis. Aucun montant n&apos;est prélevé et la commande est annulée sans frais.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                2. Durée de Garantie Fournisseur
              </h2>
              <p>
                Chaque fiche produit précise la durée de garantie contractuelle (ex: 6 mois ou 12 mois pour l&apos;électronique et l&apos;énergie solaire).
              </p>
              <p>
                La garantie couvre les vices de fabrication et pannes matérielles survenues dans des conditions normales d&apos;utilisation. Elle ne couvre pas la casse physique, l&apos;immersion dans l&apos;eau ou les dommages causés par des surtensions électriques externes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                3. Procédure de SAV (Service Après-Vente)
              </h2>
              <p>
                En cas de dysfonctionnement pendant la période de garantie :
              </p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Le client contacte l&apos;assistance Suguba (+223 70 00 00 01) en précisant son numéro de commande.</li>
                <li>Suguba organise le diagnostic et la liaison avec l&apos;atelier technique du fournisseur agréé.</li>
                <li>Le produit est réparé ou remplacé par un produit neuf sous 72 heures ouvrées.</li>
              </ol>
            </section>

          </div>

        </div>

      </main>

      <BottomNav />
    </div>
  );
}
