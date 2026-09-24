'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, ArrowRight, Users } from 'lucide-react';
import { quartierReconnu, quartiersVoisins, type NiveauProximite } from '@/lib/reseau/proximite';

/**
 * Boutiques du quartier choisi et des environs (2026-09-18).
 *
 * Pour découvrir les vendeurs voisins — passer les voir, les suivre. Rien à
 * voir avec la livraison, qui se règle dans la fenêtre de commande.
 *
 * Refonte UI du même jour : carrousel horizontal de cartes à couverture sur
 * l'accueil (au lieu d'une liste verticale qui repoussait les produits hors
 * de l'écran), distance en badge, raccourcis vers les quartiers voisins
 * quand il n'y a rien à proximité.
 */

export interface BoutiqueProche {
  slug: string;
  nom: string;
  accroche: string | null;
  logo: string | null;
  couverture?: string | null;
  abonnes: number;
  categories?: string[];
  quartier: string | null;
  lien: string;
  niveau: NiveauProximite;
  distanceKm: number;
}

export function useBoutiquesDuQuartier(quartier: string | null) {
  const [boutiques, setBoutiques] = useState<BoutiqueProche[]>([]);
  // Vrai d'emblée quand un quartier est connu : sinon le tout premier rendu
  // affiche « aucune boutique » avant même que la requête ne parte.
  const [chargement, setChargement] = useState(!!quartier);

  useEffect(() => {
    if (!quartier) { setBoutiques([]); return; }
    let annule = false;
    setChargement(true);
    fetch(`/api/reseau/boutiques?quartier=${encodeURIComponent(quartier)}`)
      .then((r) => r.json())
      .then((data) => { if (!annule) setBoutiques(data.boutiques || []); })
      .catch(() => { if (!annule) setBoutiques([]); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [quartier]);

  return { boutiques, chargement };
}

export function BadgeProximite({ b }: { b: Pick<BoutiqueProche, 'niveau' | 'distanceKm'> }) {
  if (b.niveau === 'quartier') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-suguba-brand-dark text-xs font-bold px-2 py-0.5">
        <MapPin className="w-3 h-3" /> Votre quartier
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5">
      <MapPin className="w-3 h-3" /> ~{String(b.distanceKm).replace('.', ',')} km
    </span>
  );
}

/** Carte boutique à couverture — carrousel (largeur fixe) ou grille. */
export function CarteBoutiqueProche({ b, carrousel = false }: { b: BoutiqueProche; carrousel?: boolean }) {
  const sousTitre = b.accroche || b.categories?.[0] || null;
  return (
    <Link
      href={b.lien}
      className={`group block bg-white rounded-3xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-card active:scale-[0.99] transition-all ${
        carrousel ? 'w-[216px] shrink-0 snap-start' : ''
      }`}
    >
      <div className="relative h-20 bg-gradient-to-br from-suguba-profond to-[#09b500]">
        {b.couverture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.couverture} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute left-3 -bottom-5">
          {b.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.logo} alt="" className="w-12 h-12 rounded-2xl object-cover bg-white ring-4 ring-white" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-white ring-4 ring-white text-suguba-profond text-lg font-bold flex items-center justify-center">
              {b.nom.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
      <div className="px-3 pt-7 pb-3 space-y-1.5">
        <p className="text-sm font-bold text-slate-900 truncate">{b.nom}</p>
        {sousTitre && <p className="text-xs text-slate-500 truncate">{sousTitre}</p>}
        <div className="flex items-center gap-1.5 flex-wrap">
          <BadgeProximite b={b} />
          {b.niveau === 'proche' && b.quartier && (
            <span className="text-xs text-slate-500 truncate max-w-[120px]">{b.quartier}</span>
          )}
          {b.abonnes > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs text-slate-400">
              <Users className="w-3 h-3" /> {b.abonnes}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Raccourcis vers les quartiers les plus proches. */
export function QuartiersVoisins({ quartier, onChoisir }: { quartier: string; onChoisir?: (q: string) => void }) {
  const voisins = quartiersVoisins(quartier, 4);
  if (!voisins.length) return null;
  const classe = 'inline-flex items-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700 px-3 min-h-[36px] hover:border-[#09b500] hover:text-[#078000] transition-colors';
  return (
    <div className="flex flex-wrap gap-2">
      {voisins.map((q) => onChoisir ? (
        <button key={q} type="button" onClick={() => onChoisir(q)} className={classe}>{q}</button>
      ) : (
        <Link key={q} href={`/boutiques?quartier=${encodeURIComponent(q)}`} className={classe}>{q}</Link>
      ))}
    </div>
  );
}

/** Aperçu sur l'accueil : carrousel, rien du tout sans quartier situé. */
export default function BoutiquesDuQuartier({ quartier }: { quartier: string | null }) {
  // « Autre quartier » ne se situe pas : pas de section plutôt qu'une liste vide trompeuse.
  const situe = quartierReconnu(quartier) ? quartier : null;
  const { boutiques, chargement } = useBoutiquesDuQuartier(situe);
  if (!situe) return null;

  const lienTout = `/boutiques?quartier=${encodeURIComponent(situe)}`;
  const visibles = boutiques.slice(0, 8);

  return (
    <section className="space-y-3" aria-label={`Boutiques près de ${situe}`}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">Boutiques près de chez vous</h2>
          <p className="text-xs text-slate-500 truncate">
            <MapPin className="w-3 h-3 inline -mt-0.5 text-suguba-brand-dark" /> {situe} et alentours
          </p>
        </div>
        {boutiques.length > 0 && (
          <Link href={lienTout} className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-suguba-brand-dark min-h-[36px]">
            Tout voir <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {chargement ? (
        <div className="flex gap-3 overflow-hidden" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="w-[216px] h-[168px] shrink-0 rounded-3xl bg-white border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : boutiques.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-bold text-slate-900">Pas encore de boutique près de {situe}</p>
          <p className="text-xs text-slate-500">Regardez dans un quartier voisin :</p>
          <QuartiersVoisins quartier={situe} />
        </div>
      ) : (
        <div className="-mx-4 sm:mx-0 px-4 sm:px-0 scroll-px-4 sm:scroll-px-0 flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1">
          {visibles.map((b) => <CarteBoutiqueProche key={b.lien} b={b} carrousel />)}
          {boutiques.length > visibles.length && (
            <Link
              href={lienTout}
              className="w-[140px] shrink-0 snap-start rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 text-xs font-bold text-suguba-brand-dark hover:border-suguba-brand"
            >
              <ArrowRight className="w-5 h-5" />
              {boutiques.length - visibles.length} de plus
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
