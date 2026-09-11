'use client';

import React, { useState } from 'react';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import ProductImage from '@/components/common/ProductImage';
import AfficheModal from '@/components/product/AfficheModal';
import { useSugubaStore } from '@/lib/store';
import { Product } from '@/types';
import { Lightbulb, Copy, Check, Image as ImageIcon } from 'lucide-react';

const IDEE_VIDEO = `Idée de vidéo courte (TikTok, Reels, statut) :
1. Montrez le problème : coupure de courant, vieil appareil en panne…
2. Présentez le produit Suguba et son prix.
3. Rappelez : vous payez à la livraison, livré chez vous à Bamako.
4. Terminez par votre lien Suguba (en description ou en message).`;

/**
 * Marketing revendeur — refait le 2026-09-11 autour d'un vrai studio
 * d'affiches (voir AfficheModal / src/lib/affiche.ts).
 *
 * L'ancienne page proposait des « kits prêts à poster » pour des produits qui
 * n'existaient pas dans le catalogue (Smart TV à 145 000 F, kit solaire à
 * 65 000 F), une « garantie 12 mois offerte » inventée, et invitait le client
 * à « écrire en privé » — donc à commander hors de Suguba, sans lien, sans
 * commission pour le revendeur. Son studio écrivait sur l'affiche le code et
 * le numéro d'un revendeur de démonstration.
 */
export default function ResellerMarketingPage() {
  const state = useSugubaStore();
  const [afficheDe, setAfficheDe] = useState<Product | null>(null);
  const [copie, setCopie] = useState(false);

  const produits = state.products.filter((p) => p.status === 'approved' && p.resellerCommission > 0);

  const copierIdee = async () => {
    try {
      await navigator.clipboard.writeText(IDEE_VIDEO);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers refusé : le texte reste lisible à l'écran.
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Affiches pour vos statuts</h1>
          <p className="text-xs text-slate-500">
            Touchez un produit : l&apos;affiche est prête en une seconde, avec le prix et votre lien de commande.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4" />
            <span>Choisissez un produit</span>
          </h2>
          {produits.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              Le catalogue est en cours de remplissage. Les produits apparaîtront ici dès leur validation.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {produits.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAfficheDe(p)}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 overflow-hidden text-left active:scale-[0.98] transition-all"
                >
                  <div className="relative aspect-square bg-slate-100">
                    <ProductImage src={p.images[0] || ''} alt={p.name} fill sizes="(max-width: 640px) 33vw, 25vw" className="object-cover" compact />
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] font-bold text-slate-900 line-clamp-1">{p.name}</p>
                    <p className="text-[11px] font-black text-slate-700">{p.publicPrice.toLocaleString('fr-FR')} F</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span>Les 3 réflexes des revendeurs qui vendent</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-600">
            <div className="bg-slate-50 p-3 rounded-2xl">
              <strong className="text-slate-900 block mb-1">1. Régularité</strong>
              Deux statuts par jour, le matin et le soir, plutôt que dix d&apos;un coup.
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl">
              <strong className="text-slate-900 block mb-1">2. Rassurer</strong>
              Le client paie à la livraison, et ne donne son code secret au livreur qu&apos;après avoir vu le colis.
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl">
              <strong className="text-slate-900 block mb-1">3. Réactivité</strong>
              Un contact intéressé ? Envoyez-lui votre lien, ou saisissez sa commande dans Suguba tout de suite.
            </div>
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-black text-sm text-slate-900">Idée de vidéo courte</h2>
            <button
              type="button"
              onClick={copierIdee}
              className="h-8 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5"
            >
              {copie ? <Check className="w-3.5 h-3.5 text-suguba-brand" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copie ? 'Copié' : 'Copier'}</span>
            </button>
          </div>
          <p className="p-3 bg-slate-50 rounded-2xl text-xs text-slate-700 whitespace-pre-line leading-relaxed">{IDEE_VIDEO}</p>
        </section>
      </main>

      {afficheDe && (
        <AfficheModal
          produit={{ nom: afficheDe.name, prix: afficheDe.publicPrice, slug: afficheDe.slug, images: afficheDe.images }}
          onClose={() => setAfficheDe(null)}
        />
      )}

      <BottomNav />
    </div>
  );
}
