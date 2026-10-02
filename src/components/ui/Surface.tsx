import React from 'react';
import SugubaLoader from '@/components/ui/SugubaLoader';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';

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
  ...reste
}: { children: React.ReactNode; className?: string; padding?: string } & Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'children'> & { 'data-dossier'?: string }) {
  return <div {...reste} className={`bg-white rounded-3xl border border-slate-200 ${padding} ${className}`}>{children}</div>;
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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{titre}</h1>
          {sousTitre && <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{sousTitre}</p>}
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
  href,
}: {
  label: string;
  valeur: React.ReactNode;
  aide?: string;
  icone?: React.ElementType;
  accent?: boolean;
  /** Une tuile mène au détail de son chiffre (ADM-10, audit UI/UX du 2026-10-02). */
  href?: string;
}) {
  const classes = 'bg-white rounded-3xl border border-slate-200 p-4 space-y-1';
  const contenu = (
    <>
        <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
          {Icone && <Icone className="w-3.5 h-3.5" />}
          <span>{label}</span>
        </p>
        <p className={`text-xl sm:text-2xl font-bold ${accent ? 'text-suguba-brand-dark' : 'text-slate-900'}`}>{valeur}</p>
        {aide && <p className="text-xs text-slate-500">{aide}</p>}
    </>
  );
  return href
    ? <Link href={href} className={`block hover:border-suguba-profond transition-colors ${classes}`}>{contenu}</Link>
    : <div className={classes}>{contenu}</div>;
}

/**
 * État vide : toujours une explication, et une action quand il y en a une.
 * `erreur` (lot 3 de l'audit UI/UX du 2026-10-02, FOU-07 / ADM-09) : une lecture
 * impossible ne doit jamais ressembler à « rien ici » — un fournisseur croyait
 * avoir perdu son catalogue sur un réseau faible. `onReessayer` ajoute le bouton.
 */
export function EmptyState({
  icone: Icone,
  titre,
  texte,
  action,
  erreur = false,
  onReessayer,
}: {
  icone?: React.ElementType;
  titre: string;
  texte?: string;
  action?: React.ReactNode;
  erreur?: boolean;
  onReessayer?: () => void;
}) {
  const Symbole = erreur ? AlertTriangle : Icone;
  return (
    <div role={erreur ? 'alert' : undefined} className={`bg-white rounded-3xl border p-8 text-center space-y-3 ${erreur ? 'border-rose-200' : 'border-slate-200'}`}>
      {Symbole && (
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${erreur ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
          <Symbole className="w-6 h-6" />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-bold text-slate-900">{titre}</p>
        {texte && <p className="text-sm text-slate-600 max-w-sm mx-auto">{texte}</p>}
      </div>
      {(action || onReessayer) && (
        <div className="pt-1 flex flex-wrap justify-center gap-2">
          {onReessayer && <Button type="button" variant="ghost" onClick={onReessayer}><RefreshCw className="w-4 h-4" />Réessayer</Button>}
          {action}
        </div>
      )}
    </div>
  );
}

type TonPastille = 'succes' | 'attente' | 'danger' | 'neutre' | 'info';

// Charte verte du 2026-09-23 : tout en vert, le rouge pour les seules
// erreurs. L'ancien « succès » (vert de marque sur vert pâle) plafonnait à
// 2,47:1 : illisible. Un point de couleur précède chaque état.
// Lot 3 de l'audit UI/UX du 2026-10-02 (ADM-04) : le « succès » en vert vif
// plein était l'élément le plus voyant des listes alors qu'il veut dire « rien à
// faire », et « à agir » était le plus pâle. Désormais : succès en fond menthe
// (le vert de marque reste sur le point), attente en ambre, info en contour.
const TONS: Record<TonPastille, { fond: string; point: string }> = {
  succes: { fond: 'bg-suguba-menthe text-suguba-profond', point: 'before:bg-suguba-brand' },
  attente: { fond: 'bg-amber-50 text-amber-900', point: 'before:bg-amber-500' },
  danger: { fond: 'bg-rose-50 text-rose-700', point: 'before:bg-rose-600' },
  neutre: { fond: 'bg-slate-100 text-slate-700', point: 'before:bg-slate-500' },
  info: { fond: 'bg-white text-suguba-profond ring-1 ring-inset ring-slate-200', point: 'before:bg-suguba-profond' },
};

/** Pastille de statut (commande, produit, retrait…). */
export function StatusPill({ ton = 'neutre', children }: { ton?: TonPastille; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full ${TONS[ton].fond} ${TONS[ton].point}`}>
      {children}
    </span>
  );
}

/** Bloc de chargement : garde la forme du contenu à venir. */
export function Skeleton({ className = 'h-24' }: { className?: string }) {
  return <div className={`relative overflow-hidden rounded-2xl bg-slate-200/70 ${className}`} aria-hidden="true"><SugubaLoader className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2" /></div>;
}
