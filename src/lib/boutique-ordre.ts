/**
 * Ordre des articles et « Coups de cœur » de la boutique d'un revendeur (lot 3
 * du chantier boutique, 2026-10-03) — règles PURES, sans migration.
 *
 * Convention : la colonne existante reseller_shop_items.position (INTEGER NOT
 * NULL DEFAULT 0, sans CHECK) range la vitrine. Une position NÉGATIVE signifie
 * « coup de cœur » : de -k à -1 pour les k coups de cœur, puis 0 à n-1 pour les
 * autres articles. Aucun autre lecteur de la table ne lit position (offres des
 * revendeurs, présentation fournisseur, « Mes revendeurs »…), et la vitrine
 * trie déjà par position croissante : les coups de cœur passent devant sans
 * rien changer ailleurs.
 *
 * Pourquoi ce module : reseller_shop_items a un EFFET COMMERCIAL (offre du
 * revendeur sur la fiche produit, blocage de l'achat direct au prix de gros).
 * Ranger ou mettre en coup de cœur ne doit donc jamais supprimer ni réinsérer
 * de ligne — une ligne retirée entre-temps serait recréée, avec son offre.
 * Toute position écrite vient d'ici ; la route /api/reseller/shop fait des
 * UPDATE ligne par ligne, et un test refuse toute autre écriture de position.
 */

/** Coups de cœur au plus (décision du fondateur). */
export const COUPS_DE_COEUR_MAX = 6;

/** Articles au plus dans une boutique (même limite que l'ajout depuis le catalogue). */
export const ARTICLES_MAX = 60;

/** Étiquette « Nouveau » : jours après l'ajout de l'article à la boutique (décision du fondateur). */
export const NOUVEAU_JOURS = 14;

export interface PositionArticle {
  id: string;
  position: number;
}

/**
 * État d'un article de « Mes articles » : 'affiche', 'epuise' (affiché, en fin de
 * rayon), 'retire' (plus en vente) ou 'sans_gain' (plus de commission, ou prix
 * sous le plancher). Les deux derniers ne s'affichent plus dans la vitrine.
 */
export type EtatArticle = 'affiche' | 'epuise' | 'retire' | 'sans_gain';

/** Article de « Mes articles », renvoyé par la route PRIVÉE /api/reseller/boutique/articles. */
export interface ArticleBoutique {
  id: string;
  slug: string | null;
  nom: string;
  image: string | null;
  /** Prix affiché dans la boutique. */
  prixVitrine: number | null;
  /** Ce que rapporte une vente ; null si l'article n'est plus en vente. */
  gain: number | null;
  modePrix: 'gros' | 'fixe';
  /** Prix choisi par le revendeur (prix de gros seulement). */
  monPrix: number | null;
  prixMinimal: number | null;
  coupDeCoeur: boolean;
  ajouteLe: string | null;
  etat: EtatArticle;
  /** Rayon de la vitrine (catégorie du produit) : « Partager ce rayon » (lot 4, 2026-10-03). */
  categorie?: string | null;
}

/** Pastille des articles que la vitrine montre autrement (null : rien à signaler). */
export const PASTILLE_ETAT: Record<EtatArticle, string | null> = {
  affiche: null,
  epuise: 'Épuisé',
  retire: 'Plus en vente',
  sans_gain: 'Sans gain',
};

/** Ligne de reseller_shop_items telle qu'elle est lue. */
export interface LigneSelection {
  product_id: string;
  position?: number | null;
  added_at?: string | null;
}

/** Une position négative = coup de cœur. Une position absente ou illisible n'en est pas un. */
export function estCoupDeCoeur(position: number | null | undefined): boolean {
  return typeof position === 'number' && Number.isFinite(position) && position < 0;
}

/**
 * Article ajouté à la boutique depuis moins de 14 jours. Date absente ou
 * illisible : pas « Nouveau » (jamais d'étiquette inventée).
 */
export function estNouveau(ajouteLe: string | null | undefined, maintenant: number = Date.now()): boolean {
  if (!ajouteLe) return false;
  const t = Date.parse(ajouteLe);
  if (!Number.isFinite(t)) return false;
  return maintenant - t >= -60_000 && maintenant - t < NOUVEAU_JOURS * 24 * 3600 * 1000;
}

/**
 * Positions à écrire pour un ordre choisi : les coups de cœur de -k à -1, dans
 * l'ordre où ils apparaissent dans `ordre`, puis les autres articles de 0 à n-1.
 * Refusé (erreur, rien à écrire) : identifiant vide ou en double, plus de 60
 * articles, plus de 6 coups de cœur, coup de cœur absent de l'ordre.
 */
