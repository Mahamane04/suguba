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
 * coups de cœur, qui ont leur section), dans l'ordre de leur premier article.
 *
 * Lot 6 (2026-10-03) : les rayons MAISON du revendeur (stores.reglages, validés par
 * src/lib/boutique-reglages.ts) passent devant, dans l'ordre qu'il a choisi, sous la
 * même forme de clé. Sans rayon maison (base pas encore migrée, ou aucun rayon
 * créé), tout se comporte comme avant.
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
  /** Identifiant de l'article (déjà public sur la vitrine) : retrouve son rayon maison (lot 6). */
  id?: string;
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
  articles: readonly (Pick<ArticleBoutique, 'nom' | 'prixVitrine' | 'categorie' | 'coupDeCoeur' | 'etat'> & { id?: string })[],
): ArticlePartage[] {
  return articles
    .filter((a) => a.etat === 'affiche' || a.etat === 'epuise')
    .map((a) => ({
      ...(a.id ? { id: a.id } : {}),
      nom: a.nom, prix: a.prixVitrine, categorie: a.categorie ?? null, coupDeCoeur: a.coupDeCoeur, enStock: a.etat === 'affiche',
    }));
}

/** Ce qu'on partage : toute la boutique (cle null), les coups de cœur ou un rayon. */
export interface ChoixPartage {
  cle: string | null;
  libelle: string;
  nombre: number;
}

/** Longueur d'une clé de rayon (estCleRayon, src/lib/reseau/codes.ts). */
const CLE_MAX = 40;

/**
 * Empreinte courte et stable d'un texte : FNV-1a sur 32 bits, écrite en base 36
 * (7 caractères [a-z0-9]). Calcul pur, identique sur le serveur et dans le navigateur.
 */
function empreinte(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(7, '0');
}

/**
 * Clé d'un rayon à partir de son nom (« Électroménager » → « electromenager »),
 * 40 caractères au plus. Jamais la clé réservée des coups de cœur.
 *
 * Relecture du lot 6 (2026-10-03) : la clé ne garde que a-z et 0-9. Un nom écrit
 * en arabe ou en n'ko retombait donc sur « rayon », quel qu'il soit, et deux noms
 * bambara comme « Fɛrɛ » et « Fɔrɔ » sur « f-r » : le revendeur ne pouvait créer
 * qu'UN rayon dans ces écritures (« Vous avez déjà un rayon de ce nom », à tort),
 * et la vitrine aurait fondu deux catégories en une. Dès qu'une lettre ou un
 * chiffre du nom ne peut pas s'écrire dans la clé, elle se termine par une
 * empreinte du nom entier : deux noms différents ont deux clés différentes, et le
 * même nom a toujours la même. Les noms qui s'écrivent en a-z et 0-9 (accents
 * compris) gardent exactement leur clé d'avant.
 */
export function cleRayon(categorie: string | null | undefined): string {
  const nom = String(categorie || '').trim() || RAYON_SANS_CATEGORIE;
  const plat = nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // « œ » et « æ » ne se décomposent pas : « cœur » donnerait « c-ur ».
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae');
  const lisible = plat.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  // Les mots du nom, sans ponctuation ni emoji (comme la clé, qui les ignore déjà).
  const mots = plat.replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();
  let cle: string;
  if (/(?![a-z0-9])[\p{L}\p{N}]/u.test(mots)) {
    const marque = empreinte(mots);
    cle = `${lisible.slice(0, CLE_MAX - marque.length - 1).replace(/-+$/, '') || 'rayon'}-${marque}`;
  } else {
    cle = lisible.slice(0, CLE_MAX).replace(/-+$/, '') || 'rayon';
  }
  return cle === RAYON_COUPS_DE_COEUR ? `${cle.slice(0, 34)}-rayon` : cle;
}

/**
 * Rayon maison tel que le lit la vitrine (lot 6 du chantier boutique, 2026-10-03) :
 * un nom choisi par le revendeur, sa clé (toujours cleRayon(nom)) et ses articles.
 * Validé et borné par src/lib/boutique-reglages.ts (8 rayons, 24 caractères, un
 * article dans un seul rayon maison).
 */
export interface RayonChoisi {
  cle: string;
  nom: string;
  ids: readonly string[];
}

