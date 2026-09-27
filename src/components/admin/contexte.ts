'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Rubrique, TypeTache } from '@/lib/admin/poste';

/**
 * Contexte du poste de travail de l'équipe (A1, élargi en U3 le 2026-09-27).
 *
 * `dansPoste` : vrai dans l'espace admin — le poste affiche son propre menu,
 * l'en-tête, la barre du bas et le pied de page publics s'y effacent.
 * `poste` : le membre connecté et ses droits, lus UNE fois par le poste
 * (chaque page les redemandait). `compteurs` : dossiers en attente par type,
 * affichés dans le menu ; `rafraichir()` les relit après une action.
 */
export interface Poste {
  nom: string;
  teamRole: string | null;
  metier: string;
  libelleMetier: string;
  permissions: string[];
  rubriques: Rubrique[];
}

export interface ValeurPoste {
  dansPoste: boolean;
  poste: Poste | null;
  compteurs: Partial<Record<TypeTache, number>> | null;
  rafraichir: () => void;
}

export const PosteAdminContexte = createContext<ValeurPoste>({ dansPoste: false, poste: null, compteurs: null, rafraichir: () => undefined });

export function useDansPosteAdmin(): boolean {
  return useContext(PosteAdminContexte).dansPoste;
}

export function usePosteAdmin(): ValeurPoste {
  return useContext(PosteAdminContexte);
}

/** Le membre a-t-il ce droit ? `null` tant que le poste n'est pas chargé. */
export function usePermission(permission: string): boolean | null {
  const { poste } = useContext(PosteAdminContexte);
  return poste ? poste.permissions.includes(permission) : null;
}

/**
 * Dossier visé par le lien (« ?id=… », depuis « À traiter » ou la recherche) :
 * la page le surligne et l'amène à l'écran. Lu une fois, côté navigateur.
 */
export function useCibleUrl(parametre = 'id'): string | null {
  const [cible, setCible] = useState<string | null>(null);
  useEffect(() => { setCible(new URLSearchParams(window.location.search).get(parametre)); }, [parametre]);
  return cible;
}

/** Classes d'un élément visé par le lien. */
export function classeCible(cible: string | null, id: string): string {
  return cible === id ? 'ring-2 ring-suguba-profond ring-offset-2 ring-offset-slate-100' : '';
}

/** Amène à l'écran l'élément `[data-dossier="<cible>"]` une fois la liste chargée. */
export function useDefilerVersCible(cible: string | null, pret: boolean) {
  useEffect(() => {
    if (!cible || !pret) return;
    const t = setTimeout(() => {
      const el = [...document.querySelectorAll<HTMLElement>(`[data-dossier="${CSS.escape(cible)}"]`)].find((x) => x.getClientRects().length > 0);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 50);
    return () => clearTimeout(t);
  }, [cible, pret]);
}