export function positionsPourOrdre(
  ordre: readonly string[],
  coups: readonly string[],
): { positions: PositionArticle[]; erreur?: undefined } | { erreur: string; positions?: undefined } {
  if (!Array.isArray(ordre) || !Array.isArray(coups)) return { erreur: 'Ordre illisible.' };
  if (!ordre.every((id) => typeof id === 'string' && id.length > 0) || !coups.every((id) => typeof id === 'string' && id.length > 0)) {
    return { erreur: 'Ordre illisible.' };
  }
  if (new Set(ordre).size !== ordre.length || new Set(coups).size !== coups.length) return { erreur: 'Un article apparaît deux fois.' };
  if (ordre.length > ARTICLES_MAX) return { erreur: `${ARTICLES_MAX} articles au plus.` };
  if (coups.length > COUPS_DE_COEUR_MAX) return { erreur: `${COUPS_DE_COEUR_MAX} coups de cœur au plus.` };
  const dansOrdre = new Set(ordre);
  if (!coups.every((id) => dansOrdre.has(id))) return { erreur: 'Un coup de cœur n’est pas dans votre boutique.' };

  const sontCoups = new Set(coups);
  const enTete = ordre.filter((id) => sontCoups.has(id));
  const suite = ordre.filter((id) => !sontCoups.has(id));
  return {
    positions: [
      ...enTete.map((id, i) => ({ id, position: i - enTete.length })),
      ...suite.map((id, i) => ({ id, position: i })),
    ],
  };
}

/**
 * Lignes à écrire pour passer des positions actuelles aux positions voulues :
 * seulement celles dont la place change, et d'abord celles qui deviennent ≥ 0.
 *
 * Relecture du lot 3 (2026-10-03) : les écritures se font une par une et
 * s'arrêtent à la première erreur. Coups de cœur écrits d'abord, un article
 * sortant des coups de cœur, écrit en dernier, gardait sa position négative
 * si son écriture échouait : la vitrine montrait 7 coups de cœur et tout
 * nouvel enregistrement était refusé (« 6 coups de cœur au plus »). En
 * écrivant d'abord les positions ≥ 0, les seules positions négatives restantes
 * appartiennent aux nouveaux coups de cœur : 6 au plus, à tout moment.
 */
export function positionsAEcrire(
  positions: readonly PositionArticle[],
  actuelles: ReadonlyMap<string, number>,
): PositionArticle[] {
  const changent = positions.filter((p) => actuelles.get(p.id) !== p.position);
  return [...changent.filter((p) => p.position >= 0), ...changent.filter((p) => p.position < 0)];
}

/**
 * Position d'un article qu'on ajoute : après le dernier, jamais négative (un
 * ajout n'est pas un coup de cœur). Remplace « le nombre d'articles » (count),
 * qui donnait deux fois la même position après un retrait.
 */
export function positionAjout(positions: readonly (number | null | undefined)[]): number {
  let max = -1;
  for (const p of positions) if (typeof p === 'number' && Number.isFinite(p) && p > max) max = p;
  return max + 1;
}

/**
 * L'ordre envoyé contient-il exactement les articles de la boutique (ni oubli,
 * ni doublon, ni article d'un autre) ? Sinon la boutique a changé ailleurs
 * (autre onglet, catalogue) et rien ne doit être écrit.
 */
export function controlerEnsemble(selection: readonly string[], ids: readonly string[]): boolean {
  if (!Array.isArray(ids) || ids.length !== selection.length) return false;
  const attendus = new Set(selection);
  const vus = new Set<string>();
  for (const id of ids) {
    if (!attendus.has(id) || vus.has(id)) return false;
    vus.add(id);
  }
  return vus.size === attendus.size;
}

/**
 * Sélection dans l'ordre de la vitrine : position croissante, puis date d'ajout
 * (positions en double laissées par l'ancien ajout), puis identifiant. Tri
 * stable et identique partout (vitrine, « Mes articles »).
 */
export function trierSelection<T extends LigneSelection>(lignes: readonly T[]): T[] {
  const pos = (l: T) => (typeof l.position === 'number' && Number.isFinite(l.position) ? l.position : 0);
  const date = (l: T) => (l.added_at ? Date.parse(l.added_at) || 0 : 0);
  return [...lignes].sort((a, b) => pos(a) - pos(b) || date(a) - date(b) || String(a.product_id).localeCompare(String(b.product_id)));
}

// ── Rangement local de « Mes articles » (rien n'est écrit avant « Enregistrer ») ──

/** Deux blocs, dans l'ordre de la vitrine : coups de cœur, puis autres articles. */
export interface Rangement {
  coups: string[];
  autres: string[];
}

