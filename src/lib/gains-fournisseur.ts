import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Solde des fournisseurs (lot C, 2026-09-27) — le pendant de
 * src/lib/commissions.ts pour les revendeurs.
 *
 * Le grand-livre vit dans la base (table `gains_fournisseurs`, voir
 * supabase/A-EXECUTER-2026-09-27-retraits-fournisseurs.sql) :
 *   livraison        → crédit bloqué pendant le délai de sécurité (déclencheur) ;
 *   délai écoulé     → retirable, une fois l'argent de la vente chez Suguba ;
 *   demande          → réservé (creer_retrait_fournisseur) ;
 *   virement/guichet → payé ; refus ou échec → de nouveau retirable.
 *
 * Ici : le même calcul du montant dû (pour l'afficher sur les commandes) et
 * le résumé du solde. Aucune écriture.
 */

export type StatutGain = 'locked' | 'available' | 'reserved' | 'paid' | 'reversed';

export interface LigneGain {
  amount: number | string;
  status: string;
  unlock_at?: string | null;
}

export interface SoldeFournisseur {
  /** Retirable maintenant. */
  disponible: number;
  /** Délai de sécurité en cours. */
  enAttente: number;
  /** Délai écoulé, mais les espèces de la vente ne sont pas encore chez Suguba. */
  attenteFonds: number;
  /** Réservé par une demande de retrait pas encore payée. */
  enRetrait: number;
  /** Déjà versé. */
  verse: number;
  /** Date du prochain montant qui sort de son délai de sécurité. */
  prochainDeblocage: string | null;
}

/**
 * Montant dû au fournisseur pour une commande — MÊME RÈGLE que la base :
 * prix fournisseur figé dans le devis de la commande (sinon celui du
 * catalogue) × quantité, plus les frais de remise quand il livre lui-même
 * (il reverse alors tout l'argent à la caisse Suguba).
 */
export function montantDuFournisseur(
  commande: { pricing_snapshot?: unknown; quantity?: unknown; delivery_fee?: unknown },
  prixCatalogue: number,
): number {
  const s = commande.pricing_snapshot as { devis?: { tarif?: { prixFournisseur?: unknown } }; remise?: { mode?: unknown } } | null | undefined;
  const fige = s?.devis?.tarif?.prixFournisseur;
  const unitaire = typeof fige === 'number' ? fige : Number(prixCatalogue) || 0;
  const quantite = Math.max(1, Number(commande.quantity) || 1);
  let montant = Math.round(unitaire * quantite);
  if (s?.remise?.mode === 'fournisseur') montant += Math.round(Math.max(0, Number(commande.delivery_fee) || 0));
  return Math.max(0, montant);
}

/**
 * Résumé du solde à partir des lignes du grand-livre. À appeler APRÈS
 * libererGainsFournisseursEchus : une ligne encore bloquée dont le délai est
 * écoulé attend alors forcément l'argent de la vente.
 */
export function resumerSoldeFournisseur(gains: LigneGain[], maintenant = Date.now()): SoldeFournisseur {
  const s: SoldeFournisseur = { disponible: 0, enAttente: 0, attenteFonds: 0, enRetrait: 0, verse: 0, prochainDeblocage: null };
  let prochain = Infinity;
  for (const g of gains) {
    const montant = Number(g.amount) || 0;
    if (g.status === 'available') s.disponible += montant;
    else if (g.status === 'reserved') s.enRetrait += montant;
    else if (g.status === 'paid') s.verse += montant;
    else if (g.status === 'locked') {
      const fin = g.unlock_at ? Date.parse(g.unlock_at) : NaN;
      if (Number.isFinite(fin) && fin <= maintenant) s.attenteFonds += montant;
      else {
        s.enAttente += montant;
        if (Number.isFinite(fin) && fin < prochain) prochain = fin;
      }
    }
  }
  if (prochain !== Infinity) s.prochainDeblocage = new Date(prochain).toISOString();
  return s;
}

/** Ce que le fournisseur lit à côté d'une ligne de son solde. */
export function etatGain(g: LigneGain, maintenant = Date.now()): { code: 'bloque' | 'attente_fonds' | 'disponible' | 'en_retrait' | 'verse' | 'annule'; libelle: string } {
  switch (g.status) {
    case 'available': return { code: 'disponible', libelle: 'Disponible' };
    case 'reserved': return { code: 'en_retrait', libelle: 'En cours de retrait' };
    case 'paid': return { code: 'verse', libelle: 'Versé' };
    case 'reversed': return { code: 'annule', libelle: 'Annulé (commande retournée)' };
    default: {
      const fin = g.unlock_at ? Date.parse(g.unlock_at) : NaN;
      if (Number.isFinite(fin) && fin <= maintenant) return { code: 'attente_fonds', libelle: 'Attend l’argent de la livraison' };
      const date = Number.isFinite(fin) ? new Date(fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : null;
      return { code: 'bloque', libelle: date ? `Disponible le ${date}` : 'Délai de sécurité' };
    }
  }
}

/** Table ou fonction du lot C absente : le SQL n'a pas encore été exécuté. */
export function lotCAbsent(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return ['PGRST205', 'PGRST202', '42P01', '42883', '42703'].includes(String(error.code || ''))
    || /gains_fournisseurs|creer_retrait_fournisseur|beneficiaire/.test(String(error.message || ''));
}

/**
 * Libère les montants dont le délai est écoulé (et l'argent reçu). À appeler
 * avant toute lecture de solde ou demande de retrait.
 */
export async function libererGainsFournisseursEchus(admin: SupabaseClient): Promise<void> {
  const { error } = await admin.rpc('liberer_gains_fournisseurs_echus');
  // Non bloquant : sans le SQL du lot C, il n'y a simplement aucun solde.
  if (error) console.warn('[GAINS FOURNISSEURS] liberer_gains_fournisseurs_echus indisponible:', error.code || error.message);
}
