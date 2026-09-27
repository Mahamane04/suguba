'use client';

import { supabase } from '@/lib/supabase';
import { invaliderIdentite } from '@/lib/identite';
import { sugubaStore } from '@/lib/store';

/**
 * Déconnexion complète (sortie de l'en-tête le 2026-09-27, lot U3) : le menu
 * de l'espace équipe en a besoin aussi, l'en-tête public y étant masqué.
 *
 * Renvoie false si le serveur n'a pas confirmé : l'appelant le dit à la
 * personne au lieu de faire comme si elle était déconnectée.
 */
export async function deconnecter(): Promise<boolean> {
  const result = await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
  if (!result?.ok) return false;
  invaliderIdentite();
  await supabase?.auth.signOut({ scope: 'local' }).catch(() => undefined);
  // Met à jour le store partagé tout de suite : BottomNav (et tout le reste
  // de l'app) le lit en direct, sans attendre un rechargement.
  sugubaStore.definirUtilisateur(null, true);
  return true;
}
