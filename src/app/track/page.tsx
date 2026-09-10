'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import BottomNav from '@/components/common/BottomNav';
import { PackageSearch, ArrowRight, MessageCircle } from 'lucide-react';
import { normaliserNumeroCommande } from '@/lib/order-number';

/**
 * Point d'entrée du suivi de commande, créé le 2026-09-09 avec la barre de
 * navigation client.
 *
 * Le suivi n'existait qu'en /track/[orderNumber] : accessible uniquement
 * depuis l'écran de confirmation juste après l'achat, ou depuis le reçu
 * WhatsApp. Un client qui fermait la page n'avait plus AUCUN moyen de
 * revenir sur sa commande — il n'a pas de compte, donc pas d'historique.
 * Cette page lui rend cette porte d'entrée.
 */
export default function TrackIndexPage() {
  const router = useRouter();
  const [numero, setNumero] = useState('');
  const [erreur, setErreur] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');

    // Le client tape souvent « K7M3P9RX », « sg-k7m3p9rx » ou « #SG-K7M3P9RX »
    // — on accepte les trois plutôt que de lui reprocher un format qu'il n'a
    // jamais eu à apprendre.
    //
    // Cette normalisation retirait auparavant tout ce qui n'était pas un
    // chiffre : elle datait des numéros à 5 chiffres et aurait mutilé les
    // numéros alphanumériques actuels (voir src/lib/order-number.ts).
    const reference = normaliserNumeroCommande(numero.replace(/^#/, ''));

    if (reference.length < 'SG-'.length + 4) {
      setErreur('Entrez le numéro de commande reçu à la confirmation (exemple : SG-K7M3P9RX).');
      return;
    }

    router.push(`/track/${reference}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8f5]">
      <Header />

      <main className="flex-1 max-w-lg mx-auto px-4 sm:px-6 py-8 w-full space-y-5">

        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-suguba-50 text-suguba-brand flex items-center justify-center mx-auto">
            <PackageSearch className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-gray-900">Suivre ma commande</h1>
          <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
            Entrez le numéro reçu au moment de la commande pour voir où en est votre colis.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-100 shadow-card p-5 sm:p-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="numero-commande" className="block text-xs font-bold text-gray-700">
              Numéro de commande
            </label>
            <input
              id="numero-commande"
              type="text"
              inputMode="text"
              autoFocus
              placeholder="SG-K7M3P9RX"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-center text-lg font-black tracking-wide text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-suguba-brand/30"
            />
          </div>

          {erreur && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600">
              {erreur}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3.5 bg-[#09b500] hover:bg-[#078000] text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            Voir ma commande
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="bg-white rounded-3xl border border-gray-100 p-5 space-y-2">
          <p className="text-xs font-bold text-gray-900">Vous avez perdu votre numéro ?</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Il figure sur l&apos;écran de confirmation affiché après la commande, et sur le reçu
            que vous avez pu enregistrer sur WhatsApp. Sinon, écrivez-nous : nous le retrouvons
            avec votre numéro de téléphone.
          </p>
          <a
            href="https://wa.me/22389460000"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#25D366] hover:underline"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-current" />
            Contacter Suguba sur WhatsApp
          </a>
        </div>

        <p className="text-center text-xs text-gray-500">
          <Link href="/" className="font-bold text-suguba-brand hover:underline">
            Retour au catalogue
          </Link>
        </p>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
