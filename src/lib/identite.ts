'use client';

import { sugubaStore, definirApercuAdmin } from '@/lib/store';

/**
 * Relit la session réelle (/api/auth/me) et la pousse dans le store partagé
 * que lisent le Header, la BottomNav et les écrans d'espace.
 *
 * ⚠️ Correctif du 2026-09-24 (« je dois me connecter deux fois ») : cette
 * lecture n'avait lieu qu'UNE fois, au montage de layout.tsx. Or une
 * connexion réussie ne remonte pas forcément le layout — /auth/callback
 * changeait de page avec router.push — et une PWA restaurée depuis le cache
 * du navigateur (retour de Google sur iPhone) ne le remonte jamais. L'app
 * gardait donc l'état « visiteur » alors que le cookie de session était bien
 * posé : l'en-tête affichait « Se connecter » et la personne recommençait.
 *
 * Désormais : relue au démarrage, au retour sur l'onglet et à la restauration
 * d'une page, avec un intervalle minimal pour ne pas marteler l'API.
 */

export interface Moi {
  authenticated: boolean;
  uid?: string;
  fullName?: string;
  phone?: string;
  role?: string;
  city?: string;
  status?: string;
  apercu?: boolean;
}

const INTERVALLE_MIN_MS = 5_000;
let derniereLecture = 0;
let enCours: Promise<Moi | null> | null = null;

export function rafraichirIdentite({ forcer = false } = {}): Promise<Moi | null> {
  if (enCours) return enCours;
  if (!forcer && Date.now() - derniereLecture < INTERVALLE_MIN_MS) return Promise.resolve(null);
  derniereLecture = Date.now();
  enCours = fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((moi: Moi | null) => {
      // Réseau coupé : on ne déconnecte pas l'écran sur une simple absence de réponse.
      if (!moi) return null;
      sugubaStore.definirUtilisateur(
        moi.authenticated && moi.uid
          ? { id: moi.uid, fullName: moi.fullName, phone: moi.phone, role: moi.role as never, city: moi.city }
          : null,
      );
      definirApercuAdmin(Boolean(moi.authenticated && moi.apercu));
      return moi;
    })
    .catch(() => null)
    .finally(() => { enCours = null; });
  return enCours;
}