/** Rangement lu : articles déjà dans l'ordre de la vitrine (voir trierSelection). */
export function rangementDe(articles: readonly { id: string; coupDeCoeur: boolean }[]): Rangement {
  return {
    coups: articles.filter((a) => a.coupDeCoeur).map((a) => a.id),
    autres: articles.filter((a) => !a.coupDeCoeur).map((a) => a.id),
  };
}

export function memeRangement(a: Rangement, b: Rangement): boolean {
  return a.coups.join('\n') === b.coups.join('\n') && a.autres.join('\n') === b.autres.join('\n');
}

/** Ordre complet envoyé à la route : coups de cœur d'abord. */
export function ordreDe(r: Rangement): string[] {
  return [...r.coups, ...r.autres];
}

/**
 * Coup de cœur ajouté (en fin des coups de cœur) ou retiré (en tête des autres
 * articles, il reste en haut de la vitrine). null : déjà 6 coups de cœur.
 */
export function basculerCoupDeCoeur(r: Rangement, id: string): Rangement | null {
  if (r.coups.includes(id)) return { coups: r.coups.filter((x) => x !== id), autres: [id, ...r.autres.filter((x) => x !== id)] };
  if (!r.autres.includes(id)) return r;
  if (r.coups.length >= COUPS_DE_COEUR_MAX) return null;
  return { coups: [...r.coups, id], autres: r.autres.filter((x) => x !== id) };
}

function dansSonBloc(r: Rangement, id: string, deplacer: (bloc: string[], i: number) => string[]): Rangement {
  for (const cle of ['coups', 'autres'] as const) {
    const i = r[cle].indexOf(id);
    if (i >= 0) return { ...r, [cle]: deplacer(r[cle], i) };
  }
  return r;
}

/** Monte l'article d'un cran dans son bloc (sans effet s'il est déjà en tête). */
export function monterArticle(r: Rangement, id: string): Rangement {
  return dansSonBloc(r, id, (bloc, i) => {
    if (i === 0) return bloc;
    const copie = [...bloc];
    [copie[i - 1], copie[i]] = [copie[i], copie[i - 1]];
    return copie;
  });
}

/** Met l'article en tête de son bloc. Avec les rayons, il remonte surtout son rayon. */
export function mettreEnPremier(r: Rangement, id: string): Rangement {
  return dansSonBloc(r, id, (bloc, i) => (i === 0 ? bloc : [bloc[i], ...bloc.slice(0, i), ...bloc.slice(i + 1)]));
}

/** Rangement sans l'article (après un retrait confirmé). */
export function sansArticle(r: Rangement, id: string): Rangement {
  return { coups: r.coups.filter((x) => x !== id), autres: r.autres.filter((x) => x !== id) };
}

/**
 * La vitrine montre-t-elle la sélection du revendeur ? Elle sert les articles
 * affichés ET les épuisés (en fin de rayon) ; elle ne montre le catalogue
 * Suguba que si aucun ne l'est (lib/shop.ts, chargerBoutiqueRevendeur).
 */
export function vitrineMontreSelection(articles: readonly Pick<ArticleBoutique, 'etat'>[]): boolean {
  return articles.some((a) => a.etat === 'affiche' || a.etat === 'epuise');
}

/**
 * Trois offres de la carte « Ma boutique » du créateur de visuels : d'abord les
 * coups de cœur, puis la suite de la sélection, aux prix affichés dans la
 * vitrine. Les articles en stock d'abord ; la carte ne promet rien que la
 * boutique ne montre.
 *
 * Relecture du lot 3 (2026-10-03) : quand tous les articles sont épuisés, la
 * vitrine les montre quand même (en fin de rayon) ; la carte reprenait alors le
 * catalogue Suguba, au prix public. Elle prend maintenant ces épuisés en repli.
 * Le catalogue n'est repris (par l'écran) que si vitrineMontreSelection est faux.
 */
export function selectionPourCarte(
  articles: readonly Pick<ArticleBoutique, 'nom' | 'image' | 'prixVitrine' | 'coupDeCoeur' | 'etat'>[],
  nombre = 3,
): { nom: string; prix: number; image: string | null }[] {
  const avecPrix = articles.filter((a) => typeof a.prixVitrine === 'number' && a.prixVitrine > 0);
  const enStock = avecPrix.filter((a) => a.etat === 'affiche');
  const montres = enStock.length > 0 ? enStock : avecPrix.filter((a) => a.etat === 'epuise');
  return [...montres.filter((a) => a.coupDeCoeur), ...montres.filter((a) => !a.coupDeCoeur)]
    .slice(0, nombre)
    .map((a) => ({ nom: a.nom, prix: a.prixVitrine as number, image: a.image }));
}
