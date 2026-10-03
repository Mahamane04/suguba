/**
 * Réglages de vitrine choisis par le propriétaire (lot 6 du chantier boutique,
 * 2026-10-03) — règles PURES, sans accès base ni navigateur : partagées par le
 * serveur (majBoutique, la vitrine) et par les écrans « Mes rayons » et
 * « Personnaliser ma boutique ».
 *
 * Demande du fondateur : des outils pour gérer sa boutique, dont « catégories /
 * rayons ». Jusqu'ici les rayons de la vitrine étaient les catégories des
 * fournisseurs, dans l'ordre des articles : le revendeur ne pouvait ni créer
 * « Pagnes » ou « Pour la fête », ni décider de ce qui passe en premier, ni
 * afficher un message daté en haut de sa boutique.
 *
 * Tout tient dans UNE colonne JSON, stores.reglages (fichier
 * supabase/A-EXECUTER-2026-10-03-vitrine-boutique.sql) :
 *   { rayons: [{ cle, nom, ids }], annonce: { texte, fin } | null }
 * Valeurs décidées par le fondateur : 8 rayons maison au plus, noms de 24
 * caractères ; annonce de 14 jours au plus, sans prix ni pourcentage (les
 * promotions sont hors de ce chantier : Suguba n'applique aucune remise).
 *
 * Tant que le fichier SQL n'est pas exécuté, la colonne n'existe pas : rien de
 * tout cela n'est proposé (voir `options.reglages` dans lib/reseau/boutiques.ts)
 * et la vitrine garde ses rayons automatiques.
 *
 * stores.categories n'est PAS réutilisé : il porte les familles de l'annuaire
 * /boutiques (« Ce que je vends »), pas les rayons de la vitrine.
 *
 * Relecture du lot 6 (2026-10-03) :
 *  - un texte est BORNÉ avant d'être nettoyé (TEXTE_BRUT_MAX) : le nettoyage d'un
 *    nom ou d'une annonce de 80 000 « < » occupait le serveur plus de 3 secondes ;
 *  - le nom d'un rayon refuse aussi un prix écrit d'un seul tenant (« Tout à 5000 »),
 *    comme l'annonce : c'est un titre public de la vitrine ;
 *  - « ni numéro ni lien » reconnaît un lien écrit comme on le tape
 *    (« facebook.com/awamode », « wa.link/… »), une adresse e-mail et un numéro
 *    séparé par « / », « _ » ou « , ».
 */
import { FORMAT_DATE } from './montant';
import { promesseChiffree, type PromesseChiffree } from './message-affiche';
import { cleRayon, type RayonChoisi } from './partage-boutique';
import { couperTexte, texteBienForme } from './texte-entier';

/** Rayons maison au plus (décision du fondateur). */
export const RAYONS_MAX = 8;
export const RAYON_NOM_MIN = 2;
/** Longueur d'un nom de rayon (décision du fondateur) : il tient sur une pastille à 390 px. */
export const RAYON_NOM_MAX = 24;
/** Longueur de l'annonce : la même que le mot d'accueil. */
export const ANNONCE_TEXTE_MAX = 90;
/** Durée d'une annonce datée (décision du fondateur). */
export const ANNONCE_JOURS_MAX = 14;

/** Réponse quand la colonne stores.reglages n'existe pas encore (409, jamais 500). */
export const OPTION_ABSENTE = 'Option pas encore activée (mise à jour de la base à appliquer).';

/** Rayon maison enregistré. `cle` est TOUJOURS recalculée à partir du nom (cleRayon). */
export interface RayonMaison extends RayonChoisi {
  ids: string[];
}

/** Annonce affichée en haut de la vitrine jusqu'au soir de `fin`. */
export interface AnnonceDatee {
  texte: string;
  /** Dernier jour d'affichage, « AAAA-MM-JJ ». L'heure de Bamako est l'heure UTC. */
  fin: string;
}

