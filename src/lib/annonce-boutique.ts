/**
 * Prévenir mes abonnés (lot 5 du chantier boutique, 2026-10-03) — règles PURES,
 * sans accès base ni navigateur : partagées par la route privée
 * /api/reseller/boutique/annonce, le bouton « Prévenir mes abonnés » et sa feuille.
 *
 * Avant : le bouton « Suivre » de la vitrine promettait « les nouveautés et les
 * promotions », mais les abonnés d'une boutique de REVENDEUR n'étaient jamais
 * prévenus de rien. Désormais le revendeur annonce ses nouveautés, dans
 * l'application seulement (décision du fondateur) :
 *  - une annonce par 24 h ;
 *  - un texte composé par Suguba, jamais de texte libre (ni promesse de remise,
 *    ni prix inventé) : « Nouveautés chez <enseigne> » et jusqu'à 3 noms d'articles ;
 *  - les abonnés avec un compte la reçoivent dans leurs notifications ; ceux
 *    inscrits par téléphone seul ne reçoivent rien (règle anti-ban : aucun envoi
 *    WhatsApp automatique). Le revendeur peut, lui, publier un texte prêt sur son
 *    statut WhatsApp, à la main.
 */
import { NOUVEAU_JOURS } from './boutique-ordre';
import { formatNombre } from './montant';

/** Une annonce aux abonnés par période de 24 h (décision du fondateur). */
export const ANNONCE_DELAI_HEURES = 24;

/** Articles nommés dans l'annonce : assez pour donner envie, assez court pour une notification. */
export const ANNONCE_ARTICLES_CITES = 3;

const HEURE = 3600 * 1000;

/**
 * Heure à partir de laquelle une nouvelle annonce est possible (ISO), ou null si
 * elle l'est déjà. Une date illisible ne bloque pas : seule une vraie annonce
 * de moins de 24 h compte.
 */
export function prochaineAnnonce(derniere: string | null | undefined, maintenant: number = Date.now()): string | null {
  if (!derniere) return null;
  const t = Date.parse(derniere);
  if (!Number.isFinite(t)) return null;
  const possible = t + ANNONCE_DELAI_HEURES * HEURE;
  return possible > maintenant ? new Date(possible).toISOString() : null;
}

/**
 * Début des nouveautés (horodatage) : la dernière annonce, mais jamais plus de
 * 14 jours en arrière. Un article ajouté il y a plus de 14 jours ne porte plus
 * l'étiquette « Nouveau » sur la vitrine : l'annoncer comme une nouveauté serait
 * faux (et, sans annonce précédente, toute la boutique passerait pour nouvelle).
 */
export function debutDesNouveautes(derniere: string | null | undefined, maintenant: number = Date.now()): number {
  const fenetre = maintenant - NOUVEAU_JOURS * 24 * HEURE;
  const t = derniere ? Date.parse(derniere) : NaN;
  return Number.isFinite(t) ? Math.max(t, fenetre) : fenetre;
}

/** Colonnes de products lues pour une annonce. */
export interface ProduitAnnonce {
  id: string;
  name?: string | null;
  status?: string | null;
  stock?: number | string | null;
  reseller_commission?: number | string | null;
  pricing_status?: string | null;
}

/**
 * Article qu'on peut annoncer : celui que la vitrine affiche (approuvé, avec un
 * gain, prix « ok », même filtre que lib/shop.ts) ET en stock. Un article épuisé
 * n'est jamais annoncé : le client ne pourrait pas l'acheter.
 */
export function annoncable(p: ProduitAnnonce | null | undefined): boolean {
  if (!p) return false;
  return p.status === 'approved'
    && Number(p.reseller_commission) > 0
    && (!p.pricing_status || p.pricing_status === 'ok')
    && Number(p.stock) > 0;
}

/** Nom d'article propre pour un texte court : sans caractère de contrôle ni balise, 60 caractères au plus. */
function nomPropre(nom: unknown): string {
  return String(nom ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60).trim();
}

