import type { SupabaseClient } from '@supabase/supabase-js';
import { nomPublic } from './shop';

/**
 * Offres des revendeurs pour un article au prix de gros (2026-09-26, lot C
 * « Priorité au réseau ») — SERVEUR UNIQUEMENT.
 *
 * Un article au prix de gros n'a pas de prix public unique : chaque
 * revendeur fixe le sien. Un client arrivé sans revendeur voit donc les
 * offres réelles des revendeurs qui l'ont dans leur boutique, à leur prix —
 * et non une offre parallèle au prix conseillé qui court-circuiterait le
 * réseau (voir la protection dans order-create et cart-create).
 */

export interface OffreRevendeur {
  /** Prénom et initiale (« Awa D. »), comme la boutique publique. */
  nom: string;
  code: string;
  prix: number;
}


/** Revendeurs ACTIFS qui proposent ce produit, du moins cher au plus cher. */
export async function offresRevendeurs(
  admin: SupabaseClient,
  produit: { id: string; public_price: number | string },
  limite = 8,
): Promise<OffreRevendeur[]> {
  const { data: lignes, error } = await admin.from('reseller_shop_items').select('reseller_id').eq('product_id', produit.id).limit(200);
  if (error || !lignes?.length) return [];
  const ids = [...new Set(lignes.map((l: any) => l.reseller_id as string))];

  const [{ data: roles }, { data: profils }, { data: prix }] = await Promise.all([
    admin.from('profile_roles').select('profile_id, status').eq('role', 'reseller').in('profile_id', ids),
    admin.from('profiles').select('id, full_name, reseller_code').in('id', ids),
    admin.from('reseller_prices').select('reseller_id, price').eq('product_id', produit.id).in('reseller_id', ids),
  ]);
  const actifs = new Set((roles || []).filter((r: any) => r.status === 'active').map((r: any) => r.profile_id));
  const prixDe = new Map((prix || []).filter((p: any) => Number(p.price) > 0).map((p: any) => [p.reseller_id, Number(p.price)]));
  const conseille = Number(produit.public_price) || 0;

  return (profils || [])
    .filter((p: any) => actifs.has(p.id) && p.reseller_code)
    .map((p: any) => ({ nom: nomPublic(p.full_name), code: String(p.reseller_code), prix: Math.round(prixDe.get(p.id) ?? conseille) }))
    .filter((o) => o.prix > 0)
    .sort((a, b) => a.prix - b.prix || a.nom.localeCompare(b.nom))
    .slice(0, limite);
}

/**
 * Faut-il refuser l'achat direct (sans revendeur) de ce produit ? Oui pour un
 * article au prix de gros dès qu'au moins un revendeur actif le propose,
 * quand la protection est active. Sans offre revendeur, personne n'est
 * court-circuité : l'achat direct au prix conseillé reste possible.
 */
export async function achatDirectBloque(
  admin: SupabaseClient,
  produit: { id: string; mode_prix?: unknown; public_price: number | string },
  protection: boolean,
): Promise<boolean> {
  if (!protection || produit.mode_prix !== 'gros') return false;
  return (await offresRevendeurs(admin, produit, 1)).length > 0;
}

/** Réglage « protection des prix de gros » (vrai par défaut, y compris si la table manque). */
export async function protectionPrixDeGros(admin: SupabaseClient): Promise<boolean> {
  const { data } = await admin.from('reseau_reglages').select('valeurs').eq('id', 1).maybeSingle();
  return (data?.valeurs as Record<string, unknown> | undefined)?.protectionPrixDeGros !== false;
}

export const MESSAGE_ACHAT_VIA_REVENDEUR = 'Cet article est vendu par nos revendeurs partenaires, à leur prix. Choisissez l’offre d’un revendeur sur la fiche du produit.';
