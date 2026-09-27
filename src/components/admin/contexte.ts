'use client';

import { createContext, useContext } from 'react';

/**
 * Vrai dans l'espace admin (A1, 2026-09-27) : le poste de travail affiche son
 * propre menu latéral sur ordinateur, l'en-tête et le pied de page publics
 * s'y effacent (ils restent sur téléphone).
 */
export const PosteAdminContexte = createContext(false);

export function useDansPosteAdmin(): boolean {
  return useContext(PosteAdminContexte);
}