export interface ReglagesBoutique {
  rayons: RayonMaison[];
  annonce: AnnonceDatee | null;
}

export type ResultatReglages = { ok: true; reglages: ReglagesBoutique } | { ok: false; erreur: string };

const JOUR = 24 * 3600 * 1000;

/** « 2026-10-03 » : le jour à Bamako (UTC, sans heure d'été). */
export function jourDe(maintenant: number = Date.now()): string {
  return new Date(maintenant).toISOString().slice(0, 10);
}

/** Dernier jour qu'une annonce écrite maintenant peut atteindre. */
export function finMaximale(maintenant: number = Date.now()): string {
  return jourDe(maintenant + ANNONCE_JOURS_MAX * JOUR);
}

/** Un vrai jour du calendrier, écrit « AAAA-MM-JJ » (« 2026-02-31 » n'en est pas un). */
function jourValide(valeur: unknown): valeur is string {
  if (typeof valeur !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return false;
  const t = Date.parse(`${valeur}T00:00:00Z`);
  return Number.isFinite(t) && jourDe(t) === valeur;
}

/**
 * « 10 oct. » : la date de fin, lue comme un jour (midi UTC, fuseau UTC) pour ne
 * jamais reculer d'un jour sur un téléphone réglé sur un autre fuseau.
 */
export function jourLisible(fin: string | null | undefined): string {
  if (!jourValide(fin)) return '—';
  return new Date(`${fin}T12:00:00Z`).toLocaleDateString('fr-FR', { ...FORMAT_DATE.jour, timeZone: 'UTC' });
}

/**
 * Longueur BRUTE au-delà de laquelle un texte n'est pas examiné (relecture du lot 6,
 * 2026-10-03). Les vraies limites (24 et 90 caractères) se mesurent APRÈS le
 * nettoyage ; or nettoyer un texte de 80 000 « < » prenait plus de 3 secondes (4 fois
 * plus à chaque doublement), et rien ne limite la taille d'une requête : un seul
 * envoi d'un revendeur connecté bloquait le serveur. Aucun nom de rayon ni aucune
 * annonce légitime n'approche cette longueur, balises comprises : au-delà, le texte
 * est refusé à l'écriture, et coupé à la lecture, AVANT tout remplacement.
 */
export const TEXTE_BRUT_MAX = 200;

const tropLong = (brut: unknown): boolean => typeof brut === 'string' && brut.length > TEXTE_BRUT_MAX;

/**
 * Texte court, propre : sans balise (un nom de rayon ou une annonce n'est jamais
 * du HTML), sans caractère de contrôle, espaces réduits, emoji jamais coupé.
 *
 * Coupé à TEXTE_BRUT_MAX avant le premier remplacement, et balise cherchée sans
 * « < » à l'intérieur (/<[^<>]*>/) : chaque caractère n'est lu qu'une fois, quelle
 * que soit l'entrée (l'ancienne /<[^>]*>/ relisait toute la suite à chaque « < »).
 */
function textePropre(brut: unknown): string {
  if (typeof brut !== 'string') return '';
  return texteBienForme(brut.slice(0, TEXTE_BRUT_MAX))
    .replace(/<[^<>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Un numéro de téléphone : 8 chiffres ou plus, collés ou séparés (même règle que
// le titre de l'annonce aux abonnés, lot 5). Relecture du lot 6 (2026-10-03) :
// « 76/12/34/56 », « 76_12_34_56 » et « 76,12,34,56 » passaient ; ces trois
// séparateurs sont reconnus. UN séparateur au plus entre deux chiffres : une liste
// (« Tailles 38, 40, 42, 44 ») n'est pas un numéro.
const NUMERO = /(?:\d[\s.\-\/_,]?){8,}/;
// Une date complète (« 10/10/2026 ») compte 8 chiffres sans être un numéro : elle
// est retirée avant de chercher un numéro (une annonce datée en porte souvent une).
const DATE = /\b(?:0?[1-9]|[12]\d|3[01])[\/.\-](?:0?[1-9]|1[0-2])[\/.\-]20[2-4]\d\b/g;
// Un lien. Relecture du lot 6 (2026-10-03) : seuls « http(s):// », « www. » et
// « wa.me » étaient reconnus ; un lien écrit comme on le tape s'affichait donc sur
// la vitrine publique, alors que la commande doit rester sur Suguba (décision du
// fondateur : pas de WhatsApp du revendeur pour l'instant). Sont reconnus :
//  - un nom de site (« facebook.com/awamode », « wa.link/… », « bit.ly/… »), par
//    ses terminaisons courantes, non suivies d'une lettre (« Bonjour.Merci », une
//    phrase sans espace après le point, n'est pas un lien) ;
//  - les liens courts en « .me » de WhatsApp, Telegram et Facebook, nommés un par
//    un : « .me » seul refuserait « Merci.Me voici » ;
//  - tout « nom.xx/ » suivi d'un chemin, quelle que soit la terminaison ;
//  - une adresse e-mail (« awa@gmail.com »).
const LIEN = /https?:\/\/|www\.|\b(?:wa|t|m|fb)\.me\b|\b[a-z0-9-]+\.(?:com|net|org|info|biz|ml|sn|ci|bf|fr|ly|link|app|io|co|ee|cc|gg|to|be|tv|shop|store|site|page|online|africa|xyz)(?![\p{L}\p{N}-])|\b[a-z0-9-]+\.[a-z]{2,}\/|@[a-z0-9-]+\.[a-z]{2,}/iu;
// Une année (« Tabaski 2027 ») n'est pas un prix ; tout autre nombre de 3 chiffres
// ou plus en est un sur une vitrine (« Tout à 5000 »).
const ANNEE = /\b20[2-4]\d\b/g;

/** Un numéro de téléphone, un lien ou une adresse e-mail (texte déjà nettoyé). */
const contact = (texte: string): boolean => NUMERO.test(texte.replace(DATE, ' ')) || LIEN.test(texte);
/** Un nombre de 3 chiffres ou plus qui n'est pas une année : un prix, sur une vitrine. */
const prixSeul = (texte: string): boolean => /\d{3,}/.test(texte.replace(ANNEE, ''));

/** Clés que la vitrine réserve : la section « Coups de cœur », et l'intitulé de l'emplacement sponsorisé. */
const CLES_RESERVEES: ReadonlySet<string> = new Set(['coups-de-coeur-rayon', 'coup-de-coeur', 'a-la-une']);

const NOM_TROP_LONG = `Le nom d’un rayon fait ${RAYON_NOM_MAX} caractères au plus.`;
const PRIX_DANS_LE_NOM = 'Pas de prix ni de remise dans le nom d’un rayon.';

/**
 * Pourquoi ce nom de rayon est refusé, ou null s'il convient. Le nom s'affiche en
 * titre sur la vitrine publique : ni prix, ni remise, ni numéro de téléphone, ni
 * lien (Suguba n'applique pas de remise, et la vente reste sur Suguba).
 *
 * Relecture du lot 6 (2026-10-03) : « Tout à 5000 » ou « Pagnes à 2500 » passaient
 * (seuls « 5 000 » et « 5000 F » étaient refusés). Même règle que l'annonce : un
 * nombre de 3 chiffres ou plus est un prix, sauf une année (« Pagnes 2026 »).
 */
export function refusNomRayon(brut: string | null | undefined): string | null {
  if (tropLong(brut)) return NOM_TROP_LONG;
  const nom = textePropre(brut ?? '');
  if (nom.length < RAYON_NOM_MIN) return `Le nom d’un rayon fait au moins ${RAYON_NOM_MIN} caractères.`;
  if (nom.length > RAYON_NOM_MAX) return NOM_TROP_LONG;
  if (!/[\p{L}\p{N}]/u.test(nom)) return 'Le nom d’un rayon doit contenir des lettres.';
  if (CLES_RESERVEES.has(cleRayon(nom))) return 'Ce nom est réservé. Choisissez-en un autre.';
  if (promesseChiffree(nom, { nombreSeul: false }) !== null) return PRIX_DANS_LE_NOM;
  if (contact(nom)) return 'Pas de numéro de téléphone ni de lien dans le nom d’un rayon.';
  if (prixSeul(nom)) return PRIX_DANS_LE_NOM;
  return null;
}

const ANNONCE_TROP_LONGUE = `${ANNONCE_TEXTE_MAX} caractères au plus.`;

const REFUS_ANNONCE: Record<PromesseChiffree, string> = {
  pourcentage: 'Pas de pourcentage : Suguba n’applique pas de remise.',
  montant: 'Pas de prix ni de montant : le vrai prix est sur chaque article.',
  remise: 'Pas de remise chiffrée : Suguba n’applique pas de remise.',
};

/**
 * Pourquoi ce texte d'annonce est refusé, ou null s'il convient (texte vide : rien
 * à refuser, l'annonce est simplement retirée). Même langage que le message des
 * affiches (lot 3) et le titre de l'annonce aux abonnés (lot 5).
 */
export function refusAnnonce(brut: string | null | undefined): string | null {
  if (tropLong(brut)) return ANNONCE_TROP_LONGUE;
  const texte = textePropre(brut ?? '');
  if (!texte) return null;
  if (texte.length > ANNONCE_TEXTE_MAX) return ANNONCE_TROP_LONGUE;
  const promesse = promesseChiffree(texte, { nombreSeul: false });
  if (promesse) return REFUS_ANNONCE[promesse];
  if (contact(texte)) return 'Pas de numéro de téléphone ni de lien : la commande se passe sur Suguba.';
  if (prixSeul(texte)) return REFUS_ANNONCE.montant;
  return null;
}

/** Pourquoi cette date de fin est refusée pour une annonce écrite maintenant, ou null. */
export function refusFinAnnonce(fin: unknown, maintenant: number = Date.now()): string | null {
  if (!jourValide(fin)) return 'Choisissez la date de fin de l’annonce.';
  if (fin < jourDe(maintenant)) return 'La date de fin est déjà passée.';
  if (fin > finMaximale(maintenant)) return `Une annonce dure ${ANNONCE_JOURS_MAX} jours au plus.`;
  return null;
}

const objet = (v: unknown): Record<string, unknown> | null =>
  (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null);

type Rayons = { rayons: RayonMaison[] } | { erreur: string };

/**
 * Rayons maison propres. `strict` (écriture) : la première anomalie refuse tout,
 * avec sa raison. Sinon (lecture de la base) : ce qui est valide est gardé, le
 * reste est coupé ou ignoré, jamais d'erreur.
 *
 * Dans les deux cas : 8 rayons au plus, un article dans UN seul rayon maison (le
 * premier qui le cite), et seuls les articles de `selection` quand elle est fournie.
 */
function rayonsPropres(brut: unknown, selection: ReadonlySet<string> | null, strict: boolean): Rayons {
  if (!Array.isArray(brut)) return strict ? { erreur: 'Rayons illisibles.' } : { rayons: [] };
  if (strict && brut.length > RAYONS_MAX) return { erreur: `${RAYONS_MAX} rayons au plus.` };
  const rayons: RayonMaison[] = [];
  const cles = new Set<string>();
  const ranges = new Set<string>();
  for (const element of brut.slice(0, RAYONS_MAX)) {
    const rayon = objet(element);
    if (!rayon) { if (strict) return { erreur: 'Rayons illisibles.' }; continue; }
    // Écriture : un nom démesuré est refusé sans être nettoyé (relecture du lot 6).
    // Lecture : textePropre le coupe avant tout remplacement.
    if (strict && tropLong(rayon.nom)) return { erreur: NOM_TROP_LONG };
    const complet = textePropre(rayon.nom);
    const nom = strict ? complet : couperTexte(complet, RAYON_NOM_MAX).trim();
    const refus = refusNomRayon(nom);
    if (refus) { if (strict) return { erreur: refus }; continue; }
    const cle = cleRayon(nom);
    if (cles.has(cle)) { if (strict) return { erreur: `Deux rayons portent le même nom : « ${nom} ».` }; continue; }
    cles.add(cle);
    const ids: string[] = [];
    for (const id of Array.isArray(rayon.ids) ? rayon.ids : []) {
      if (typeof id !== 'string' || !id || id.length > 64 || ranges.has(id)) continue;
      if (selection && !selection.has(id)) continue;
      ranges.add(id);
      ids.push(id);
    }
    rayons.push({ cle, nom, ids });
  }
  return { rayons };
}

type Annonce = { annonce: AnnonceDatee | null } | { erreur: string };

/** Annonce propre ; mêmes deux modes que les rayons. Texte vide ou null : pas d'annonce. */
function annoncePropre(brut: unknown, maintenant: number, strict: boolean): Annonce {
  if (brut == null) return { annonce: null };
  const source = objet(brut);
  if (!source) return strict ? { erreur: 'Annonce illisible.' } : { annonce: null };
  // Écriture : un texte démesuré est refusé sans être nettoyé (relecture du lot 6) —
  // avant, 80 000 « < » étaient nettoyés en 3 secondes, puis pris pour « pas d'annonce ».
  if (strict && tropLong(source.texte)) return { erreur: ANNONCE_TROP_LONGUE };
  const texte = textePropre(source.texte);
  if (!texte) return { annonce: null };
  const refus = refusAnnonce(texte);
  if (refus) return strict ? { erreur: refus } : { annonce: null };
  if (strict) {
    const refusFin = refusFinAnnonce(source.fin, maintenant);
    if (refusFin) return { erreur: refusFin };
  } else if (!jourValide(source.fin)) {
    return { annonce: null };
  }
  return { annonce: { texte, fin: source.fin as string } };
}

/**
 * Réglages lus dans stores.reglages : toujours un objet complet, jamais d'erreur.
 * Colonne absente, `{}` ou contenu illisible : aucun rayon maison, aucune annonce —
 * la vitrine est alors celle d'avant le lot 6.
 */
export function lireReglages(brut: unknown): ReglagesBoutique {
  const source = objet(brut);
  if (!source) return { rayons: [], annonce: null };
  const rayons = rayonsPropres(source.rayons, null, false);
  const annonce = annoncePropre(source.annonce, 0, false);
  return {
    rayons: 'rayons' in rayons ? rayons.rayons : [],
    annonce: 'annonce' in annonce ? annonce.annonce : null,
  };
}

/**
 * Réglages à ENREGISTRER : ce que le navigateur envoie, validé, fusionné avec ce
 * qui est déjà enregistré. Seules les parties présentes dans `brut` changent : la
 * page « Mes rayons » n'efface pas l'annonce, « Personnaliser » n'efface pas les
 * rayons. Une seule valeur refusée = rien n'est écrit.
 *
 *  - rayons : 8 au plus ; nom de 2 à 24 caractères, sans balise, ni prix, ni
 *    numéro, ni lien ; clé tirée du nom (cleRayon) et unique ; un article dans un
 *    seul rayon maison ; les identifiants hors de la sélection réelle sont retirés ;
 *  - annonce : 90 caractères au plus, sans « % » ni montant, ni numéro, ni lien,
 *    fin dans 14 jours au plus ; `null` ou un texte vide la retire ;
 *  - un nom ou un texte de plus de TEXTE_BRUT_MAX caractères bruts est refusé sans
 *    être examiné.
 */
export function normaliserReglages(
  brut: unknown,
  contexte: {
    /** Articles de la sélection réelle de la boutique (lus par le serveur). Exigée pour écrire des rayons. */
    selection?: readonly string[] | null;
    maintenant?: number;
    /** Réglages déjà enregistrés (lireReglages) : gardés pour ce que `brut` ne mentionne pas. */
    actuels?: ReglagesBoutique | null;
  } = {},
): ResultatReglages {
  const patch = objet(brut);
  if (!patch) return { ok: false, erreur: 'Réglages illisibles.' };
  const reglages: ReglagesBoutique = {
    rayons: contexte.actuels?.rayons ?? [],
    annonce: contexte.actuels?.annonce ?? null,
  };
  if ('rayons' in patch) {
    if (!contexte.selection) return { ok: false, erreur: 'Vos articles sont indisponibles. Réessayez.' };
    const rayons = rayonsPropres(patch.rayons, new Set(contexte.selection), true);
    if ('erreur' in rayons) return { ok: false, erreur: rayons.erreur };
    reglages.rayons = rayons.rayons;
  }
  if ('annonce' in patch) {
    const annonce = annoncePropre(patch.annonce, contexte.maintenant ?? Date.now(), true);
    if ('erreur' in annonce) return { ok: false, erreur: annonce.erreur };
    reglages.annonce = annonce.annonce;
  }
  return { ok: true, reglages };
}

/**
 * L'annonce à afficher maintenant, ou null. Elle disparaît d'elle-même le
 * lendemain de sa date de fin, sans aucune écriture. Une date au-delà de 14 jours
 * (ligne modifiée à la main) n'est pas affichée non plus.
 */
export function annonceEnCours(annonce: AnnonceDatee | null | undefined, maintenant: number = Date.now()): AnnonceDatee | null {
  if (!annonce || !jourValide(annonce.fin)) return null;
  if (annonce.fin < jourDe(maintenant) || annonce.fin > finMaximale(maintenant)) return null;
  return annonce;
}

/** Deux listes de rayons identiques (nom, ordre et articles) : rien à enregistrer. */
export function memesRayons(a: readonly RayonChoisi[], b: readonly RayonChoisi[]): boolean {
  return a.length === b.length && a.every((r, i) => r.nom === b[i].nom && r.ids.length === b[i].ids.length && r.ids.every((id, j) => id === b[i].ids[j]));
}

/** Rayon d'indice `i` monté (-1) ou descendu (+1) d'un cran ; liste inchangée au bord. */
export function deplacerRayon<T>(rayons: readonly T[], i: number, sens: -1 | 1): T[] {
  const j = i + sens;
  const suivant = [...rayons];
  if (i < 0 || i >= rayons.length || j < 0 || j >= rayons.length) return suivant;
  [suivant[i], suivant[j]] = [suivant[j], suivant[i]];
  return suivant;
}

/**
 * Rayon créé ou modifié à l'écran, posé dans la liste : ses articles quittent les
 * autres rayons maison (un article n'est rangé que dans un seul). `indice` null :
 * nouveau rayon, ajouté à la fin.
 */
export function poserRayon(rayons: readonly RayonMaison[], indice: number | null, rayon: { nom: string; ids: readonly string[] }): RayonMaison[] {
  const nom = textePropre(rayon.nom);
  const pris = new Set(rayon.ids);
  const pose: RayonMaison = { cle: cleRayon(nom), nom, ids: Array.from(pris) };
  const autres = rayons.map((r, i) => (i === indice ? pose : { ...r, ids: r.ids.filter((id) => !pris.has(id)) }));
  return indice === null ? [...autres, pose] : autres;
}

/** Pourquoi ce rayon ne peut pas être posé (nom refusé, ou déjà porté par un autre rayon), ou null. */
export function refusRayon(rayons: readonly RayonChoisi[], indice: number | null, nomBrut: string): string | null {
  const refus = refusNomRayon(nomBrut);
  if (refus) return refus;
  if (indice === null && rayons.length >= RAYONS_MAX) return `${RAYONS_MAX} rayons au plus.`;
  const cle = cleRayon(textePropre(nomBrut));
  return rayons.some((r, i) => i !== indice && r.cle === cle) ? 'Vous avez déjà un rayon de ce nom.' : null;
}
