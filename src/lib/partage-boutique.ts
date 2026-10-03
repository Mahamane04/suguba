/**
 * Partager ma boutique (lot 4 du chantier boutique, 2026-10-03) — règles PURES,
 * sans accès base ni navigateur : partagées par la feuille « Partager ma
 * boutique » (vitrine, accueil, Mes articles, Statistiques), « Mes partages » et
 * la vitrine (?rayon=).
 *
 * Avant : le bouton « Partager » envoyait « Ma boutique Suguba — <nom> » et
 * l'adresse brute. Rien ne disait ce qu'on y trouvait ni à quel prix, et aucun
 * clic n'était compté. Maintenant le message montre l'enseigne, 3 articles à leur
 * vrai prix (formatF), « vous payez à la livraison » et un lien suivi, réutilisé
 * pour un même canal (voir lienPermanent, src/lib/reseau/db.ts). On peut partager
 * toute la boutique, ses coups de cœur ou un rayon.
 *
 * Les rayons sont ceux qu'affiche la vitrine : les catégories des articles (hors
 * coups de cœur, qui ont leur section), dans l'ordre de leur premier article. Les
 * rayons maison viendront avec la migration du lot 6, sous la même forme de clé.
 */
import { formatF } from './montant';
import { titreVitrine } from './enseigne';
import { RAYON_COUPS_DE_COEUR, estCleRayon, lireRefBoutique } from './reseau/codes';
import type { ArticleBoutique } from './boutique-ordre';

export { RAYON_COUPS_DE_COEUR };

/** Rayon des articles sans catégorie, comme sur la vitrine. */
export const RAYON_SANS_CATEGORIE = 'Autres articles';

/** Articles cités dans le message : assez pour donner envie, assez court pour WhatsApp. */
export const ARTICLES_DANS_LE_MESSAGE = 3;

/** Article tel que le montre la vitrine (aucune donnée privée : ni gain ni prix de gros). */
export interface ArticlePartage {
  nom: string;
  /** Prix affiché dans la boutique ; sans prix, l'article n'est pas cité. */
  prix: number | null;
  categorie?: string | null;
  coupDeCoeur?: boolean;
  /** Faux pour un article épuisé : affiché en fin de rayon, jamais cité. */
  enStock?: boolean;
}

/**
 * Articles de « Mes articles » (route privée) tels que les montre la vitrine :
 * affichés ou épuisés, au prix affiché. Rien d'autre n'en sort (ni gain, ni prix
 * minimal) : le message est public.
 */
export function versArticlesPartage(
  articles: readonly Pick<ArticleBoutique, 'nom' | 'prixVitrine' | 'categorie' | 'coupDeCoeur' | 'etat'>[],
): ArticlePartage[] {
  return articles
    .filter((a) => a.etat === 'affiche' || a.etat === 'epuise')
    .map((a) => ({ nom: a.nom, prix: a.prixVitrine, categorie: a.categorie ?? null, coupDeCoeur: a.coupDeCoeur, enStock: a.etat === 'affiche' }));
}

/** Ce qu'on partage : toute la boutique (cle null), les coups de cœur ou un rayon. */
export interface ChoixPartage {
  cle: string | null;
  libelle: string;
  nombre: number;
}

/**
 * Clé d'un rayon à partir de son nom (« Électroménager » → « electromenager »),
 * 40 caractères au plus. Jamais la clé réservée des coups de cœur.
 */
export function cleRayon(categorie: string | null | undefined): string {
  const nom = String(categorie || '').trim() || RAYON_SANS_CATEGORIE;
  const cle = nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // « œ » et « æ » ne se décomposent pas : « cœur » donnerait « c-ur ».
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '') || 'rayon';
  return cle === RAYON_COUPS_DE_COEUR ? `${cle.slice(0, 34)}-rayon` : cle;
}

const nomDuRayon = (a: ArticlePartage) => String(a.categorie || '').trim() || RAYON_SANS_CATEGORIE;

/** Rayons de la vitrine (hors coups de cœur), dans l'ordre de leur premier article. */
export function rayonsDeLaVitrine(articles: readonly ArticlePartage[]): ChoixPartage[] {
  const rayons = new Map<string, ChoixPartage>();
  for (const a of articles) {
    if (a.coupDeCoeur) continue;
    const nom = nomDuRayon(a);
    const cle = cleRayon(nom);
    const rayon = rayons.get(cle);
    if (rayon) rayon.nombre += 1;
    else rayons.set(cle, { cle, libelle: nom, nombre: 1 });
  }
  return Array.from(rayons.values());
}

/**
 * Gros boutons de la feuille : toute la boutique, les coups de cœur s'il y en a,
 * puis chaque rayon dès 2 rayons (avec un seul, il serait la boutique entière ;
 * même règle que les pastilles de la vitrine).
 */
