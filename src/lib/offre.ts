/**
 * Offres (2026-09-26, lot 1a « Offres & réalisation ») — logique PURE,
 * partagée navigateur / serveur.
 *
 * Une offre n'est plus seulement un produit livré par un livreur Suguba :
 *   - sa NATURE : produit, service, ou produit avec service (installation…) ;
 *   - qui la REMET au client : un livreur Suguba (défaut), le fournisseur
 *     lui-même (véhicule, installation), ou le client vient la retirer.
 * Les deux réglages sont indépendants : un kit solaire peut être un
 * « produit + service » remis par le fournisseur, un téléphone un produit
 * livré par Suguba.
 *
 * L'encaissement passe TOUJOURS par Suguba (décision du fondateur) : Mobile
 * Money avant la remise, ou espèces remises à la caisse Suguba par celui qui
 * les a reçues — livreur ou fournisseur.
 */

export type TypeOffre = 'produit' | 'service' | 'produit_service';
export type ModeRemise = 'livreur' | 'fournisseur' | 'retrait';

export interface RemiseOffre {
  mode: ModeRemise;
  /** Frais facturés au client par le fournisseur pour la remise (mode « fournisseur »). */
  frais: number;
}

export const TYPES_OFFRE: { valeur: TypeOffre; libelle: string; detail: string }[] = [
  { valeur: 'produit', libelle: 'Un produit', detail: 'Un article vendu tel quel' },
  { valeur: 'service', libelle: 'Un service', detail: 'Une prestation : réparation, formation, pose…' },
  { valeur: 'produit_service', libelle: 'Un produit avec service', detail: 'Ex. kit solaire avec installation' },
];

export const MODES_REMISE: { valeur: ModeRemise; libelle: string; detail: string }[] = [
  { valeur: 'livreur', libelle: 'Un livreur Suguba', detail: 'Suguba vient chercher l’article et le livre' },
  { valeur: 'fournisseur', libelle: 'Moi-même', detail: 'Je remets l’article ou réalise le service chez le client' },
  { valeur: 'retrait', libelle: 'Le client vient chez moi', detail: 'Retrait ou prestation dans mes locaux' },
];

export const normaliserTypeOffre = (v: unknown): TypeOffre =>
  v === 'service' || v === 'produit_service' ? v : 'produit';

export const normaliserModeRemise = (v: unknown): ModeRemise =>
  v === 'fournisseur' || v === 'retrait' ? v : 'livreur';

/** Réglage de remise d'un produit tel que lu en base (colonnes absentes = livreur Suguba). */
export function remiseDuProduit(p: { mode_remise?: unknown; frais_remise?: unknown } | null | undefined): RemiseOffre {
  const mode = normaliserModeRemise(p?.mode_remise);
  const frais = mode === 'fournisseur' ? Math.max(0, Math.round(Number(p?.frais_remise) || 0)) : 0;
  return { mode, frais };
}

/** Mode de remise d'une commande, lu dans son instantané de prix. */
export function modeRemiseCommande(pricingSnapshot: unknown): ModeRemise {
  const s = pricingSnapshot as { remise?: { mode?: unknown } } | null | undefined;
  return normaliserModeRemise(s?.remise?.mode);
}

/** La remise est-elle faite par le fournisseur (lui-même ou dans ses locaux) ? */
export const remiseParFournisseur = (mode: ModeRemise) => mode !== 'livreur';

export function libelleRemise(mode: ModeRemise, frais = 0): string {
  if (mode === 'fournisseur') return frais > 0 ? `Remise par le vendeur (${frais.toLocaleString('fr-FR')} F)` : 'Remise par le vendeur';
  if (mode === 'retrait') return 'À retirer chez le vendeur';
  return 'Livraison Suguba';
}

export function libelleTypeOffre(t: TypeOffre): string | null {
  if (t === 'service') return 'Service';
  if (t === 'produit_service') return 'Installation incluse';
  return null;
}
