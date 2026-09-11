import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * Briques de mise en page communes (2026-09-11) : chaque écran les réécrivait
 * à la main, avec ses propres couleurs, rayons et tailles. Voir les règles en
 * tête de tailwind.config.js.
 */

/** Carte de page : fond blanc, bordure slate, rayon 3xl. */
export function Card({
  children,
  className = '',
  padding = 'p-5',
}: { children: React.ReactNode; className?: string; padding?: string }) {
  return <div className={`bg-white rounded-3xl border border-slate-200 ${padding} ${className}`}>{children}</div>;
}

/** En-tête d'écran : retour éventuel, titre, sous-titre, action à droite. */
export function PageHeader({
  titre,
  sousTitre,
  retour,
  action,
}: {
  titre: string;
  sousTitre?: string;
  retour?: { href: string; libelle: string };
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {retour && (
        <Link href={retour.href} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 min-h-[32px]">
          <ArrowLeft className="w-4 h-4" />
          <span>{retour.libelle}</span>
        </Link>
      )}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">{titre}</h1>
          {sousTitre && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{sousTitre}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

/** Indicateur chiffré. */
export function StatCard({
  label,
  valeur,
  aide,
  icone: Icone,
  accent = false,
}: {
  label: string;
  valeur: React.ReactNode;
  aide?: string;
  icone?: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-4 space-y-1">
      <p className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
        {Icone && <Icone className="w-3.5 h-3.5" />}
        <span>{label}</span>
      </p>
      <p className={`text-xl sm:text-2xl font-black ${accent ? 'text-suguba-brand' : 'text-slate-900'}`}>{valeur}</p>
      {aide && <p className="text-[11px] text-slate-500">{aide}</p>}
    </div>
  );
}

/** État vide : toujours une explication, et une action quand il y en a une. */
export function EmptyState({
  icone: Icone,
  titre,
  texte,
  action,
}: {
  icone?: React.ElementType;
  titre: string;
  texte?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
      {Icone && (
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <Icone className="w-6 h-6" />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-black text-slate-900">{titre}</p>
        {texte && <p className="text-sm text-slate-500 max-w-sm mx-auto">{texte}</p>}
      </div>
      {action && <div className="pt-1 flex justify-center">{action}</div>}
    </div>
  );
}

type TonPastille = 'succes' | 'attente' | 'danger' | 'neutre' | 'info';

const TONS: Record<TonPastille, string> = {
  succes: 'bg-suguba-brand/10 text-suguba-brand',
  attente: 'bg-amber-50 text-amber-800',
  danger: 'bg-rose-50 text-rose-700',
  neutre: 'bg-slate-100 text-slate-700',
  info: 'bg-sky-50 text-sky-800',
};

/** Pastille de statut (commande, produit, retrait…). */
export function StatusPill({ ton = 'neutre', children }: { ton?: TonPastille; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${TONS[ton]}`}>
      {children}
    </span>
  );
}

/** Bloc de chargement : garde la forme du contenu à venir. */
export function Skeleton({ className = 'h-24' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/70 ${className}`} aria-hidden="true" />;
}
