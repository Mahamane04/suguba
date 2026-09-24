'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, Store, ArrowRight } from 'lucide-react';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import {
  CarteBoutiqueProche, QuartiersVoisins, useBoutiquesDuQuartier,
} from '@/components/reseau/BoutiquesDuQuartier';
import { useQuartierClient } from '@/lib/store';
import { quartierReconnu, RAYON_KM } from '@/lib/reseau/proximite';

/**
 * Boutiques par quartier (2026-09-18) : /boutiques?quartier=<nom>.
 *
 * Sans quartier dans l'adresse, on part de celui que le client a choisi sur
 * l'accueil. Changer de quartier ici ne modifie pas ce choix : on peut
 * regarder ce qui se vend à Faladié sans cesser d'habiter Missira.
 *
 * Mise en page alignée sur l'accueil (bandeau vert, pastille de quartier),
 * filtres en pastilles : distance puis catégorie.
 */

type FiltreDistance = 'toutes' | 'quartier' | '2km';

function Pastille({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`px-3.5 min-h-[36px] rounded-full text-xs font-bold whitespace-nowrap transition-all ${
        actif ? 'bg-suguba-citron text-suguba-profond' :'bg-white/10 border border-white/15 text-emerald-100/80 hover:bg-white/20'
      }`}
    >
      {children}
    </button>
  );
}

function Contenu() {
  const router = useRouter();
  const params = useSearchParams();
  const quartierClient = useQuartierClient();
  const [quartier, setQuartier] = useState<string | null>(params?.get('quartier') || null);
  const [distance, setDistance] = useState<FiltreDistance>('toutes');
  const [categorie, setCategorie] = useState<string | null>(null);

  useEffect(() => {
    if (!quartier && quartierClient) setQuartier(quartierClient);
  }, [quartier, quartierClient]);

  const choisir = (q: string) => {
    setQuartier(q);
    setDistance('toutes');
    setCategorie(null);
    router.replace(`/boutiques?quartier=${encodeURIComponent(q)}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const valide = quartierReconnu(quartier);
  const { boutiques, chargement } = useBoutiquesDuQuartier(valide ? quartier : null);

  const categories = useMemo(
    () => Array.from(new Set(boutiques.flatMap((b) => b.categories || []).filter(Boolean))).slice(0, 8),
    [boutiques],
  );
  const nbQuartier = boutiques.filter((b) => b.niveau === 'quartier').length;
  const filtrees = boutiques.filter((b) =>
    (distance === 'toutes' || (distance === 'quartier' ? b.niveau === 'quartier' : b.distanceKm <= 2))
    && (!categorie || (b.categories || []).includes(categorie)));

  return (
    <>
      <section className="bg-suguba-profond px-4 sm:px-6 pt-5 pb-5">
        <div className="max-w-5xl mx-auto space-y-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Boutiques près de chez vous</h1>
            <p className="text-xs sm:text-sm text-emerald-100/70 mt-0.5">
              Les vendeurs de votre quartier et des alentours (moins de {RAYON_KM} km environ).
            </p>
          </div>

          <NeighborhoodPicker variante="puce" prefixe="Quartier" value={quartier || ''} onChange={choisir} placeholder="Choisir un quartier" />

          {valide && boutiques.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5">
              <Pastille actif={distance === 'toutes' && !categorie} onClick={() => { setDistance('toutes'); setCategorie(null); }}>
                Toutes ({boutiques.length})
              </Pastille>
              {nbQuartier > 0 && nbQuartier < boutiques.length && (
                <Pastille actif={distance === 'quartier'} onClick={() => setDistance(distance === 'quartier' ? 'toutes' : 'quartier')}>
                  Mon quartier ({nbQuartier})
                </Pastille>
              )}
              <Pastille actif={distance === '2km'} onClick={() => setDistance(distance === '2km' ? 'toutes' : '2km')}>
                À 2 km
              </Pastille>
              {categories.length > 1 && categories.map((c) => (
                <Pastille key={c} actif={categorie === c} onClick={() => setCategorie(categorie === c ? null : c)}>{c}</Pastille>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-5 space-y-6">
        {!quartier ? (
          <Invitation titre="Où êtes-vous ?" texte="Choisissez votre quartier (ou « Utiliser ma position actuelle ») pour voir les boutiques autour de vous." />
        ) : !valide ? (
          <Invitation titre="Quartier pas encore sur la carte" texte="Choisissez le quartier connu le plus proche de chez vous." />
        ) : chargement ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[176px] rounded-3xl bg-white border border-slate-100 animate-pulse" />
            ))}
          </div>
        ) : boutiques.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 text-suguba-brand-dark flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-slate-900">Pas encore de boutique près de {quartier}</p>
            <p className="text-xs text-slate-500">Essayez un quartier voisin :</p>
            <div className="flex justify-center"><QuartiersVoisins quartier={quartier} onChoisir={choisir} /></div>
          </div>
        ) : filtrees.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 text-center space-y-2">
            <p className="text-sm font-bold text-slate-900">Aucune boutique avec ces filtres</p>
            <button type="button" onClick={() => { setDistance('toutes'); setCategorie(null); }} className="text-xs font-bold text-suguba-brand-dark underline underline-offset-2 min-h-[36px]">
              Voir toutes les boutiques
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtrees.map((b) => <CarteBoutiqueProche key={b.lien} b={b} />)}
          </div>
        )}

        {valide && !chargement && boutiques.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500">Explorer un quartier voisin</p>
            <QuartiersVoisins quartier={quartier as string} onChoisir={choisir} />
          </div>
        )}

        {/* Côté vendeur : une boutique de plus dans le quartier profite à tous. */}
        <Link
          href="/rejoindre"
          className="flex items-center gap-3 rounded-3xl bg-white border border-slate-200 p-4 hover:border-slate-300 transition-colors"
        >
          <div className="w-11 h-11 rounded-2xl bg-suguba-profond text-white flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">Vous vendez{valide ? ` à ${quartier}` : ''} ?</p>
            <p className="text-xs text-slate-500">Ouvrez votre boutique Suguba et soyez trouvé par les clients du quartier.</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
        </Link>
      </div>
    </>
  );
}

function Invitation({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 text-center space-y-2">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 text-suguba-brand-dark flex items-center justify-center">
        <MapPin className="w-5 h-5" />
      </div>
      <p className="text-sm font-bold text-slate-900">{titre}</p>
      <p className="text-xs text-slate-500 max-w-xs mx-auto">{texte}</p>
    </div>
  );
}

export default function BoutiquesParQuartierPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8f5] pb-20 md:pb-0">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<div className="h-40 bg-suguba-profond" />}>
          <Contenu />
        </Suspense>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
