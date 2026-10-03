/**
 * « Ma boutique est prête à X % » (lot 2 du chantier boutique, 2026-10-03) —
 * règles PURES, partagées par la carte de l'accueil (/api/reseller/me?avec=boutique)
 * et la vitrine du propriétaire.
 *
 * Une boutique ouverte sans logo, sans couverture ni articles choisis montre aux
 * clients une initiale sur fond vert et le catalogue Suguba : elle ne donne pas
 * envie d'acheter, et le revendeur ne savait pas quoi faire pour l'améliorer.
 * Chaque étape mène à son outil (crayon de la vitrine ou catalogue).
 *
 * « Boutique créée » est offerte d’emblée : une boutique neuve part à 1 étape sur 8,
 * jamais de 0 %. Lot 3 (2026-10-03) : + « Choisir un coup de cœur », qui mène à
 * « Mes articles ». Lot 4 (2026-10-03) : + « Partager ma boutique » (premier
 * partage = un lien suivi de cible boutique existe), qui ouvre la feuille de
 * partage sur la vitrine (?partager=1).
 */
import { PAGE_MES_ARTICLES, PORTE_MA_BOUTIQUE } from './porte-boutique';

/** Articles choisis à partir desquels la vitrine a l'air d'une vraie boutique. */
export const ARTICLES_POUR_ETRE_PRETE = 5;

export type CleEtapeBoutique = 'creee' | 'enseigne' | 'logo' | 'couverture' | 'accueil' | 'articles' | 'coupDeCoeur' | 'partage';
export type PanneauBoutique = 'logo' | 'couverture' | 'nom';

export interface EtapeBoutique {
  cle: CleEtapeBoutique;
  libelle: string;
  fait: boolean;
  /** Panneau d'édition de la vitrine qui accomplit l'étape. */
  editer?: PanneauBoutique;
  /** Adresse qui y mène depuis un autre écran (porte « Ma boutique » ou catalogue). */
  href: string;
}

export interface EtatBoutique {
  /** Nom de boutique choisi par le revendeur (calculé côté serveur, voir estEnseigne). */
  enseigne: boolean;
  logo: string | null | undefined;
  couverture: string | null | undefined;
  /** Mot d'accueil (accroche, stores.tagline). */
  accueil: string | null | undefined;
  /** Articles que la vitrine affiche ; null = compte illisible (l'étape reste à faire). */
  articles: number | null | undefined;
  /** Coups de cœur parmi les articles affichés ; null ou absent = illisible (l'étape reste à faire). */
  coupsDeCoeur?: number | null;
  /**
   * Un lien suivi de la boutique existe (lot 4) ; null ou absent = illisible
   * (l'étape reste à faire, jamais cochée par défaut).
   */
  partage?: boolean | null;
}

const rempli = (v: string | null | undefined) => Boolean(v && String(v).trim());
const versPanneau = (panneau: PanneauBoutique) => `${PORTE_MA_BOUTIQUE}?editer=${panneau}`;

export function etapesBoutique(etat: EtatBoutique): EtapeBoutique[] {
  return [
    { cle: 'creee', libelle: 'Boutique créée', fait: true, href: PORTE_MA_BOUTIQUE },
    { cle: 'enseigne', libelle: 'Choisir le nom de ma boutique', fait: Boolean(etat.enseigne), editer: 'nom', href: versPanneau('nom') },
    { cle: 'logo', libelle: 'Ajouter mon logo', fait: rempli(etat.logo), editer: 'logo', href: versPanneau('logo') },
    { cle: 'couverture', libelle: 'Ajouter une photo de couverture', fait: rempli(etat.couverture), editer: 'couverture', href: versPanneau('couverture') },
    { cle: 'accueil', libelle: 'Écrire un mot d’accueil', fait: rempli(etat.accueil), editer: 'nom', href: versPanneau('nom') },
    {
      cle: 'articles',
      libelle: `Choisir ${ARTICLES_POUR_ETRE_PRETE} articles`,
      fait: typeof etat.articles === 'number' && etat.articles >= ARTICLES_POUR_ETRE_PRETE,
      href: '/reseller/catalog',
    },
    {
      cle: 'coupDeCoeur',
      libelle: 'Choisir un coup de cœur',
      fait: typeof etat.coupsDeCoeur === 'number' && etat.coupsDeCoeur >= 1,
      href: PAGE_MES_ARTICLES,
    },
    { cle: 'partage', libelle: 'Partager ma boutique', fait: etat.partage === true, href: `${PORTE_MA_BOUTIQUE}?partager=1` },
  ];
}

/**
 * Prochaine étape proposée (carte « Ma boutique » de l'accueil). Relecture du lot 4
 * (2026-10-03) : une boutique masquée par Suguba ne se partage pas (la vitrine
 * n'ouvre pas la feuille et le bandeau n'a plus « Partager ») ; « Partager ma
 * boutique » menait donc à une vitrine où rien ne se passait. Elle n'est plus
 * proposée tant que la boutique n'est pas en ligne : l'étape suivante, ou rien.
 * Même règle que la liste de la vitrine (EnteteEditable).
 */
export function prochaineEtape<E extends Pick<EtapeBoutique, 'cle' | 'fait'>>(etapes: readonly E[], enLigne: boolean): E | null {
  return etapes.find((e) => !e.fait && (enLigne || e.cle !== 'partage')) ?? null;
}

/** Étapes faites, total et pourcentage arrondi (100 seulement quand tout est fait). */
export function progressionBoutique(etapes: Pick<EtapeBoutique, 'fait'>[]): { faites: number; total: number; pourcentage: number } {
  const total = etapes.length;
  const faites = etapes.filter((e) => e.fait).length;
  if (total === 0) return { faites: 0, total: 0, pourcentage: 100 };
  const pourcentage = faites === total ? 100 : Math.min(99, Math.round((faites / total) * 100));
  return { faites, total, pourcentage };
}
