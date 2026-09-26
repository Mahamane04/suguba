'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ancrerRevendeur, codeDansAdresse, normaliserCodeRevendeur, revendeurAncre } from '@/lib/ancrage-revendeur';
import { cloudSyncService } from '@/lib/cloud-sync';

/**
 * Garde le revendeur d'origine du visiteur (lot B, 2026-09-26) : à chaque
 * page, un code présent dans l'adresse (?ref=, /r/<code>) est retenu s'il n'y
 * en a pas déjà un. Voir src/lib/ancrage-revendeur.ts.
 *
 * Le code n'est retenu qu'après vérification qu'il désigne un revendeur
 * ACTIF : un lien mal recopié ne doit pas coller un code invalide pendant
 * 30 jours (les prix des articles au prix de gros en dépendent).
 *
 * `code` : boutique /boutique/<adresse> d'un revendeur, dont le code n'est
 * pas dans l'adresse.
 */
export default function AncrageRevendeur({ code }: { code?: string | null }) {
  const pathname = usePathname();
  useEffect(() => {
    if (revendeurAncre()) return;
    const candidat = normaliserCodeRevendeur(code) || codeDansAdresse(window.location.pathname, window.location.search);
    if (!candidat) return;
    let annule = false;
    fetch(`/api/shop/revendeur?code=${encodeURIComponent(candidat)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (annule || !j?.nom) return;
        ancrerRevendeur(candidat);
        // Les cartes des articles au prix de gros prennent aussitôt SON prix.
        void cloudSyncService.rafraichirCatalogue(true);
      })
      .catch(() => {});
    return () => { annule = true; };
  }, [pathname, code]);
  return null;
}