/**
 * Rayon MAISON d'un article, ou null s'il reste dans le rayon de sa catégorie.
 *
 * Un article est dans le rayon maison qui le contient. S'il n'est dans aucun, mais
 * que sa catégorie porte le nom d'un rayon maison (même clé : un rayon « Mode »
 * créé alors que des articles sont déjà de catégorie « Mode »), il le rejoint : la
 * vitrine n'affiche jamais deux rayons du même nom, et ?rayon=<cle> n'en désigne qu'un.
 */
export function rayonMaisonDe(
  rayonsMaison: readonly RayonChoisi[] | null | undefined,
): (article: { id?: string | null; categorie?: string | null }) => string | null {
  if (!rayonsMaison || rayonsMaison.length === 0) return () => null;
  const parArticle = new Map<string, string>();
  const parCle = new Map<string, string>();
  for (const r of rayonsMaison) {
    if (!parCle.has(r.cle)) parCle.set(r.cle, r.nom);
    for (const id of r.ids) if (!parArticle.has(id)) parArticle.set(id, r.nom);
  }
  return (article) => (article.id ? parArticle.get(article.id) : undefined) ?? parCle.get(cleRayon(article.categorie)) ?? null;
}

const nomDuRayon = (a: ArticlePartage) => String(a.categorie || '').trim() || RAYON_SANS_CATEGORIE;

/**
 * Rayons de la vitrine (hors coups de cœur) : les rayons maison d'abord, dans
 * l'ordre choisi (lot 6), puis les catégories dans l'ordre de leur premier article.
 * Un rayon maison sans article affiché n'apparaît pas.
 */
export function rayonsDeLaVitrine(articles: readonly ArticlePartage[], rayonsMaison: readonly RayonChoisi[] = []): ChoixPartage[] {
  const maisonDe = rayonMaisonDe(rayonsMaison);
  const rayons = new Map<string, ChoixPartage>();
  for (const r of rayonsMaison) if (!rayons.has(r.cle)) rayons.set(r.cle, { cle: r.cle, libelle: r.nom, nombre: 0 });
  for (const a of articles) {
    if (a.coupDeCoeur) continue;
    const nom = maisonDe(a) ?? nomDuRayon(a);
    const cle = cleRayon(nom);
    const rayon = rayons.get(cle);
    if (rayon) rayon.nombre += 1;
    else rayons.set(cle, { cle, libelle: nom, nombre: 1 });
  }
  return Array.from(rayons.values()).filter((r) => r.nombre > 0);
}

/**
 * Gros boutons de la feuille : toute la boutique, les coups de cœur s'il y en a,
 * puis chaque rayon dès 2 rayons (avec un seul, il serait la boutique entière ;
 * même règle que les pastilles de la vitrine).
 */
export function choixDePartage(articles: readonly ArticlePartage[], rayonsMaison: readonly RayonChoisi[] = []): ChoixPartage[] {
  const coups = articles.filter((a) => a.coupDeCoeur).length;
  const rayons = rayonsDeLaVitrine(articles, rayonsMaison);
  return [
    { cle: null, libelle: 'Toute ma boutique', nombre: articles.length },
    ...(coups > 0 ? [{ cle: RAYON_COUPS_DE_COEUR, libelle: 'Mes coups de cœur', nombre: coups }] : []),
    ...(rayons.length >= 2 ? rayons : []),
  ];
}

/** Articles d'un choix, dans l'ordre de la vitrine (coups de cœur d'abord). */
export function articlesDuChoix(articles: readonly ArticlePartage[], cle: string | null, rayonsMaison: readonly RayonChoisi[] = []): ArticlePartage[] {
  const coups = articles.filter((a) => a.coupDeCoeur);
  const autres = articles.filter((a) => !a.coupDeCoeur);
  if (!cle) return [...coups, ...autres];
  if (cle === RAYON_COUPS_DE_COEUR) return coups;
  const maisonDe = rayonMaisonDe(rayonsMaison);
  return autres.filter((a) => cleRayon(maisonDe(a) ?? nomDuRayon(a)) === cle);
}

/**
 * Les articles cités dans le message : en stock et avec un prix, dans l'ordre de
 * la vitrine. Un article épuisé n'est jamais cité : le client ne pourrait pas
 * l'acheter.
 */
export function articlesAAnnoncer(
  articles: readonly ArticlePartage[],
  cle: string | null,
  nombre = ARTICLES_DANS_LE_MESSAGE,
  rayonsMaison: readonly RayonChoisi[] = [],
): ArticlePartage[] {
  return articlesDuChoix(articles, cle, rayonsMaison)
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