/**
 * Nouveautés de la sélection : articles ajoutés APRÈS `debut`, annonçables, du
 * plus récent au plus ancien. Seules les lignes de `selection` (la sélection de
 * la session, lue par la route) peuvent en sortir.
 */
export function nouveautesAAnnoncer(
  selection: readonly { product_id: string; added_at?: string | null }[],
  produits: readonly ProduitAnnonce[],
  debut: number,
): { id: string; nom: string }[] {
  const parId = new Map(produits.map((p) => [p.id, p]));
  return selection
    .map((l) => ({ l, t: l.added_at ? Date.parse(l.added_at) : NaN }))
    .filter(({ l, t }) => Number.isFinite(t) && t > debut && annoncable(parId.get(l.product_id)))
    .sort((a, b) => b.t - a.t)
    .map(({ l }) => ({ id: l.product_id, nom: nomPropre(parId.get(l.product_id)?.name) || 'Article' }));
}

/** « A », « A et B », « A, B et C ». */
function enumeration(noms: readonly string[]): string {
  if (noms.length <= 1) return noms[0] || '';
  return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
}

/** Notification composée par Suguba (aucun texte libre). */
export interface ContenuAnnonce {
  titre: string;
  texte: string;
  /** Lien interne vers la vitrine : /boutique/<adresse>. */
  lien: string;
  /** Les noms cités (3 au plus), pour le texte du statut WhatsApp. */
  noms: string[];
}

/**
 * « Nouveautés chez <enseigne> » (ou « chez Awa D. », jamais le nom complet :
 * `nomBoutique` est le nom public calculé par le serveur), puis jusqu'à 3 noms
 * d'articles, et « et N autres articles » au-delà. Ni prix ni pourcentage.
 */
export function contenuAnnonce(params: { nomBoutique: string; slug: string; nouveautes: readonly { nom: string }[] }): ContenuAnnonce {
  const noms = params.nouveautes.slice(0, ANNONCE_ARTICLES_CITES).map((n) => nomPropre(n.nom) || 'Article');
  const reste = params.nouveautes.length - noms.length;
  const liste = reste > 0
    ? `${noms.join(', ')} et ${reste} autre${reste > 1 ? 's' : ''} article${reste > 1 ? 's' : ''}`
    : enumeration(noms);
  return {
    titre: `Nouveautés chez ${nomPropre(params.nomBoutique) || 'votre boutique'}`,
    texte: `À découvrir : ${liste}.`,
    lien: `/boutique/${encodeURIComponent(params.slug)}`,
    noms,
  };
}

/**
 * Texte prêt pour « Publier sur mon statut WhatsApp » (partage MANUEL, par le
 * revendeur lui-même) : le titre de l'annonce, les noms cités, « vous payez à la
 * livraison » et le lien de la boutique. Aucun prix : ce texte reste vrai même
 * si un prix change d'ici là.
 */
export function texteStatutAnnonce(params: { titre: string; noms: readonly string[]; url: string }): string {
  return [
    `🆕 *${params.titre}*`,
    ...(params.noms.length ? ['', ...params.noms.map((n) => `• ${n}`)] : []),
    '',
    '✅ Vous payez à la livraison, livré chez vous à Bamako.',
    `👉 ${params.url}`,
  ].join('\n');
}

// ── Ce que l'écran affiche ──────────────────────────────────────────────────

/** Réponse de GET /api/reseller/boutique/annonce : de quoi proposer l'annonce et remplir la feuille. */
export interface EtatAnnonce {
  /** Articles ajoutés depuis la dernière annonce (14 jours au plus), affichés et en stock. */
  nouveautes: number;
  /** La notification telle qu'elle partira ; null sans nouveauté. */
  apercu: ContenuAnnonce | null;
  /** Abonnés qui recevront la notification ; null si le compte est illisible (jamais un 0 inventé). */
  abonnesAvecCompte: number | null;
  /** Abonnés inscrits par téléphone seul : ils ne reçoivent rien. */
  abonnesSansCompte: number | null;
  derniereAnnonce: string | null;
  /** Heure à partir de laquelle une nouvelle annonce est possible ; null si elle l'est déjà. */
  possibleLe: string | null;
}

