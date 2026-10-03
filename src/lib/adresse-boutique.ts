/**
 * Adresse à l'enseigne d'une boutique — règles PURES (lot 8 du chantier boutique,
 * 2026-10-03). Sans accès à la base : utilisées par le serveur (route
 * /api/reseller/boutique/adresse, changerAdresse) comme par l'écran
 * « Personnaliser », pour que l'aperçu montre exactement ce qui sera enregistré.
 *
 * Décision du fondateur : un revendeur peut changer l'adresse de sa boutique UNE
 * seule fois. Beaucoup ont une adresse /boutique/prenom-nom, attribuée au premier
 * accès à partir du nom complet du compte ; l'ancienne adresse redirige pour
 * toujours vers la nouvelle (table store_slug_aliases), les liens et QR codes déjà
 * partagés restent donc valides.
 *
 * Le format est celui que vérifie la fonction SQL changer_adresse_boutique
 * (supabase/A-EXECUTER-2026-10-03-vitrine-boutique.sql) : lettres minuscules et
 * chiffres, séparés par un seul tiret, de 3 à 50 caractères. Ce que la base ne
 * sait pas est refusé ICI, avant de l'appeler : une adresse réservée à Suguba
 * (« suguba », « admin »…), une adresse sans lettre, un numéro de téléphone (pas de
 * contact du revendeur sur sa vitrine pour l'instant : la commande reste sur Suguba).
 */
import { adresseReservee } from './enseigne';
import { normaliserCodeRevendeur } from './ancrage-revendeur';
import { estCleRayon, normaliserCodeLien } from './reseau/codes';

export const ADRESSE_MIN = 3;
export const ADRESSE_MAX = 50;

/**
 * Texte brut accepté avant toute transformation : aucune adresse légitime n'en
 * approche, et rien ne limite la taille d'une requête (même précaution que
 * TEXTE_BRUT_MAX, src/lib/boutique-reglages.ts).
 */
export const ADRESSE_BRUTE_MAX = 120;

/**
 * « Chez Awa — Mode & Beauté » → « chez-awa-mode-beaute ». Même transformation que
 * slugifier (src/lib/shop.ts), qui donne leur adresse aux nouvelles boutiques, sans
 * son repli « boutique » : un texte sans lettre ni chiffre donne '' (rien à proposer).
 * Coupée à 50 caractères, jamais terminée par un tiret.
 */
export function adresseDepuis(texte: unknown): string {
  if (typeof texte !== 'string') return '';
  return texte
    .slice(0, ADRESSE_BRUTE_MAX)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, ADRESSE_MAX)
    .replace(/-+$/, '');
}

/** Le format exact que la base accepte (même expression que la fonction SQL). */
export function adresseBienFormee(adresse: string): boolean {
  return adresse.length >= ADRESSE_MIN && adresse.length <= ADRESSE_MAX && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(adresse);
}

/** 8 chiffres ou plus, collés ou séparés par un tiret : un numéro de téléphone. */
const NUMERO = /(?:\d-?){8,}/;

/**
 * Pourquoi cette adresse (déjà passée par adresseDepuis) est refusée, ou null si
 * elle convient. `actuelle` : l'adresse d'aujourd'hui, pour dire « c'est déjà la
 * vôtre » sans interroger la base. Ne dit rien de la disponibilité : seul le
 * serveur sait si une autre boutique porte, ou a porté, cette adresse.
 */
export function refusAdresse(adresse: string, actuelle?: string | null): string | null {
  if (!adresse) return 'Écrivez l’adresse voulue : des lettres et des chiffres.';
  if (adresse.length < ADRESSE_MIN) return `Au moins ${ADRESSE_MIN} caractères.`;
  if (!adresseBienFormee(adresse)) return 'Des lettres sans accent, des chiffres et des tirets seulement.';
  if (!/[a-z]/.test(adresse)) return 'L’adresse doit contenir des lettres.';
  if (NUMERO.test(adresse)) return 'Pas de numéro de téléphone dans l’adresse : la commande se passe sur Suguba.';
  if (adresseReservee(adresse)) return 'Cette adresse est réservée à Suguba. Choisissez-en une autre.';
  if (actuelle && adresse === actuelle.toLowerCase()) return 'C’est déjà l’adresse de votre boutique.';
  return null;
}

