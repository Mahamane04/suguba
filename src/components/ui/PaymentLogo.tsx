import React from 'react';
import { Banknote, CreditCard } from 'lucide-react';

/**
 * Logo d'un moyen de paiement — UNE seule source pour toute l'application
 * (2026-09-13). Chaque écran écrivait jusqu'ici ses propres pastilles de
 * couleur (un point orange, un point gris « Moov », un point vert « Mobi
 * Cash »…) sans jamais montrer la marque que le client reconnaît.
 *
 * Fichiers officiels : déposer le logo fourni par l'opérateur dans
 * `public/images/paiement/` puis renseigner son chemin dans `LOGOS_OFFICIELS`.
 * Tant qu'il n'y en a pas, une vignette aux couleurs de la marque avec son
 * nom s'affiche — jamais un dessin imitant le logo.
 */

export type MoyenPaiement = 'orange_money' | 'moov_money' | 'mobi_cash' | 'carte' | 'especes';

const LOGOS_OFFICIELS: Partial<Record<MoyenPaiement, string>> = {
  // orange_money: '/images/paiement/orange-money.svg',
  // moov_money: '/images/paiement/moov-money.svg',
  // mobi_cash: '/images/paiement/mobi-cash.svg',
};

const MARQUES: Record<MoyenPaiement, { nom: string; fond: string; texte: string; mot: string }> = {
  orange_money: { nom: 'Orange Money', fond: 'bg-[#FF7900]', texte: 'text-white', mot: 'orange' },
  moov_money: { nom: 'Moov Money', fond: 'bg-[#005CA9]', texte: 'text-white', mot: 'moov' },
  mobi_cash: { nom: 'Mobi Cash', fond: 'bg-[#E30613]', texte: 'text-white', mot: 'mobi' },
  carte: { nom: 'Carte bancaire', fond: 'bg-slate-900', texte: 'text-white', mot: '' },
  especes: { nom: 'Espèces', fond: 'bg-slate-100', texte: 'text-slate-700', mot: '' },
};

const TAILLES = {
  sm: 'w-8 h-8 rounded-lg text-xs',
  md: 'w-10 h-10 rounded-xl text-xs',
  lg: 'w-12 h-12 rounded-xl text-xs',
};

/** Correspondance avec les codes réseau SasPay et les libellés de retrait. */
export function moyenDepuisCode(code: string): MoyenPaiement {
  const c = code.toLowerCase();
  if (c.includes('orange')) return 'orange_money';
  if (c.includes('moov')) return 'moov_money';
  if (c.includes('mobi')) return 'mobi_cash';
  if (c.includes('card') || c.includes('carte')) return 'carte';
  return 'especes';
}

export function nomMoyen(moyen: MoyenPaiement): string {
  return MARQUES[moyen].nom;
}

export default function PaymentLogo({
  moyen,
  taille = 'md',
  className = '',
}: {
  moyen: MoyenPaiement;
  taille?: keyof typeof TAILLES;
  className?: string;
}) {
  const marque = MARQUES[moyen];
  const officiel = LOGOS_OFFICIELS[moyen];
  const base = `${TAILLES[taille]} shrink-0 overflow-hidden flex items-center justify-center ${className}`;

  if (officiel) {
    return (
      <span className={`${base} bg-white border border-slate-200`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={officiel} alt={marque.nom} className="w-full h-full object-contain" />
      </span>
    );
  }

  return (
    <span role="img" aria-label={marque.nom} className={`${base} ${marque.fond} ${marque.texte}`}>
      {moyen === 'carte' ? (
        <CreditCard className="w-1/2 h-1/2" />
      ) : moyen === 'especes' ? (
        <Banknote className="w-1/2 h-1/2" />
      ) : (
        <span className="font-bold lowercase tracking-tight leading-none">{marque.mot}</span>
      )}
    </span>
  );
}
