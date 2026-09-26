import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Coordonnées par dossier (2026-09-26, Protection Suguba — lot 2).
 *
 * Règle : un intervenant voit une coordonnée POUR CE DOSSIER, PENDANT CETTE
 * ÉTAPE, PARCE QU'IL EN A BESOIN pour l'exécuter. Le rôle ne suffit pas.
 *   • livreur    : client et point de retrait tant que la course est en cours ;
 *   • fournisseur qui remet lui-même : client une fois la remise PRISE EN
 *     CHARGE, jusqu'à la remise ;
 *   • fournisseur, devis : téléphone du client tant que la demande attend sa
 *     réponse (qualifier le besoin), plus après sa proposition.
 * En dehors, le nom devient « Awa D. » et le reste disparaît. La donnée
 * n'est jamais envoyée puis cachée : elle ne quitte pas le serveur.
 * Chaque coordonnée remise est journalisée (acces_coordonnees).
 */

export const STATUTS_COURSE_EN_COURS = ['confirmed', 'dispatched', 'in_transit'] as const;

export function nomMasque(nomComplet: string | null | undefined): string {
  const mots = String(nomComplet || '').trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return 'Client';
  if (mots.length === 1) return mots[0];
  return `${mots[0]} ${mots[mots.length - 1].charAt(0).toUpperCase()}.`;
}

/** Le livreur a-t-il besoin de joindre le client et le fournisseur pour cette course ? */
export const courseEnCours = (statut: unknown) => (STATUTS_COURSE_EN_COURS as readonly unknown[]).includes(statut);

/** Données internes qu'aucun intervenant ne reçoit. */
const INTERNES = ['platform_margin', 'pricing_snapshot', 'delivery_otp', 'pickup_code', 'access_key_hash'] as const;

/**
 * Commande vue par un livreur. Hors course en cours : nom masqué, ni
 * téléphone, ni repère, ni consignes, ni coordonnées du point de retrait.
 */
export function commandePourLivreur(o: Record<string, any>, extras: { pickup_location: unknown; client_position: unknown }) {
  const propre: Record<string, any> = { ...o };
  for (const c of INTERNES) delete propre[c];
  delete propre.reseller_commission;
  if (courseEnCours(o.status)) return { ...propre, ...extras, contactsVisibles: true };
  return {
    ...propre,
    customer_name: nomMasque(o.customer_name), customer_phone: '', landmark: null, delivery_notes: null,
    pickup_location: null, client_position: null, contactsVisibles: false,
  };
}

/** Commande vue par le revendeur qui l'a apportée : c'est son client, mais pas les chiffres internes. */
export function commandePourRevendeur(o: Record<string, any>) {
  const propre: Record<string, any> = { ...o };
  for (const c of INTERNES) delete propre[c];
  return propre;
}

/** Fournisseur qui remet lui-même : joindre le client seulement une fois la remise prise en charge. */
export function clientVisiblePourRemise(o: { status: string; assigned_driver_id?: string | null }, fournisseurId: string): boolean {
  return o.assigned_driver_id === fournisseurId && ['confirmed', 'in_transit'].includes(o.status);
}

/** Devis : le fournisseur qualifie le besoin tant que la demande attend sa réponse. */
export const telephoneDevisVisible = (statut: string) => statut === 'demande';

// ── Journal des accès ───────────────────────────────────────────────────────
export type RaisonAcces = 'course' | 'remise' | 'devis';

/**
 * Trace qui a reçu quelles coordonnées (une ligne par personne, dossier et
 * jour). Ne bloque jamais l'affichage si la table n'existe pas encore.
 */
export async function journaliserAcces(
  admin: SupabaseClient, personneId: string, role: string, raison: RaisonAcces, dossiers: string[],
): Promise<void> {
  if (!dossiers.length) return;
  const jour = new Date().toISOString().slice(0, 10);
  const lignes = [...new Set(dossiers)].slice(0, 200).map((dossier) => ({ personne_id: personneId, role, raison, dossier, jour }));
  try {
    await admin.from('acces_coordonnees').upsert(lignes, { onConflict: 'personne_id,dossier,jour', ignoreDuplicates: true });
  } catch { /* journal indisponible : l'accès légitime n'est pas bloqué */ }
}
