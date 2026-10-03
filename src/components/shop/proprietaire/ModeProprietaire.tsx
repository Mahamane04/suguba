'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';

/**
 * Mode propriétaire de la vitrine (lot 2 du chantier boutique, 2026-10-03).
 *
 * Le revendeur gère sa boutique LÀ OÙ le client la regarde. Cette enveloppe
 * porte `data-vue="gestion" | "client"` et la classe `group` :
 *  - ses outils (bandeau, crayons, « prête à X % ») portent
 *    `group-data-[vue=client]:hidden` ;
 *  - ce que voit un client (Suivre, partage, « Devenir revendeur ») est rendu
 *    aussi pour lui, avec `inert` et `hidden group-data-[vue=client]:block` :
 *    visible en vue client, sans effet (il ne peut pas s'abonner à sa propre
 *    boutique par erreur).
 * « Voir comme un client » ne recharge rien et n'envoie aucune requête : seule la
 * valeur de `data-vue` change. Le choix est gardé pour l'onglet (sessionStorage,
 * dans un try : navigation privée, stockage bloqué). Une pilule « Vue client ·
 * Revenir » reste au-dessus de la barre du bas.
 *
 * Relecture du lot 2 (2026-10-03) : la pilule ne redescend plus à 24 px du bas
 * à partir de 768 px (`md:bottom-6`). La barre du bas d'un revendeur reste
 * affichée sur tablette et ordinateur (BottomNav, rôles métier) et se peignait
 * par-dessus : en vue client, plus aucune sortie, et le choix gardé pour
 * l'onglet y ramenait encore après rechargement. Même hauteur à toutes les
 * largeurs, au-dessus de la barre (z-50).
 *
 * Chargé avec next/dynamic par ShopView, seulement pour le propriétaire : ce code
 * n'est jamais envoyé aux visiteurs.
 *
 * Le contexte partage aussi l'identité affichée (nom, logo…) : un logo changé par
 * le crayon apparaît aussitôt dans le bandeau, sans recharger la vitrine.
 *
 * Lot 4 (2026-10-03) : il porte aussi la feuille « Partager ma boutique », ouverte
 * par le bandeau, par l'étape « Partager ma boutique » de « prête à X % » ou à
 * l'arrivée par ?partager=1 (porte « Ma boutique », Mes clients) ; le paramètre
 * est alors retiré de l'adresse pour qu'un rechargement ne la rouvre pas. Une fois
 * un lien préparé, l'étape est cochée sur place.
 */

export type VueVitrine = 'gestion' | 'client';

export interface IdentiteVitrine {
  /** Nom que voient les clients : l'enseigne, ou « Awa D. » (jamais le nom complet). */
  nom: string;
  /** Vrai quand `nom` est une enseigne choisie (calculé par le serveur). */
  enseigne: boolean;
  /** Mot d'accueil (stores.tagline). */
  accroche: string | null;
  logo: string | null;
  couverture: string | null;
}

interface ContexteProprietaire {
  vue: VueVitrine;
  changerVue: (vue: VueVitrine) => void;
  identite: IdentiteVitrine;
  majIdentite: (changements: Partial<IdentiteVitrine>) => void;
  /** Feuille « Partager ma boutique » (lot 4). */
  partage: boolean;
  ouvrirPartage: () => void;
  fermerPartage: () => void;
  /** Un lien suivi de la boutique existe : étape « Partager ma boutique » faite. */
  aPartage: boolean;
  marquerPartage: () => void;
}

const Contexte = createContext<ContexteProprietaire | null>(null);

/** null hors de l'enveloppe (rendu isolé d'un outil) : chaque outil a son repli. */
export function useProprietaire(): ContexteProprietaire | null {
  return useContext(Contexte);
}

export const CLE_VUE = 'suguba:vitrine:vue';

export default function ModeProprietaire({
  identite: initiale,
  partageInitial = false,
  dejaPartage = false,
  children,
}: {
  identite: IdentiteVitrine;
  /** ?partager=1 reçu par la vitrine (boutique en ligne seulement). */
  partageInitial?: boolean;
  /** Un lien suivi de la boutique existe déjà (calculé par le serveur). */
  dejaPartage?: boolean;
  children: React.ReactNode;
}) {
  const [vue, setVue] = useState<VueVitrine>('gestion');
  const [identite, setIdentite] = useState<IdentiteVitrine>(initiale);
  const [partage, setPartage] = useState(false);
  const [aPartage, setAPartage] = useState(dejaPartage);

  useEffect(() => {
    if (!partageInitial) return;
    setPartage(true);
    try {
      const adresse = new URL(window.location.href);
      adresse.searchParams.delete('partager');
      window.history.replaceState(window.history.state, '', `${adresse.pathname}${adresse.search}${adresse.hash}`);
    } catch {
      // Adresse non modifiable : la feuille s'ouvre quand même.
    }
  }, [partageInitial]);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(CLE_VUE) === 'client') setVue('client');
    } catch {
      // Stockage indisponible : la vitrine s'ouvre en gestion, rien d'autre ne change.
    }
  }, []);

  const changerVue = useCallback((nouvelle: VueVitrine) => {
    setVue(nouvelle);
    try {
      window.sessionStorage.setItem(CLE_VUE, nouvelle);
    } catch {
      // Choix non retenu pour l'onglet : il reste valable jusqu'au rechargement.
    }
    window.scrollTo({ top: 0 });
  }, []);

  const majIdentite = useCallback((changements: Partial<IdentiteVitrine>) => {
    setIdentite((actuelle) => ({ ...actuelle, ...changements }));
  }, []);

  const ouvrirPartage = useCallback(() => setPartage(true), []);
  const fermerPartage = useCallback(() => setPartage(false), []);
  const marquerPartage = useCallback(() => setAPartage(true), []);

  const valeur = useMemo(
    () => ({ vue, changerVue, identite, majIdentite, partage, ouvrirPartage, fermerPartage, aPartage, marquerPartage }),
    [vue, changerVue, identite, majIdentite, partage, ouvrirPartage, fermerPartage, aPartage, marquerPartage],
  );

  return (
    <Contexte.Provider value={valeur}>
      <div data-vue={vue} className="group space-y-6">
        {children}
        <button
          type="button"
          onClick={() => changerVue('gestion')}
          className="hidden group-data-[vue=client]:inline-flex fixed left-1/2 -translate-x-1/2 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] z-50 items-center gap-2 min-h-11 px-4 rounded-full bg-suguba-profond text-white text-sm shadow-float"
        >
          <Eye className="w-4 h-4" />
          <span>Vue client ·</span>
          <strong className="font-semibold text-suguba-citron">Revenir</strong>
        </button>
      </div>
    </Contexte.Provider>
  );
}
