/**
 * Catalogue servi au navigateur (2026-09-26, lot A « Priorité au réseau ») —
 * logique PURE.
 *
 * Avant, le navigateur lisait la table `products` avec la clé publique :
 * n'importe quel visiteur pouvait lire le prix fournisseur, la part
 * revendeur et les réglages de tarification de chaque produit. Le catalogue
 * passe désormais par /api/catalogue, qui ne renvoie à chacun que ce qu'il
 * a le droit de voir — et la base refuse ces colonnes à la clé publique
 * (A-EXECUTER-2026-09-26-catalogue-prix-prives.sql).
 *
 *   visiteur / client / livreur : prix de vente et description de l'offre ;
 *   revendeur   : + ses gains (part revendeur) ;
 *   fournisseur : + prix fournisseur et tarification de SES produits
 *                 (propriétaire, ou collaborateur ayant le droit « catalogue ») ;
 *   admin       : tout.
 */

/** Colonnes publiques : les seules lisibles avec la clé publique. */
export const COLONNES_PUBLIQUES = [
  'id', 'name', 'slug', 'category', 'description', 'public_price', 'stock', 'images', 'status',
  'supplier_id', 'supplier_name', 'created_at', 'updated_at', 'mode_prix', 'prix_conseille',
  'type_offre', 'mode_remise', 'frais_remise', 'offre_inclus', 'mode_commande', 'etapes',
] as const;

const COLONNES_REVENDEUR = ['reseller_commission'] as const;
const COLONNES_FOURNISSEUR = ['supplier_price', 'reseller_commission', 'commission_proposee', 'pricing_status', 'pricing_computed_at'] as const;

export type AccesCatalogue =
  | { role: 'public' }
  | { role: 'reseller' }
  | { role: 'supplier'; fournisseurId: string; voitPrix: boolean }
  | { role: 'admin' };

function garder(p: Record<string, unknown>, colonnes: readonly string[], dans: Record<string, unknown>) {
  for (const c of colonnes) if (c in p) dans[c] = p[c];
  return dans;
}

/** Ce que ce lecteur peut voir d'un produit. */
export function produitPourLecteur(p: Record<string, unknown>, acces: AccesCatalogue): Record<string, unknown> {
  if (acces.role === 'admin') return { ...p };
  const vue = garder(p, COLONNES_PUBLIQUES, {});
  if (acces.role === 'reseller') return garder(p, COLONNES_REVENDEUR, vue);
  if (acces.role === 'supplier' && acces.voitPrix && p.supplier_id === acces.fournisseurId) return garder(p, COLONNES_FOURNISSEUR, vue);
  return vue;
}