/** Réponse de POST /api/reseller/boutique/annonce : des chiffres réels. */
export interface ResultatAnnonce {
  /** Notifications vraiment écrites. */
  prevenus: number;
  sansCompte: number | null;
  possibleLe: string | null;
}

/**
 * Y a-t-il lieu d'afficher « Prévenir mes abonnés (N nouveautés) » ? Oui s'il y a
 * des nouveautés ET quelqu'un à qui les montrer (abonné avec ou sans compte : à
 * ceux inscrits par téléphone, la feuille propose le statut WhatsApp). Compte
 * d'abonnés illisible : rien n'est proposé, plutôt qu'un bouton qui échouerait.
 */
export function annonceAProposer(etat: EtatAnnonce | null | undefined): boolean {
  if (!etat || !(etat.nouveautes > 0) || !etat.apercu) return false;
  if (etat.abonnesAvecCompte === null) return false;
  return etat.abonnesAvecCompte + (etat.abonnesSansCompte ?? 0) > 0;
}

/**
 * Ce que montre la feuille :
 *  - 'envoyee'     : le résultat, puis le statut WhatsApp ;
 *  - 'limite'      : une annonce a déjà été envoyée depuis moins de 24 h ;
 *  - 'sans_compte' : aucun abonné n'a de compte, rien ne peut partir dans l'application ;
 *  - 'prete'       : aperçu, destinataires, « Prévenir mes N abonnés ».
 */
export type ModeAnnonce = 'envoyee' | 'limite' | 'sans_compte' | 'prete';

export function modeAnnonce(etat: EtatAnnonce, envoyee: boolean, maintenant: number = Date.now()): ModeAnnonce {
  if (envoyee) return 'envoyee';
  const possible = etat.possibleLe ? Date.parse(etat.possibleLe) : NaN;
  if (Number.isFinite(possible) && possible > maintenant) return 'limite';
  if (!(Number(etat.abonnesAvecCompte) > 0)) return 'sans_compte';
  return 'prete';
}

const s = (n: number) => (n > 1 ? 's' : '');

/** « Prévenir mes abonnés (2 nouveautés) » : le bouton de Mes articles et des Statistiques. */
export function libelleBoutonAnnonce(nouveautes: number): string {
  return `Prévenir mes abonnés (${formatNombre(nouveautes)} nouveauté${s(nouveautes)})`;
}

/** « Prévenir mes 12 abonnés » : l'action principale de la feuille. */
export function libelleEnvoiAnnonce(avecCompte: number): string {
  return avecCompte > 1 ? `Prévenir mes ${formatNombre(avecCompte)} abonnés` : 'Prévenir mon abonné';
}

/** « 12 abonnés avec un compte seront prévenus dans l’application. » */
export function phraseDestinataires(avecCompte: number): string {
  return avecCompte > 1
    ? `${formatNombre(avecCompte)} abonnés avec un compte seront prévenus dans l’application.`
    : '1 abonné avec un compte sera prévenu dans l’application.';
}

/** « 3 abonnés inscrits par téléphone ne reçoivent rien. » ; null quand il n'y en a pas (ou compte illisible). */
export function phraseSansCompte(sansCompte: number | null | undefined): string | null {
  if (!sansCompte || !(sansCompte > 0)) return null;
  return sansCompte > 1
    ? `${formatNombre(sansCompte)} abonnés inscrits par téléphone ne reçoivent rien.`
    : '1 abonné inscrit par téléphone ne reçoit rien.';
}

/** « 12 abonnés prévenus » : le chiffre RÉEL renvoyé par le serveur. */
export function phraseResultat(prevenus: number): string {
  return prevenus > 1 ? `${formatNombre(prevenus)} abonnés prévenus` : '1 abonné prévenu';
}
