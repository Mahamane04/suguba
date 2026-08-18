'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import { ArrowLeft, Shield, FileText, Scale } from 'lucide-react';

export default function TermsPage() {
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
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Conditions Générales d&apos;Utilisation & de Vente
              </h1>
              <p className="text-xs text-slate-500">
                Plateforme Suguba — République du Mali & Espace UEMOA / OHADA
              </p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none text-xs text-slate-700 space-y-4 leading-relaxed">
            
            <section className="space-y-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                1. Objet & Rôle de la Plateforme Suguba
              </h2>
              <p>
                La plateforme <strong>Suguba</strong> (accessible sur sugubaml.com) est un service technologique et commercial intermédiaire reliant des grossistes/fournisseurs, des revendeurs indépendants et des acheteurs finaux au Mali.
              </p>
              <p>
                Suguba assure la centralisation du catalogue, la fixation des prix publics et marges, la confirmation téléphonique des commandes, l&apos;attribution logistique des courses et la gestion du registre comptable des commissions.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                2. Commandes & Validation par Code OTP
              </h2>
              <p>
                Toute commande passée sur Suguba est soumise à une double validation :
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Un appel téléphonique préalable de confirmation par l&apos;équipe Suguba Ops.</li>
                <li>Une preuve de remise physique par <strong>Code OTP secret à 4 chiffres</strong> remis par le client au livreur lors de la réception du colis.</li>
              </ul>
              <p>
                La communication du code OTP par le client au livreur vaut acceptation définitive de la conformité du colis et déclenche le paiement.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                3. Prix, Devises et Modalités de Règlement
              </h2>
              <p>
                Tous les prix sont libellés en <strong>Francs CFA (FCFA / XOF)</strong> toutes taxes comprises. Les règlements s&apos;effectuent à la livraison en espèces ou par Mobile Money (Orange Money, Wave, Moov Money).
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                4. Droit Applicable & Règlement des Différends
              </h2>
              <p>
                Les présentes conditions sont régies par le droit en vigueur en République du Mali, les Actes Uniformes de l&apos;OHADA et les directives de l&apos;UEMOA. Tout litige non résolu à l&apos;amiable sera porté devant le Tribunal de Commerce de Bamako.
              </p>
            </section>

          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2 text-[11px] font-bold text-emerald-700">
            <Link href="/legal/reseller-agreement" className="hover:underline">Contrat Revendeur</Link>
            <span>•</span>
            <Link href="/legal/privacy" className="hover:underline">Protection des Données (APDP)</Link>
            <span>•</span>
            <Link href="/legal/warranty" className="hover:underline">Garantie & SAV</Link>
          </div>

        </div>

      </main>

      <BottomNav />
    </div>
  );
}