export function choixDePartage(articles: readonly ArticlePartage[]): ChoixPartage[] {
  const coups = articles.filter((a) => a.coupDeCoeur).length;
  const rayons = rayonsDeLaVitrine(articles);
  return [
    { cle: null, libelle: 'Toute ma boutique', nombre: articles.length },
    ...(coups > 0 ? [{ cle: RAYON_COUPS_DE_COEUR, libelle: 'Mes coups de cœur', nombre: coups }] : []),
    ...(rayons.length >= 2 ? rayons : []),
  ];
}

/** Articles d'un choix, dans l'ordre de la vitrine (coups de cœur d'abord). */
export function articlesDuChoix(articles: readonly ArticlePartage[], cle: string | null): ArticlePartage[] {
  const coups = articles.filter((a) => a.coupDeCoeur);
  const autres = articles.filter((a) => !a.coupDeCoeur);
  if (!cle) return [...coups, ...autres];
  if (cle === RAYON_COUPS_DE_COEUR) return coups;
  return autres.filter((a) => cleRayon(nomDuRayon(a)) === cle);
}

/**
 * Les articles cités dans le message : en stock et avec un prix, dans l'ordre de
 * la vitrine. Un article épuisé n'est jamais cité : le client ne pourrait pas
 * l'acheter.
 */
export function articlesAAnnoncer(articles: readonly ArticlePartage[], cle: string | null, nombre = ARTICLES_DANS_LE_MESSAGE): ArticlePartage[] {
  return articlesDuChoix(articles, cle)
    .filter((a) => a.enStock !== false && typeof a.prix === 'number' && a.prix > 0)
    .slice(0, nombre);
}

/**
 * Message WhatsApp prérempli : enseigne (ou « La sélection de Awa D. »), ce qu'on
 * partage, 3 articles à leur vrai prix, « vous payez à la livraison », le lien.
 * Les prix viennent de la vitrine (prix affiché, formatF) : jamais un montant inventé.
 */
export function texteBoutique(params: {
  identite: { nom: string; enseigne: boolean };
  choix?: Pick<ChoixPartage, 'cle' | 'libelle'> | null;
  articles: readonly ArticlePartage[];
  url: string;
}): string {
  const titre = titreVitrine({ type: 'revendeur', nom: params.identite.nom, enseigne: params.identite.enseigne });
  const cle = params.choix?.cle || null;
  const entete = !cle
    ? `🛍️ *${titre}* sur Suguba`
    : cle === RAYON_COUPS_DE_COEUR
      ? `❤️ Mes coups de cœur · *${titre}*`
      : `🛍️ ${params.choix?.libelle || 'Mon rayon'} · *${titre}*`;
  const lignes = params.articles.map((a) => `• ${a.nom} : ${formatF(a.prix)}`);
  return [
    entete,
    ...(lignes.length ? ['', ...lignes] : []),
    '',
    '✅ Vous payez à la livraison, livré chez vous à Bamako.',
    `👉 ${params.url}`,
  ].join('\n');
}

/** Adresse brute (repli quand le lien suivi n'est pas prêt) : /boutique/<slug>[?rayon=cle]. */
export function adresseBoutique(origine: string, slug: string, rayon?: string | null): string {
  const base = `${origine.replace(/\/$/, '')}/boutique/${encodeURIComponent(slug)}`;
  return rayon && estCleRayon(rayon) ? `${base}?rayon=${rayon}` : base;
}

/** « electromenager » → « Electromenager » (libellé de secours d'un ancien lien). */
function rayonLisible(cle: string): string {
  const texte = cle.replace(/-+/g, ' ').trim();
  return texte ? texte.charAt(0).toUpperCase() + texte.slice(1) : 'Rayon';
}

/**
 * Libellé d'un lien de boutique dans « Mes partages » : « Ma boutique »,
 * « Ma boutique · Coups de cœur » ou « Ma boutique · <rayon> ». Avant, la ligne
 * affichait l'adresse brute (« awa-mode »).
 */
export function libellePartageBoutique(ref: string | null | undefined, libelle?: string | null): string {
  const { rayon } = lireRefBoutique(ref);
  if (!rayon) return 'Ma boutique';
  if (rayon === RAYON_COUPS_DE_COEUR) return 'Ma boutique · Coups de cœur';
  return `Ma boutique · ${String(libelle || '').trim() || rayonLisible(rayon)}`;
}

/** Nom de rayon reçu par la route du partage : texte court, sans balise ni caractère de contrôle. */
export function nomDeRayonPropre(brut: unknown): string | null {
  if (typeof brut !== 'string') return null;
  const nom = brut.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40).trim();
  return nom || null;
}
