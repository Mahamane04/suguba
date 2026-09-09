'use client';

import React from 'react';
import Link from 'next/link';

/**
 * Bouton unique de l'application — point d'entrée du design system.
 *
 * Pourquoi un composant et pas seulement des jetons : les jetons existaient
 * déjà dans tailwind.config.js (vert de marque, ombres, échelle) et n'étaient
 * quasiment pas utilisés — 15 usages de `suguba-brand` contre ~160 boutons
 * peints à la main en `emerald-500/600/700` ou en `#09b500` écrit en dur. Un
 * jeton que personne n'appelle n'est pas un système ; un composant, si.
 *
 * Règles qu'il applique, et qui valent pour tout le reste de l'app :
 *   • un seul vert de marque, `suguba-brand`, réservé à l'action primaire ;
 *   • une seule échelle neutre, `slate` ;
 *   • un seul rayon pour les boutons, `rounded-2xl` ;
 *   • pas de texte sous 11px — illisible sur un téléphone en plein soleil.
 */

type Variante = 'primary' | 'secondary' | 'ghost' | 'danger';
type Taille = 'sm' | 'md' | 'lg';

const VARIANTES: Record<Variante, string> = {
  // Action principale de l'écran. Une seule par écran, en principe.
  primary: 'bg-suguba-brand hover:bg-suguba-brand-dark text-white shadow-brand-md hover:shadow-brand-lg',
  // Action importante mais pas la principale (« Acheter » sur une carte,
  // navigation ferme). Neutre foncé, jamais le vert de marque.
  secondary: 'bg-slate-900 hover:bg-black text-white',
  // Action secondaire ou réversible : retour, annuler, choix parmi plusieurs.
  ghost: 'bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-800',
  // Destructif ou irréversible uniquement — pas « attention » au sens large.
  danger: 'bg-rose-600 hover:bg-rose-700 text-white',
};

const TAILLES: Record<Taille, string> = {
  sm: 'py-2 px-3 text-xs gap-1.5',
  md: 'py-2.5 px-4 text-xs gap-2',
  lg: 'py-3.5 px-6 text-sm gap-2.5',
};

const BASE =
  'inline-flex items-center justify-center font-bold rounded-2xl transition-all ' +
  'active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-suguba-brand/40 focus-visible:ring-offset-2';

interface ProprietesCommunes {
  variant?: Variante;
  size?: Taille;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}

type ProprietesBouton = ProprietesCommunes &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { href?: undefined };

type ProprietesLien = ProprietesCommunes &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children' | 'href'> & { href: string };

export default function Button(props: ProprietesBouton | ProprietesLien) {
  const { variant = 'primary', size = 'md', fullWidth, className = '', children, ...reste } = props;

  const classes = [
    BASE,
    VARIANTES[variant],
    TAILLES[size],
    fullWidth ? 'w-full' : '',
    className,
  ].filter(Boolean).join(' ');

  // Un lien reste un lien : on ne transforme pas une navigation en `button`
  // avec un `onClick` — le clic milieu, « ouvrir dans un nouvel onglet » et
  // les lecteurs d'écran en dépendent.
  if ('href' in props && props.href !== undefined) {
    const { href, ...resteLien } = reste as ProprietesLien;
    return (
      <Link href={href} className={classes} {...resteLien}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...(reste as ProprietesBouton)}>
      {children}
    </button>
  );
}
