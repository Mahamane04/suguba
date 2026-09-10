'use client';

import React from 'react';
import { Check } from 'lucide-react';

/**
 * Fil d'Ariane de l'inscription, affiché en permanence de la création du
 * compte jusqu'à l'activation.
 *
 * Créé le 2026-09-09 : après Google, l'utilisateur tombait sur un formulaire
 * sans savoir où il en était, combien d'étapes restaient, ni ce qui se
 * passerait ensuite — et /pending-approval était un cul-de-sac qui n'annonçait
 * rien. C'est ce silence qui perdait les gens, plus que l'ordre des étapes.
 */

// « Validation Suguba » a disparu le 2026-09-10 avec la validation manuelle
// des comptes : l'étape 3 est désormais l'arrivée dans son espace.
const ETAPES = [
  { numero: 1, titre: 'Connexion' },
  { numero: 2, titre: 'Votre profil' },
  { numero: 3, titre: 'Votre espace' },
];

export default function EtapesInscription({ etapeActuelle }: { etapeActuelle: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-start justify-between gap-1 w-full" aria-label="Progression de l'inscription">
      {ETAPES.map((etape, i) => {
        const faite = etape.numero < etapeActuelle;
        const active = etape.numero === etapeActuelle;

        return (
          <li key={etape.numero} className="flex-1 flex flex-col items-center text-center relative">
            {/* Trait de liaison vers l'étape précédente */}
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`absolute top-3.5 right-1/2 w-full h-0.5 ${
                  faite || active ? 'bg-suguba-brand' : 'bg-gray-200'
                }`}
              />
            )}

            <span
              className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black ${
                faite
                  ? 'bg-suguba-brand text-white'
                  : active
                  ? 'bg-suguba-brand text-white ring-4 ring-suguba-brand/20'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {faite ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : etape.numero}
            </span>

            <span
              className={`mt-1.5 text-[10px] leading-tight ${
                active ? 'font-black text-gray-900' : faite ? 'font-semibold text-gray-600' : 'text-gray-400'
              }`}
            >
              {etape.titre}
            </span>

            {active && (
              <span className="text-[9px] font-bold text-suguba-brand uppercase tracking-wider mt-0.5">
                Vous êtes ici
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