/**
 * Adresse proposée dans le champ : celle du nom que voient les clients (l'enseigne,
 * ou « Awa D. »), si elle convient et diffère de l'adresse actuelle. '' sinon : le
 * revendeur écrit la sienne.
 */
export function adresseProposee(nomPublic: string | null | undefined, actuelle: string): string {
  const proposee = adresseDepuis(nomPublic || '');
  return proposee && refusAdresse(proposee, actuelle) === null ? proposee : '';
}

/**
 * Réponses de la fonction SQL changer_adresse_boutique, plus celles du code :
 *  - reservee      : refusée avant d'appeler la base (adresse réservée à Suguba,
 *                    sans lettre, numéro de téléphone : voir refusAdresse) ;
 *  - indisponible  : la fonction ou la table n'existe pas encore (SQL pas exécuté),
 *                    l'option est simplement absente ;
 *  - erreur        : la base n'a pas répondu, rien n'a changé.
 */
export type ResultatAdresse =
  | 'ok' | 'invalide' | 'introuvable' | 'identique' | 'deja_change' | 'pris'
  | 'reservee' | 'indisponible' | 'erreur';

/** Disponibilité d'une adresse demandée, telle que la route la renvoie. */
export type EtatAdresseDemandee = 'libre' | 'prise' | 'refusee';

export const ADRESSE_PRISE = 'Cette adresse est déjà prise. Essayez-en une autre.';
export const ADRESSE_DEJA_CHANGEE = 'Vous avez déjà changé l’adresse de votre boutique : ce changement n’est possible qu’une fois.';
export const ADRESSE_INDISPONIBLE = 'Changement d’adresse impossible pour le moment. Réessayez.';

/** Ce que l'écran et la route répondent pour chaque résultat autre que « ok ». */
export function refusChangement(resultat: Exclude<ResultatAdresse, 'ok'>, optionAbsente: string): { erreur: string; statut: number } {
  switch (resultat) {
    case 'pris': return { erreur: ADRESSE_PRISE, statut: 409 };
    case 'deja_change': return { erreur: ADRESSE_DEJA_CHANGEE, statut: 409 };
    case 'identique': return { erreur: 'C’est déjà l’adresse de votre boutique.', statut: 400 };
    case 'invalide': return { erreur: 'Des lettres sans accent, des chiffres et des tirets seulement, de 3 à 50 caractères.', statut: 400 };
    case 'reservee': return { erreur: 'Cette adresse n’est pas permise. Choisissez-en une autre.', statut: 400 };
    case 'introuvable': return { erreur: 'Boutique introuvable.', statut: 404 };
    case 'indisponible': return { erreur: optionAbsente, statut: 409 };
    default: return { erreur: ADRESSE_INDISPONIBLE, statut: 503 };
  }
}

/** Un paramètre d'adresse seul (une valeur répétée est ignorée). */
const seul = (v: string | string[] | undefined): string | null => (typeof v === 'string' ? v : null);

/**
 * Où mène une ANCIENNE adresse de boutique : la nouvelle, /boutique/<adresse>, en
 * gardant seulement ce qui attribue la vente et ouvre le bon rayon —
 *  - ?rayon=<cle> (lien d'un rayon ou des coups de cœur) ;
 *  - ?ref=<code revendeur> (le client reste rattaché à son revendeur) ;
 *  - ?via=<code du lien suivi> (la visite reste comptée pour ce lien, /go/<code>).
 * Chacun est validé comme à l'arrivée normale ; tout autre paramètre est abandonné
 * (?editer=, ?partager=, ?next=//ailleurs…) : la redirection reste interne à Suguba.
 * Même ordre que destinationDuLien (src/lib/reseau/codes.ts).
 */
export function adresseDeRedirection(
  slug: string,
  recherche: { rayon?: string | string[]; ref?: string | string[]; via?: string | string[] } = {},
): string {
  const suite = new URLSearchParams();
  const rayon = seul(recherche.rayon);
  if (rayon && estCleRayon(rayon)) suite.set('rayon', rayon);
  const ref = normaliserCodeRevendeur(seul(recherche.ref));
  if (ref) suite.set('ref', ref);
  const via = normaliserCodeLien(seul(recherche.via));
  if (via) suite.set('via', via);
  const requete = suite.toString();
  return `/boutique/${encodeURIComponent(slug)}${requete ? `?${requete}` : ''}`;
}
