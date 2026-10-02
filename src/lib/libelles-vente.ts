/**
 * Mots d'une vente et de sa commission, vus du revendeur (REV-01, REV-02,
 * lot 2 de l'audit UI/UX du 2026-10-02).
 *
 * Avant : « Livré & Encaissé » sur une vente dont la commission restait bloquée
 * quatorze jours, trois vocabulaires de statut selon l'écran, et 4 statuts sur 8
 * sans badge (une vente annulée affichait encore « +4 000 F » en vert). La
 * question du revendeur est toujours la même : « quand est-ce que je touche ? ».
 */
import type { OrderStatus } from '@/types';
import { formatDate } from './montant';

export type TonVente = 'succes' | 'attente' | 'danger' | 'neutre' | 'info';

/** Statut d'une vente, un seul mot par étape, pour TOUS les statuts de commande. */
export const STATUT_VENTE: Record<OrderStatus, { libelle: string; ton: TonVente }> = {
  // Court : il tient dans les listes étroites ; « Suguba appelle le client » est dit à côté.
  new: { libelle: 'À confirmer', ton: 'attente' },
  pending_call: { libelle: 'À confirmer', ton: 'attente' },
  confirmed: { libelle: 'Confirmée', ton: 'info' },
  dispatched: { libelle: 'Livreur en route', ton: 'info' },
  in_transit: { libelle: 'En livraison', ton: 'info' },
  delivered: { libelle: 'Livrée', ton: 'succes' },
  cancelled: { libelle: 'Annulée', ton: 'danger' },
  returned: { libelle: 'Refusée par le client', ton: 'danger' },
};

export const statutVente = (statut: string) =>
  STATUT_VENTE[statut as OrderStatus] || { libelle: 'Statut inconnu', ton: 'neutre' as TonVente };

export interface LigneCommission {
  commande: string | null;
  montant: number;
  statut: string;
  debloquagePrevu: string | null;
}

export interface EtatCommission {
  /** Montant encore dû ou déjà versé au revendeur (hors lignes annulées). */
  montant: number;
  /** Ce qui arrive à cet argent, en une phrase courte. */
  libelle: string;
  ton: TonVente;
}

/**
 * État de la commission d'UNE vente, à partir des lignes du grand-livre (une
 * vente peut en avoir plusieurs après un retrait partiel). L'étape la moins
 * avancée l'emporte : tant qu'une partie attend, la vente n'est pas « versée ».
 * Sans ligne connue, on se fie au statut de la commande, sans rien promettre.
 */
export function etatCommissionVente(
  lignes: LigneCommission[], statutCommande: string, montantPrevu: number, maintenant = Date.now(),
): EtatCommission {
  if (statutCommande === 'cancelled' || statutCommande === 'returned') {
    return { montant: 0, libelle: 'Vente annulée : pas de commission', ton: 'danger' };
  }
  const actives = lignes.filter((l) => l.statut !== 'reversed');
  if (lignes.length > 0 && actives.length === 0) {
    return { montant: 0, libelle: 'Commission annulée', ton: 'danger' };
  }
  const montant = actives.length ? actives.reduce((t, l) => t + (Number(l.montant) || 0), 0) : montantPrevu;
  const a = (statut: string) => actives.filter((l) => l.statut === statut);

  if (!actives.length) {
    return statutCommande === 'delivered'
      ? { montant, libelle: 'Livrée : commission en cours de calcul', ton: 'attente' }
      : { montant, libelle: 'Arrive après la livraison', ton: 'neutre' };
  }
  if (a('pending').length) return { montant, libelle: 'Arrive après la livraison', ton: 'neutre' };
  const bloquees = a('locked');
  if (bloquees.length) {
    const dates = bloquees.map((l) => Date.parse(l.debloquagePrevu || '')).filter(Number.isFinite);
    const plusTard = dates.length ? Math.max(...dates) : NaN;
    if (Number.isFinite(plusTard) && plusTard > maintenant) {
      return { montant, libelle: `Retirable le ${formatDate(plusTard, 'jour')}`, ton: 'attente' };
    }
    // Délai passé mais vente payée en espèces : l'argent n'est pas encore revenu à Suguba.
    return { montant, libelle: 'Retirable dès que Suguba reçoit l’argent du client', ton: 'attente' };
  }
  if (a('available').length) return { montant, libelle: 'Retirable maintenant', ton: 'succes' };
  if (a('reserved').length) return { montant, libelle: 'Retrait en cours', ton: 'info' };
  return { montant, libelle: 'Versée', ton: 'succes' };
}
