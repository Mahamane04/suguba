import { QUANTITE_MAX, calculerCommande, type Devis, type ReglagesPlateforme } from './pricing';
import { normaliserCommande, type OrderInput } from './order-input';
import type { DepotFournisseur } from './depot-fournisseur';

/**
 * Panier multi-articles — seules les INTENTIONS du client traversent le
 * réseau : quels produits, combien, où livrer. Aucun prix, aucune commission :
 * tout est recalculé par le serveur, exactement comme pour une commande seule.
 */

export const LIGNES_MAX = 20;

export interface LignePanier {
  productId: string;
  quantity: number;
}

export type PanierInput = Omit<OrderInput, 'productId' | 'quantity'> & { lignes: LignePanier[] };

export function normaliserPanier(value: unknown): PanierInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Panier invalide.');
  const brut = value as Record<string, unknown>;
  if (!Array.isArray(brut.lignes) || brut.lignes.length === 0) throw new Error('Votre panier est vide.');
  if (brut.lignes.length > LIGNES_MAX) throw new Error(`Un panier contient au plus ${LIGNES_MAX} articles différents.`);

  // Deux lignes du même produit sont fusionnées : sinon le même article
  // porterait deux commissions et deux frais de livraison distincts.
  const fusion = new Map<string, number>();
  for (const l of brut.lignes) {
    const ligne = l as Record<string, unknown>;
    const id = typeof ligne?.productId === 'string' ? ligne.productId.trim() : '';
    if (!id || id.length > 150) throw new Error('Article invalide dans le panier.');
    if (!Number.isInteger(ligne.quantity) || Number(ligne.quantity) < 1) throw new Error('Quantité invalide dans le panier.');
    fusion.set(id, (fusion.get(id) || 0) + Number(ligne.quantity));
  }
  const lignes = [...fusion.entries()].map(([productId, quantity]) => {
    if (quantity > QUANTITE_MAX) throw new Error(`Choisissez une quantité entre 1 et ${QUANTITE_MAX} par article.`);
    return { productId, quantity };
  });

  // Coordonnées et adresse : exactement les mêmes règles qu'une commande
  // seule, en réutilisant la même fonction plutôt qu'une copie qui divergerait.
  const { productId: _p, quantity: _q, ...commun } = normaliserCommande({ ...brut, productId: lignes[0].productId, quantity: 1 });
  return { ...commun, lignes };
}

// ─────────────────────── Calcul des lignes (pur) ───────────────────────


export interface ProduitPanier {
  id: string;
  name: string;
  supplier_price: number | string;
  public_price: number | string;
  commission_proposee: number | string | null;
  supplier_id: string | null;
  /** 'gros' : article au prix de gros, vendu au prix du revendeur (2026-09-24). */
  mode_prix?: string | null;
}

export interface LigneCalculee {
  devis: Devis;
  /** Clé du groupe de livraison : un fournisseur, ou « relais » pour tout le panier. */
  groupe: string;
  porteLaLivraison: boolean;
  fraisLivraison: number;
  total: number;
}

/**
 * Montants de chaque ligne d'un panier — la SEULE formule, utilisée à
 * l'identique par le devis affiché (/api/orders/cart-quote) et par la
 * création (/api/orders/cart). Montant affiché = montant facturé.
 *
 *   • une livraison par fournisseur (même lieu d'enlèvement) ; en point
 *     relais, une seule pour tout le panier ;
 *   • le code promo sur la première ligne seulement.
 */
export function calculerLignesPanier(
  lignes: LignePanier[],
  produits: ProduitPanier[],
  depots: Map<string, DepotFournisseur>,
  demande: {
    ville: string; quartierClient?: string; positionClient?: { lat: number; lng: number } | null;
    pointRelaisId?: string; codePromo?: string; revendeurAttribue: boolean;
    /** Prix enregistrés par le revendeur attribué, par produit (articles au prix de gros). */
    prixRevendeur?: Map<string, number>;
  },
  reglages: ReglagesPlateforme,
): LigneCalculee[] {
  const groupesLivres = new Set<string>();
  return lignes.map((ligne, i) => {
    const p = produits[i];
    const devis = calculerCommande({
      prixFournisseur: Number(p.supplier_price), prixVente: Number(p.public_price),
      commissionProposee: p.commission_proposee == null ? null : Number(p.commission_proposee),
      modePrix: p.mode_prix === 'gros' ? 'gros' : 'fixe',
    }, {
      quantite: ligne.quantity, ville: demande.ville,
      quartierClient: demande.quartierClient,
      positionClient: demande.positionClient,
      quartierFournisseur: p.supplier_id ? depots.get(p.supplier_id)?.quartier : undefined,
      positionFournisseur: p.supplier_id ? depots.get(p.supplier_id)?.position : undefined,
      pointRelaisId: demande.pointRelaisId,
      codePromo: i === 0 ? demande.codePromo : undefined,
      revendeurAttribue: demande.revendeurAttribue,
      prixRevendeur: demande.prixRevendeur?.get(p.id) ?? null,
    }, reglages);
    const groupe = devis.pointRelais ? 'relais' : `f:${p.supplier_id || 'suguba'}`;
    const porteLaLivraison = !groupesLivres.has(groupe);
    groupesLivres.add(groupe);
    return {
      devis,
      groupe,
      porteLaLivraison,
      fraisLivraison: porteLaLivraison ? devis.fraisLivraison : 0,
      total: porteLaLivraison ? devis.total : Math.max(0, devis.total - devis.fraisLivraison),
    };
  });
}
