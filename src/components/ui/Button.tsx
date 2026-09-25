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
 * Règles qu'il applique (charte verte du 2026-09-23, voir tailwind.config.js) :
 *   • action principale en vert PROFOND, texte blanc (12,5:1). L'ancien
 *     blanc sur `suguba-brand` (2,76:1) était illisible en plein soleil ;
 *   • forme pilule, cibles de 40 à 52 px pour le pouce ;
 *   • demi-gras (600), jamais d'extra-gras ; rien sous 13 px.
 */

type Variante = 'primary' | 'secondary' | 'ghost' | 'danger' | 'whatsapp' | 'citron';
type Taille = 'sm' | 'md' | 'lg';

const VARIANTES: Record<Variante, string> = {
  // Action principale de l'écran. Une seule par écran, en principe.
  primary: 'bg-suguba-profond hover:bg-suguba-profond-2 text-white',
  // Action importante mais pas la principale (« Acheter » sur une carte) :
  // fond menthe, texte profond — clairement cliquable, sans voler la vedette.
  secondary: 'bg-suguba-menthe hover:bg-[#dcefd8] text-suguba-profond',
  // Action secondaire ou réversible : retour, annuler, choix parmi plusieurs.
  ghost: 'bg-white border border-slate-200 hover:bg-suguba-sauge hover:border-slate-300 text-suguba-profond',
  // Destructif ou irréversible uniquement — pas « attention » au sens large.
  danger: 'bg-white border border-rose-200 hover:bg-rose-50 text-rose-700',
  // Uniquement ce qui ouvre WhatsApp (partager, écrire au support).
  whatsapp: 'bg-suguba-wa hover:bg-[#1fbf5b] text-suguba-profond',
  // Action posée sur un fond vert profond (en-têtes, barre de commande).
  citron: 'bg-suguba-citron hover:bg-[#b9e94f] text-suguba-profond',
};

const TAILLES: Record<Taille, string> = {
  sm: 'min-h-[40px] px-4 text-sm gap-1.5',
  md: 'min-h-[44px] px-5 text-sm gap-2',
  lg: 'min-h-[52px] px-7 text-[15px] gap-2.5',
};

const BASE =
  'inline-flex items-center justify-center font-semibold rounded-full transition-all ' +
  'active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-suguba-profond focus-visible:ring-offset-2';

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
