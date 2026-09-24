import React from 'react';

/**
 * Logo Suguba — UNE seule source pour toute l'application (2026-09-24).
 *
 * Fichiers fournis par la marque, recadrés sur leur contenu :
 * - `complet` : icône + « SUGUBA » (public/images/logo-complet.svg), texte
 *   gris foncé ; `clair` bascule le texte en blanc pour les fonds sombres.
 * - `icone` : le sac « S » seul (public/images/logo.svg), carré.
 *
 * Avant, chaque écran dessinait sa propre tuile verte avec un « S » en texte,
 * ou affichait l'ancien logo.png suivi du mot SUGUBA tapé à la main.
 * La hauteur se règle par className (h-8, h-10…), la largeur suit.
 */
export default function LogoSuguba({
  variante = 'complet',
  clair = false,
  className = 'h-8',
}: {
  variante?: 'complet' | 'icone';
  clair?: boolean;
  className?: string;
}) {
  const src = variante === 'icone'
    ? '/images/logo.svg'
    : clair ? '/images/logo-complet-clair.svg' : '/images/logo-complet.svg';
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Suguba" className={`${className} w-auto shrink-0 select-none`} draggable={false} />;
}
