/**
 * Vérifications et badges — logique PURE (§ 5 du cahier des charges).
 *
 * Exigence explicite : « ne pas coder les badges en dur, mais en faire un
 * système extensible ». Ici, un badge est une simple chaîne ; ce catalogue
 * décrit ceux que l'interface sait présenter, et un badge inconnu s'affiche
 * proprement plutôt que de casser l'écran.
 */

export type TypeVerification = 'phone' | 'email' | 'identity' | 'selfie' | 'location' | 'business';

export const VERIFICATIONS: { valeur: TypeVerification; libelle: string; poids: number; aide: string }[] = [
  { valeur: 'phone',    libelle: 'Téléphone',        poids: 25, aide: 'Suguba vous appelle pour confirmer que ce numéro est bien le vôtre.' },
  { valeur: 'email',    libelle: 'Adresse e-mail',   poids: 10, aide: 'Utile pour récupérer votre compte.' },
  { valeur: 'identity', libelle: 'Pièce d’identité', poids: 30, aide: 'Carte NINA, passeport ou permis.' },
  { valeur: 'selfie',   libelle: 'Photo de vous',    poids: 15, aide: 'Une photo nette, visage découvert.' },
  { valeur: 'location', libelle: 'Localisation',     poids: 15, aide: 'Votre quartier, pour les livraisons.' },
  { valeur: 'business', libelle: 'Entreprise',       poids: 5,  aide: 'Registre de commerce, pour les fournisseurs.' },
];

export type EtatVerification = 'absent' | 'pending' | 'approved' | 'rejected';

/**
 * Pourcentage de profil vérifié. Pondéré : le téléphone et la pièce
 * d'identité valent plus qu'une adresse e-mail, parce qu'ils engagent plus.
 * Seules les vérifications APPROUVÉES comptent — sinon déposer un document
 * flou suffirait à afficher « profil vérifié ».
 */
export function pourcentageVerifie(etats: Partial<Record<TypeVerification, EtatVerification>>): number {
  const total = VERIFICATIONS.reduce((s, v) => s + v.poids, 0);
  const acquis = VERIFICATIONS.reduce((s, v) => s + (etats[v.valeur] === 'approved' ? v.poids : 0), 0);
  return Math.round((acquis / total) * 100);
}

export interface Badge {
  cle: string;
  libelle: string;
  description: string;
  /** Attribué automatiquement par une règle, ou à la main par un admin. */
  automatique: boolean;
}

export const CATALOGUE_BADGES: Badge[] = [
  { cle: 'profil_verifie',      libelle: 'Profil vérifié',        description: 'Identité et selfie validés par Suguba.', automatique: true },
  { cle: 'localisation_verifiee', libelle: 'Localisation vérifiée', description: 'Quartier confirmé.', automatique: true },
  { cle: 'revendeur_verifie',   libelle: 'Revendeur vérifié',     description: 'Revendeur contrôlé par Suguba.', automatique: false },
  { cle: 'fournisseur_verifie', libelle: 'Fournisseur vérifié',   description: 'Entreprise contrôlée par Suguba.', automatique: false },
  { cle: 'livreur_verifie',     libelle: 'Livreur vérifié',       description: 'Livreur contrôlé par Suguba.', automatique: false },
  { cle: 'boutique_verifiee',   libelle: 'Boutique vérifiée',     description: 'Boutique contrôlée par Suguba.', automatique: false },
  { cle: 'top_vendeur',         libelle: 'Top vendeur',           description: 'Parmi les meilleurs vendeurs du mois.', automatique: true },
  { cle: 'revendeur_actif',     libelle: 'Revendeur actif',       description: 'Au moins une vente ce mois-ci.', automatique: true },
  { cle: 'fournisseur_premium', libelle: 'Fournisseur premium',   description: 'Offre mise en avant sur Suguba.', automatique: false },
  { cle: 'livraison_excellente', libelle: 'Excellent taux de livraison', description: 'Plus de 95 % de livraisons réussies.', automatique: true },
];

export function badge(cle: string): Badge {
  return (
    CATALOGUE_BADGES.find((b) => b.cle === cle) || {
      cle,
      libelle: cle.replace(/_/g, ' '),
      description: '',
      automatique: false,
    }
  );
}

/**
 * Badges automatiques mérités par un compte, d'après ses vérifications et ses
 * résultats. Rendue pure pour être testable et pour qu'un même compte donne
 * toujours le même résultat, où que la fonction soit appelée.
 */
export function badgesAutomatiques(params: {
  verifications: Partial<Record<TypeVerification, EtatVerification>>;
  ventesCeMois: number;
  livraisonsReussies: number;
  livraisonsTotales: number;
  rangVendeur?: number | null;
}): string[] {
  const acquis: string[] = [];
  const v = params.verifications;
  if (v.identity === 'approved' && v.selfie === 'approved') acquis.push('profil_verifie');
  if (v.location === 'approved') acquis.push('localisation_verifiee');
  if (params.ventesCeMois > 0) acquis.push('revendeur_actif');
  if (params.rangVendeur != null && params.rangVendeur > 0 && params.rangVendeur <= 10) acquis.push('top_vendeur');
  if (params.livraisonsTotales >= 20 && params.livraisonsReussies / params.livraisonsTotales >= 0.95) {
    acquis.push('livraison_excellente');
  }
  return acquis;
}
