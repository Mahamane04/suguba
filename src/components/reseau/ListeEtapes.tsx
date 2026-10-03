import React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { sansPrechargement } from '@/lib/reseau/porte-boutique';

/**
 * Liste d'étapes cochées au fil de l'eau, avec sa barre de progression.
 *
 * Extraite de ListeDemarrage (accueil revendeur, REV-13) au lot 2 du chantier
 * boutique (2026-10-03) : la même liste sert à « Vers votre première vente » et
 * à « Ma boutique est prête à X % » sur la vitrine du propriétaire. Une étape
 * mène à son outil : un lien (`href`), ou une action sur place (`onClick`, qui
 * ouvre un panneau de la vitrine sans changer de page).
 *
 * Sans 'use client' : rendue par l'accueil (client) comme par les outils du
 * propriétaire (client) ; `onClick` n'est donc jamais passé par un composant serveur.
 */
export interface ElementEtape {
  libelle: string;
  fait: boolean;
  href?: string;
  onClick?: () => void;
}

export default function ListeEtapes({
  id,
  titre,
  etapes,
  className = '',
}: {
  /** Identifiant du titre (aria-labelledby). */
  id: string;
  titre: React.ReactNode;
  etapes: ElementEtape[];
  className?: string;
}) {
  const faites = etapes.filter((e) => e.fait).length;
  const suivante = etapes.find((e) => !e.fait);
  return (
    <section aria-labelledby={id} className={`bg-white rounded-3xl border border-slate-200 p-5 space-y-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-bold text-base text-slate-900">{titre}</h2>
        <span className="text-sm text-slate-600 tabular-nums shrink-0">{faites} sur {etapes.length}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
        <div className="h-full rounded-full bg-suguba-brand" style={{ width: `${etapes.length ? (faites / etapes.length) * 100 : 0}%` }} />
      </div>
      <ol className="space-y-2">
        {etapes.map((e) => {
          const classes = `w-full text-left flex items-center gap-3 min-h-11 rounded-2xl px-2 ${e === suivante ? 'bg-suguba-sauge font-semibold text-slate-900' : 'text-slate-600'}`;
          const contenu = (
            <>
              <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center ${e.fait ? 'bg-suguba-brand text-white' : 'border-2 border-slate-300'}`} aria-hidden="true">
                {e.fait && <Check className="w-3.5 h-3.5" />}
              </span>
              <span className={e.fait ? 'line-through' : ''}>{e.libelle}</span>
              <span className="sr-only">{e.fait ? ' (fait)' : ' (à faire)'}</span>
            </>
          );
          return (
            <li key={e.libelle}>
              {e.onClick ? (
                <button type="button" onClick={e.onClick} className={classes}>{contenu}</button>
              ) : e.href ? (
                <Link href={e.href} prefetch={sansPrechargement(e.href) ? false : undefined} className={classes}>{contenu}</Link>
              ) : (
                <span className={classes}>{contenu}</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
