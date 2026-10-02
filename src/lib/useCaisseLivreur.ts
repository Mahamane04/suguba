'use client';

import { useEffect, useState } from 'react';
import { caisseDepuisLivraisons, duParCollecteur, type CaisseLivreur } from './caisse-livreur';

interface ReponseCaisse {
  caisse: CaisseLivreur | null;
  livreurGardeRemuneration: boolean;
  migrationRequise: boolean;
  lieuCaisse?: string | null;
  horairesCaisse?: string | null;
}

/**
 * Caisse du livreur connecté, lue à UNE seule source pour l'accueil et le
 * portefeuille (LIV-01, audit UI/UX du 2026-10-02). L'accueil additionnait
 * toutes les livraisons payées en espèces, versements déjà faits compris :
 * il affichait 196 750 F « dans la sacoche » quand le portefeuille disait
 * 46 850 F à remettre.
 *
 * `remuneration` (par course, lue dans /api/driver/me) ne sert qu'au repli,
 * tant que le SQL de la caisse n'est pas exécuté.
 */
export function useCaisseLivreur(livrees: { totalAmount: number; paymentMethod?: string | null }[], remuneration: number | null) {
  const [reponse, setReponse] = useState<ReponseCaisse | null>(null);
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'erreur'>('chargement');

  useEffect(() => {
    let actif = true;
    fetch('/api/driver/caisse', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: ReponseCaisse) => { if (actif) { setReponse(j); setEtat('pret'); } })
      .catch(() => { if (actif) setEtat('erreur'); });
    return () => { actif = false; };
  }, []);

  const caisse = reponse?.caisse
    || (reponse?.migrationRequise && remuneration !== null
      ? caisseDepuisLivraisons(livrees, reponse.livreurGardeRemuneration ? remuneration : 0)
      : null);
  // Caisse lue et vide : rien à remettre. Caisse illisible, ou repli qui attend
  // encore la rémunération : on n'affiche pas 0.
  const attendRemuneration = Boolean(reponse?.migrationRequise) && remuneration === null;
  const aRemettre = caisse ? duParCollecteur(caisse) : etat === 'pret' && !attendRemuneration ? 0 : null;

  return {
    etat,
    caisse,
    /** Seule la caisse du serveur dit si des espèces ont déjà été versées. */
    caisseServeur: reponse?.caisse || null,
    aRemettre,
    livreurGardeRemuneration: reponse?.livreurGardeRemuneration !== false,
    /** Où verser, si l'équipe l'a renseigné dans Paramètres › Livraison. */
    lieuCaisse: reponse?.lieuCaisse || null,
    horairesCaisse: reponse?.horairesCaisse || null,
  };
}
