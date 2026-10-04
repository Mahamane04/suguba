/**
 * Boutiques (fournisseur, revendeur, Suguba) et abonnements — SERVEUR.
 *
 * La boutique est générique (table `stores`) : c'est ce qui permet à Suguba
 * d'être elle-même vendeuse (§ 24) sans un second système.
 */
import { getSupabaseAdmin } from '../supabase-admin';
import { slugifier } from '../shop';
import { adresseReservee, estEnseigne, nomPublic, nomPublicBoutique } from '../enseigne';
import { cleClient } from './attribution';
import { classerParProximite, quartierReconnu, type NiveauProximite } from './proximite';
import { OPTION_ABSENTE, lireReglages, normaliserReglages, type ReglagesBoutique } from '../boutique-reglages';
import { adresseBienFormee, adresseDepuis, refusAdresse, type ResultatAdresse } from '../adresse-boutique';

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

function schemaIncomplet(error: { code?: string } | null): boolean {
  return !!error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703');
}

/**
 * La table store_slug_aliases n'existe pas encore (lot 8 du chantier boutique,
 * 2026-10-03) : supabase/A-EXECUTER-2026-10-03-vitrine-boutique.sql pas exécuté
 * (42P01), ou cache de l'API pas rechargé (PGRST205). Ce n'est pas une panne :
 * aucune boutique n'a pu changer d'adresse, il n'y a donc aucune ancienne adresse.
 */
function aliasAbsents(error: { code?: string } | null): boolean {
  return !!error && (error.code === '42P01' || error.code === 'PGRST205');
}

export type TypeProprietaire = 'supplier' | 'reseller' | 'suguba';

export interface BoutiqueReseau {
  id: string;
  typeProprietaire: TypeProprietaire;
  proprietaireId: string | null;
  slug: string;
  nom: string;
  accroche: string | null;
  description: string | null;
  logo: string | null;
  couverture: string | null;
  galerie: string[];
  categories: string[];
  whatsapp: string | null;
  recrute: boolean;
  abonnes: number;
  statut: string;
  /** Quartier de Bamako où se trouve la boutique (recherche « près de chez moi »). */
  quartier: string | null;
  /** Adresse publique quand ce n'est pas /boutique/<slug> (vitrine fournisseur historique /s/<slug>). */
  lien?: string;
  /**
   * Boutique principale du compte (2026-09-24). Les boutiques supplémentaires
   * (formules Pro) ont leur propre sélection d'articles (store_products).
   * Toujours vrai tant que la base n'a pas la colonne.
   */
  principale: boolean;
  /**
   * Réglages de vitrine choisis par le propriétaire (lot 6 du chantier boutique,
   * 2026-10-03) : rayons maison et annonce datée, lus dans stores.reglages et
   * toujours validés (lireReglages). Vides tant que la colonne n'existe pas.
   */
  reglages: ReglagesBoutique;
  /**
   * Ce que la base permet DÉJÀ. `reglages` : la colonne stores.reglages existe
   * (supabase/A-EXECUTER-2026-10-03-vitrine-boutique.sql exécuté). Faux : ni la
   * tuile « Rayons », ni le champ « Annonce » ne sont proposés — ce n'est pas un
   * écran en panne, l'option n'existe simplement pas encore.
   */
  options: { reglages: boolean };
  /**
   * Présente seulement quand la boutique a été retrouvée par son ANCIENNE adresse
   * (lot 8, 2026-10-03 : un seul changement d'adresse, l'ancienne redirige). `slug`
   * porte toujours l'adresse actuelle : la vitrine redirige alors vers elle.
   */
  ancienneAdresse?: string;
}

function versBoutique(r: any): BoutiqueReseau {
  return {
    id: r.id,
    typeProprietaire: r.owner_type,
    proprietaireId: r.owner_id || null,
    slug: r.slug,
    nom: r.name,
    accroche: r.tagline || null,
    description: r.description || null,
    logo: r.logo_url || null,
    couverture: r.cover_url || null,
    galerie: Array.isArray(r.gallery) ? r.gallery.filter(Boolean).map(String) : [],
    categories: Array.isArray(r.categories) ? r.categories.filter(Boolean).map(String) : [],
    whatsapp: r.owner_type === 'supplier' ? null : r.whatsapp || null,
    recrute: Boolean(r.is_recruiting),
    abonnes: Number(r.followers_count) || 0,
    statut: r.status || 'active',
    quartier: r.neighborhood || null,
    principale: r.principale !== false,
    // stores est lu en select('*') : aucune requête de plus. Colonne absente
    // (base pas encore migrée) : pas de clé `reglages` dans la ligne.
    reglages: lireReglages(r.reglages),
    options: { reglages: 'reglages' in r },
  };
}

/** Limite de la galerie, § 7 : « jusqu'à environ 10 images ». */
export const MAX_GALERIE = 10;

/**
 * Noms publics des boutiques revendeur d'une liste PUBLIQUE (relecture du lot 2
 * du chantier boutique, 2026-10-03) : annuaire « Boutiques près de chez vous »,
 * boutiques suivies, recherche (« Boutiques qui recrutent » n'en liste plus).
 *
 * Ces listes renvoyaient stores.name brut. Or les premières boutiques revendeur
 * ont été créées au nom complet du compte (« Awa Traoré Diallo ») : il s'affichait
 * en titre à n'importe quel visiteur, alors que la vitrine affiche « Awa D. ».
 * Même règle que la vitrine (nomPublicBoutique) : l'enseigne, sinon « Prénom I. ».
 *
 * Les noms complets sont lus en UNE requête. Profil illisible ou absent : la
 * boutique revendeur est RETIRÉE de la liste plutôt que publiée sous un nom
 * qu'on ne sait pas vérifier. Les boutiques fournisseur et Suguba sont inchangées.
 */
export async function nomsPublicsRevendeurs<T>(
  a: Admin,
  elements: T[],
  boutiqueDe: (element: T) => { typeProprietaire: string; proprietaireId: string | null; nom: string },
): Promise<T[]> {
  const ids = Array.from(new Set(elements.map(boutiqueDe)
    .filter((b) => b.typeProprietaire === 'reseller' && b.proprietaireId)
    .map((b) => b.proprietaireId as string)));
  if (ids.length === 0) return elements;
  const { data, error } = await a.from('profiles').select('id, full_name').in('id', ids);
  const nomsComplets = new Map<string, string | null>(
    error || !Array.isArray(data) ? [] : data.map((p: any) => [String(p.id), p.full_name ?? null]),
  );
  return elements.filter((e) => {
    const b = boutiqueDe(e);
    if (b.typeProprietaire !== 'reseller') return true;
    if (!b.proprietaireId || !nomsComplets.has(b.proprietaireId)) return false;
    b.nom = nomPublicBoutique(b.nom, nomsComplets.get(b.proprietaireId));
    return true;
  });
}

/**
 * Changement du nom du COMPTE (relecture finale du chantier boutique, 2026-10-04) :
 * à appeler AVANT d'écrire profiles.full_name, par toute route qui l'écrit.
 *
 * estEnseigne compare le nom de la boutique au nom du compte. Une boutique créée
 * avant le lot 2 porte le nom complet (« Awa Traore Dialo ») : tant que le compte
 * porte ce nom, la vitrine affiche « Awa D. ». Le compte corrigé en « Awa Traoré
 * Diallo », l'ancien nom complet n'était plus reconnu comme le sien : il passait
 * pour une enseigne et s'affichait en clair, en titre, à n'importe quel visiteur.
 *
 * Les boutiques revendeur du compte dont le nom n'était PAS une enseigne avec
 * l'ANCIEN nom reçoivent donc le « Prénom I. » du NOUVEAU nom, avant le profil :
 * entre les deux écritures, la vitrine affiche l'ancien ou le nouveau « Prénom
 * I. », jamais un nom complet. Une enseigne choisie (« Awa Mode ») n'est pas
 * touchée, l'adresse de la boutique non plus.
 *
 *  - `ok: false` : boutiques illisibles ou écriture en échec. L'appelant REFUSE le
 *    changement de nom ; les boutiques déjà réalignées sont remises comme avant.
 *  - `annuler` : à appeler si l'écriture du profil échoue ensuite (au mieux : un
 *    échec ici laisse « Prénom I. » du nom demandé, jamais un nom complet).
 * Nom inchangé : aucune lecture. Table stores absente (42P01, PGRST205) : le compte
 * n'a aucune boutique, rien à réaligner.
 */
export async function realignerBoutiquesAvantNouveauNom(
  a: Admin,
  proprietaireId: string,
  ancienNom: string | null | undefined,
  nouveauNom: string,
): Promise<{ ok: true; annuler: () => Promise<void> } | { ok: false }> {
  const rien = { ok: true as const, annuler: async () => undefined };
  if (String(ancienNom || '').trim() === nouveauNom.trim()) return rien;

  const nom = nomPublic(nouveauNom);
  const faites: { id: string; name: string | null }[] = [];
  // Identité : toujours le compte donné par l'appelant (la session), jamais un
  // identifiant de boutique seul.
  const ecrire = (id: string, name: string | null) => a.from('stores').update({ name, updated_at: new Date().toISOString() })
    .eq('id', id).eq('owner_type', 'reseller').eq('owner_id', proprietaireId);
  const annuler = async () => {
    for (const b of faites.splice(0)) {
      try { await ecrire(b.id, b.name); } catch { /* au mieux : « Prénom I. » reste, jamais un nom complet */ }
    }
  };
  try {
    const { data, error } = await a.from('stores').select('id, name').eq('owner_type', 'reseller').eq('owner_id', proprietaireId);
    if (error) return error.code === '42P01' || error.code === 'PGRST205' ? rien : { ok: false };
    for (const b of (Array.isArray(data) ? data : []) as { id: string; name: string | null }[]) {
      if (estEnseigne(b.name, ancienNom) || b.name === nom) continue;
      const { error: echec } = await ecrire(b.id, nom);
      if (echec) {
        await annuler();
        return { ok: false };
      }
      faites.push({ id: b.id, name: b.name });
    }
  } catch {
    await annuler();
    return { ok: false };
  }
  return { ok: true, annuler };
}

/**
 * Boutique d'une adresse.
 *
 * Lot 8 du chantier boutique (2026-10-03) : une boutique peut changer d'adresse UNE
 * fois (changerAdresse). Quand aucune boutique ne porte l'adresse demandée, elle est
 * cherchée parmi les ANCIENNES adresses (store_slug_aliases) : la boutique revient
 * avec son adresse actuelle dans `slug` et l'adresse demandée dans `ancienneAdresse`.
 * Les liens, QR codes et notifications déjà partagés restent valides : la vitrine
 * redirige, « Suivre » et la mesure des visites d'un onglet resté ouvert répondent.
 *
 * Une lecture de plus, seulement pour une adresse introuvable. Table absente (SQL
 * pas exécuté) ou lecture en échec : null, la page introuvable d'avant.
 */
export async function boutiqueParSlug(slug: string): Promise<BoutiqueReseau | null> {
  const a = getSupabaseAdmin();
  if (!a) return null;
  const demandee = slug.trim();
  const { data, error } = await a.from('stores').select('*').ilike('slug', demandee).maybeSingle();
  if (error) return null;
  if (data) return versBoutique(data);

  // Une ancienne adresse est toujours une adresse qui a existé : minuscules,
  // chiffres et tirets. Tout le reste (robots, fautes de frappe) s'arrête ici.
  const ancienne = demandee.toLowerCase();
  if (!/^[a-z0-9-]{1,80}$/.test(ancienne)) return null;
  const { data: alias, error: erreurAlias } = await a.from('store_slug_aliases').select('store_id').eq('slug', ancienne).maybeSingle();
  const boutiqueId = !erreurAlias && alias && typeof alias.store_id === 'string' ? alias.store_id : null;
  if (!boutiqueId) return null;
  const { data: actuelle, error: erreurBoutique } = await a.from('stores').select('*').eq('id', boutiqueId).maybeSingle();
  if (erreurBoutique || !actuelle) return null;
  return { ...versBoutique(actuelle), ancienneAdresse: ancienne };
}

export async function boutiqueDuProprietaire(
  typeProprietaire: TypeProprietaire,
  proprietaireId: string,
): Promise<BoutiqueReseau | null> {
  const a = getSupabaseAdmin();
  if (!a) return null;
  // Plusieurs boutiques possibles depuis le 2026-09-24 : on prend la
  // principale (la plus ancienne si la colonne n'existe pas encore). Un
  // maybeSingle() échouerait dès la deuxième boutique.
  const { data, error } = await a
    .from('stores')
    .select('*')
    .eq('owner_type', typeProprietaire)
    .eq('owner_id', proprietaireId)
    .order('created_at', { ascending: true })
    .limit(10);
  if (error || !data || data.length === 0) return null;
  const principale = data.find((b: any) => b.principale !== false) || data[0];
  return versBoutique(principale);
}

/**
 * UNE boutique d'un compte, par son identifiant (relecture du lot 7 du chantier
 * boutique, 2026-10-03).
 *
 * Distingue la PANNE de l'absence. Avant, la vérification « cette boutique est-elle
 * à ce compte ? » relisait toutes les boutiques du compte (1 + N lectures) par une
 * fonction qui avale les erreurs : une lecture de `stores` en panne donnait « aucune
 * boutique », donc « Boutique introuvable » (404) au vrai propriétaire, sans
 * « Réessayer ».
 *  - `illisible: true` : la base n'a pas répondu — les routes répondent 503 ;
 *  - `boutique: null` et `illisible: false` : elle n'existe pas, ou elle est à un
 *    autre compte (le propriétaire fait partie de la requête) — 404.
 * Une seule lecture, par la clé primaire.
 */
export async function lireBoutiqueDuCompte(
  typeProprietaire: Exclude<TypeProprietaire, 'suguba'>,
  proprietaireId: string,
  boutiqueId: string,
): Promise<{ boutique: BoutiqueReseau | null; illisible: boolean }> {
  const a = getSupabaseAdmin();
  if (!a) return { boutique: null, illisible: true };
  const { data, error } = await a
    .from('stores')
    .select('*')
    .eq('id', boutiqueId)
    .eq('owner_type', typeProprietaire)
    .eq('owner_id', proprietaireId)
    .maybeSingle();
  if (error) return { boutique: null, illisible: true };
  return { boutique: data ? versBoutique(data) : null, illisible: false };
}

/**
 * Adresses essayées, dans l'ordre, pour une nouvelle boutique (relecture du
 * lot 1 du chantier boutique, 2026-10-03).
 *
 * Les boutiques revendeur sont créées avec « Prénom I. » : « moussa-t »,
 * « fatoumata-d »… se répètent bien plus que le nom complet. L'ancienne suite
 * « -2 » à « -30 » faisait jusqu'à 30 insertions en série, puis abandonnait :
 * le 31e homonyme n'avait pas de boutique. Désormais : l'adresse simple,
 * 4 numéros lisibles, puis un suffixe tiré de l'identifiant du compte (propre à lui,
 * et stable d'un essai à l'autre), enfin un suffixe aléatoire. 10 essais au plus.
 */
export function slugsCandidats(base: string, proprietaireId: string | null | undefined): string[] {
  const propre = String(proprietaireId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const hasard = (globalThis.crypto?.randomUUID?.() || `${Date.now()}${Math.random()}`).toLowerCase().replace(/[^a-z0-9]/g, '');
  const candidats = [
    base,
    ...[2, 3, 4, 5].map((n) => `${base}-${n}`),
    ...[4, 6, 8, 12].filter((n) => propre.length >= n).map((n) => `${base}-${propre.slice(0, n)}`),
    `${base}-${hasard.slice(0, 8)}`,
  ];
  return Array.from(new Set(candidats));
}

/**
 * Parmi `candidats`, les adresses qu'une boutique a DÉJÀ portées avant de changer
 * d'adresse (lot 8 du chantier boutique, 2026-10-03). Une nouvelle boutique ne doit
 * jamais en recevoir une : elle capterait les liens et QR codes de l'autre, qui
 * redirigent vers sa nouvelle adresse.
 *
 * Table absente (SQL pas exécuté) : ensemble vide, rien à écarter. null quand la
 * lecture échoue pour une autre raison : l'appelant ne crée rien — jamais « aucune
 * ancienne adresse » inventé sur une panne.
 *
 * Relecture du lot 8 (2026-10-03) : cette lecture ÉVITE d'essayer une ancienne
 * adresse, elle ne la protège pas. Un changement d'adresse validé entre cette
 * lecture et l'insertion passait : la nouvelle boutique recevait l'ancienne adresse
 * d'une autre, captait ses liens et QR codes (boutiqueParSlug sert `stores` avant
 * les anciennes adresses) et ne pouvait plus jamais changer d'adresse. La garantie
 * est maintenant dans la BASE : le déclencheur stores_ancienne_adresse_reservee
 * (supabase/A-EXECUTER-2026-10-03-vitrine-boutique.sql) refuse l'insertion avec le
 * code 23505, celui d'une adresse déjà prise — les appelants passent à l'adresse
 * suivante. Fichier pas relancé depuis cet ajout : la règle tient par le code seul.
 */
export async function adressesDejaPortees(a: Admin, candidats: readonly string[]): Promise<Set<string> | null> {
  if (candidats.length === 0) return new Set();
  const { data, error } = await a.from('store_slug_aliases').select('slug').in('slug', candidats.map((c) => c.toLowerCase()));
  if (error) return aliasAbsents(error) ? new Set() : null;
  return new Set((Array.isArray(data) ? data : []).map((l: any) => String(l.slug)));
}

/**
 * Récupère la boutique d'un compte, ou la crée au premier accès.
 *
 * L'adresse (slug) est attribuée à la création et ne suit PAS le nom : la
 * renommer à chaque changement de nom casserait les liens et QR codes déjà
 * partagés — même règle que pour les fournisseurs (voir migration-boutiques.sql).
 * Lot 8 (2026-10-03) : son propriétaire peut la changer UNE fois (changerAdresse),
 * l'ancienne adresse redirige alors pour toujours vers la nouvelle. Une adresse
 * déjà portée par une autre boutique n'est donc jamais donnée à une nouvelle.
 */
export async function obtenirOuCreerBoutique(params: {
  typeProprietaire: TypeProprietaire;
  proprietaireId: string;
  nom: string;
  /**
   * Texte dont l'adresse est tirée, quand ce n'est pas le nom (lot 2 du chantier
   * boutique, 2026-10-03) : un revendeur qui tape son nom complet comme nom de
   * boutique au démarrage ne doit pas recevoir /boutique/prenom-nom pour toujours.
   */
  adresseDepuis?: string;
  logo?: string | null;
  description?: string | null;
}): Promise<BoutiqueReseau | null> {
  const existante = await boutiqueDuProprietaire(params.typeProprietaire, params.proprietaireId);
  if (existante) return existante;

  const a = getSupabaseAdmin();
  if (!a) return null;

  // Adresse réservée à Suguba (relecture du lot 2, 2026-10-03) : « suguba »,
  // « suguba-officiel », « admin »… ne sont jamais données à une autre boutique,
  // même tirées du nom d'un compte. Elle part alors d'une adresse neutre.
  const adresse = slugifier(params.adresseDepuis || params.nom);
  const base = params.typeProprietaire !== 'suguba' && adresseReservee(adresse) ? 'ma-boutique' : adresse;
  const candidats = slugsCandidats(base, params.proprietaireId);
  // Anciennes adresses d'autres boutiques (lot 8) : écartées, en une lecture.
  const portees = await adressesDejaPortees(a, candidats);
  if (!portees) {
    console.error('[RESEAU] Création de boutique impossible : anciennes adresses illisibles.');
    return null;
  }
  for (const candidat of candidats.filter((c) => !portees.has(c))) {
    const { data, error } = await a
      .from('stores')
      .insert({
        owner_type: params.typeProprietaire,
        owner_id: params.proprietaireId,
        slug: candidat,
        name: params.nom,
        ...(params.logo !== undefined ? { logo_url: params.logo } : {}),
        ...(params.description !== undefined ? { description: params.description } : {}),
      })
      .select('*')
      .maybeSingle();
    if (!error && data) return versBoutique(data);
    if (schemaIncomplet(error)) {
      console.warn('[RESEAU] Table stores absente — appliquez supabase/migration-reseau-v1.sql.');
      return null;
    }
    if (error?.code !== '23505') {
      console.error('[RESEAU] Création de boutique impossible:', error?.code);
      return null;
    }
    // 23505 : le slug est pris, la boutique vient d'être créée en parallèle, ou
    // c'est l'ancienne adresse d'une boutique qui change d'adresse au même instant
    // (déclencheur stores_ancienne_adresse_reservee, relecture du lot 8).
    const concurrente = await boutiqueDuProprietaire(params.typeProprietaire, params.proprietaireId);
    if (concurrente) return concurrente;
  }
  return null;
}

const CHAMPS_MODIFIABLES: Record<string, string> = {
  nom: 'name',
  accroche: 'tagline',
  description: 'description',
  logo: 'logo_url',
  couverture: 'cover_url',
  whatsapp: 'whatsapp',
};

/**
 * Adresse d'image acceptable : https, 600 caractères au plus, sans espace ni
 * guillemet. Gardée ENTIÈRE ou refusée, jamais tronquée (voir majBoutique).
 */
function adresseImageValide(url: string): boolean {
  return url.length <= 600 && /^https:\/\/[^\s"'<>]+$/.test(url);
}

/** La base ne connaît pas cette colonne : pas encore créée (42703), ou cache de l'API pas rechargé (PGRST204). */
function colonneAbsente(error: { code?: string } | null): boolean {
  return !!error && (error.code === '42703' || error.code === 'PGRST204');
}

/**
 * Met à jour une boutique. Liste blanche stricte : ni le slug, ni le
 * propriétaire, ni le nombre d'abonnés ne sont modifiables par cette route —
 * un revendeur pourrait sinon s'attribuer 10 000 abonnés. L'adresse (slug) ne
 * change que par changerAdresse, une seule fois (lot 8).
 *
 * Lot 6 du chantier boutique (2026-10-03) : `vitrine` porte les réglages de
 * vitrine (rayons maison, annonce datée). Ils ne passent JAMAIS par `champs` :
 * les routes qui transmettent le corps de la requête tel quel (fournisseur,
 * boutique Suguba) ne peuvent donc pas les écrire. Seul l'appelant qui a lu la
 * sélection réelle d'articles les fournit. Ils sont validés et fusionnés avec
 * ceux déjà enregistrés (normaliserReglages) ; si la colonne stores.reglages
 * n'existe pas encore, la réponse est `statut: 409` « Option pas encore
 * activée », et rien n'est écrit — jamais une erreur 500.
 */
export async function majBoutique(
  boutiqueId: string,
  /** null = boutique Suguba, qui n'a pas de propriétaire individuel. */
  proprietaireId: string | null,
  champs: Record<string, unknown>,
  vitrine?: {
    /** Ce que le navigateur envoie : { rayons?, annonce? }. */
    reglages: unknown;
    /** Articles de la sélection réelle de la boutique ; exigée pour écrire des rayons. */
    selection?: readonly string[] | null;
    maintenant?: number;
  },
): Promise<{ ok: boolean; erreur?: string; statut?: number }> {
  const a = getSupabaseAdmin();
  if (!a) return { ok: false, erreur: 'Base indisponible.' };

  const ligne: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [cle, colonne] of Object.entries(CHAMPS_MODIFIABLES)) {
    if (!(cle in champs)) continue;
    const valeur = champs[cle];
    if (valeur === null) { ligne[colonne] = null; continue; }
    if (typeof valeur !== 'string') continue;
    // Logo et couverture : une adresse d'image se garde ENTIÈRE. Coupée à 160
    // caractères (bug corrigé le 2026-09-26), elle ne menait plus à rien et
    // la boutique affichait une image cassée. Une adresse trop longue ou qui
    // n'est pas une image en https est refusée, jamais tronquée.
    if (cle === 'logo' || cle === 'couverture') {
      const url = valeur.trim();
      if (url && !adresseImageValide(url)) {
        return { ok: false, erreur: 'Image invalide. Envoyez-la à nouveau.' };
      }
      ligne[colonne] = url || null;
      continue;
    }
    const propre = valeur.trim().slice(0, cle === 'description' ? 1200 : 160);
    if (cle === 'nom' && propre.length < 2) return { ok: false, erreur: 'Le nom de la boutique est trop court.' };
    ligne[colonne] = propre || null;
  }
  // Galerie : même règle que le logo (lot 2 du chantier boutique, 2026-10-03).
  // Elle acceptait n'importe quelle chaîne (javascript:, http://, adresse
  // tronquée) avant d'être ouverte aux revendeurs. Une seule adresse invalide
  // refuse TOUT l'enregistrement : rien n'est écrit, la galerie reste intacte.
  if (Array.isArray(champs.galerie)) {
    const galerie: string[] = [];
    for (const u of champs.galerie as unknown[]) {
      const url = typeof u === 'string' ? u.trim() : '';
      if (!url || !adresseImageValide(url)) return { ok: false, erreur: 'Une photo de la galerie est invalide. Envoyez-la à nouveau.' };
      galerie.push(url);
    }
    ligne.gallery = galerie.slice(0, MAX_GALERIE);
  }
  if (Array.isArray(champs.categories)) {
    ligne.categories = (champs.categories as unknown[]).filter((c) => typeof c === 'string').slice(0, 12);
  }
  if (typeof champs.recrute === 'boolean') ligne.is_recruiting = champs.recrute;
  // Quartier : uniquement un nom de la liste canonique, sinon la boutique ne
  // pourrait pas être située et n'apparaîtrait dans aucune recherche.
  if ('quartier' in champs) {
    const q = champs.quartier;
    if (q === null || q === '') ligne.neighborhood = null;
    else if (typeof q === 'string' && quartierReconnu(q)) ligne.neighborhood = q.trim();
    else return { ok: false, erreur: 'Choisissez un quartier de la liste.' };
  }

  // Réglages de vitrine (lot 6) : la ligne est relue pour savoir si l'option
  // existe (colonne `reglages`) et pour fusionner avec ce qui est enregistré.
  if (vitrine) {
    const lecture = a.from('stores').select('*').eq('id', boutiqueId);
    const { data: actuelle, error: erreurLecture } = await (proprietaireId
      ? lecture.eq('owner_id', proprietaireId)
      : lecture.is('owner_id', null).eq('owner_type', 'suguba')
    ).maybeSingle();
    if (erreurLecture || !actuelle) return { ok: false, erreur: 'Boutique introuvable.', statut: 404 };
    if (!('reglages' in actuelle)) return { ok: false, erreur: OPTION_ABSENTE, statut: 409 };
    const resultat = normaliserReglages(vitrine.reglages, {
      selection: vitrine.selection,
      maintenant: vitrine.maintenant,
      actuels: lireReglages(actuelle.reglages),
    });
    if (!resultat.ok) return { ok: false, erreur: resultat.erreur };
    ligne.reglages = resultat.reglages;
  }

  const ecrire = (valeurs: Record<string, unknown>) => {
    const requete = a.from('stores').update(valeurs).eq('id', boutiqueId);
    return proprietaireId ? requete.eq('owner_id', proprietaireId) : requete.is('owner_id', null).eq('owner_type', 'suguba');
  };
  let { error } = await ecrire(ligne);
  // Base pas encore migrée (colonne `neighborhood` absente) : un quartier
  // vide ne doit pas empêcher d'enregistrer le reste de la boutique.
  if (error?.code === '42703' && 'neighborhood' in ligne) {
    if (ligne.neighborhood !== null) {
      return { ok: false, erreur: 'Le quartier de boutique n’est pas encore activé (mise à jour de la base à appliquer).' };
    }
    delete ligne.neighborhood;
    ({ error } = await ecrire(ligne));
  }
  if (error && 'reglages' in ligne) {
    // Colonne disparue entre la lecture et l'écriture, ou cache de l'API pas encore
    // rechargé après le SQL : même réponse que si l'option n'existait pas.
    if (colonneAbsente(error)) return { ok: false, erreur: OPTION_ABSENTE, statut: 409 };
    // Contrainte stores_reglages_objet (16 Ko) : hors d'atteinte avec 8 rayons et 60 articles.
    if (error.code === '23514') return { ok: false, erreur: 'Vos rayons prennent trop de place. Retirez-en un.' };
  }
  if (error) return { ok: false, erreur: error.message };
  return { ok: true };
}

// ── Adresse à l'enseigne (lot 8 du chantier boutique, 2026-10-03) ───────────

/**
 * Ce que la base permet pour l'adresse d'une boutique.
 *  - `option` : la table store_slug_aliases existe (SQL exécuté). Faux : la section
 *    « Adresse de ma boutique » n'est pas proposée — table absente ou lecture en
 *    échec, ce n'est jamais un écran « en panne » ;
 *  - `ancienne` : l'adresse d'avant le changement, s'il a déjà eu lieu (il est
 *    unique) ; null tant que la boutique n'a jamais changé d'adresse.
 * Une seule lecture, par l'index idx_store_slug_aliases_store.
 */
export async function etatAdresse(boutiqueId: string): Promise<{ option: boolean; ancienne: string | null }> {
  const a = getSupabaseAdmin();
  if (!a) return { option: false, ancienne: null };
  const { data, error } = await a.from('store_slug_aliases').select('slug').eq('store_id', boutiqueId).limit(1);
  if (error || !Array.isArray(data)) return { option: false, ancienne: null };
  const ancienne = data[0] && typeof (data[0] as any).slug === 'string' ? String((data[0] as any).slug) : null;
  return { option: true, ancienne };
}

/**
 * L'adresse est-elle libre : portée par aucune boutique, ni aujourd'hui (stores)
 * ni avant (store_slug_aliases) ? null quand on ne sait pas (lecture en échec) :
 * jamais « libre » sur une panne. Simple aide à la saisie : c'est la fonction SQL
 * de changerAdresse, transactionnelle, qui décide au moment du changement.
 */
export async function adresseLibre(adresse: string): Promise<boolean | null> {
  const a = getSupabaseAdmin();
  if (!a || !adresseBienFormee(adresse)) return null;
  // `adresse` ne contient que [a-z0-9-] : aucun joker pour ilike.
  const { data: active, error } = await a.from('stores').select('id').ilike('slug', adresse).limit(1);
  if (error || !Array.isArray(active)) return null;
  if (active.length > 0) return false;
  const { data: anciennes, error: erreurAlias } = await a.from('store_slug_aliases').select('slug').eq('slug', adresse).limit(1);
  if (erreurAlias || !Array.isArray(anciennes)) return null;
  return anciennes.length === 0;
}

/**
 * Change l'adresse d'une boutique — UNE seule fois (décision du fondateur).
 *
 * Tout se joue dans la fonction SQL changer_adresse_boutique (transactionnelle,
 * réservée à service_role) : elle vérifie que la boutique est bien à ce
 * propriétaire, qu'elle n'a jamais changé d'adresse, que la nouvelle n'est portée
 * par aucune boutique ni aucune ancienne adresse, puis garde l'ancienne dans
 * store_slug_aliases — /boutique/<ancienne> redirige alors vers la nouvelle
 * (boutiqueParSlug). Aucune table d'articles n'est touchée : reseller_shop_items
 * garde son effet commercial.
 *
 * Refusé ICI, avant la base, ce qu'elle ne connaît pas : adresse réservée à
 * Suguba, sans lettre, numéro de téléphone (refusAdresse).
 *
 * Fonction ou table absente (PGRST202, 42883, 42P01, PGRST205) : 'indisponible',
 * l'option n'existe simplement pas encore. Toute autre erreur : 'erreur'. La
 * fonction est une seule transaction : jamais d'adresse changée sans son ancienne
 * adresse gardée. Si seule la réponse s'est perdue, un nouvel essai répondrait
 * 'deja_change' : l'écran relit donc l'état de l'adresse et affiche la nouvelle
 * (AdresseBoutique, relecture du lot 8), sans attendre un rechargement.
 */
export async function changerAdresse(boutiqueId: string, proprietaireId: string, nouveau: string): Promise<ResultatAdresse> {
  const adresse = adresseDepuis(nouveau);
  if (!adresseBienFormee(adresse)) return 'invalide';
  if (refusAdresse(adresse) !== null) return 'reservee';
  const a = getSupabaseAdmin();
  if (!a || !boutiqueId || !proprietaireId) return 'erreur';
  const { data, error } = await a.rpc('changer_adresse_boutique', {
    p_store_id: boutiqueId,
    p_owner_id: proprietaireId,
    p_nouveau: adresse,
  });
  if (error) {
    if (aliasAbsents(error) || error.code === 'PGRST202' || error.code === '42883') return 'indisponible';
    console.error('[RESEAU] Changement d’adresse impossible:', error.code);
    return 'erreur';
  }
  const reponses: readonly ResultatAdresse[] = ['ok', 'invalide', 'introuvable', 'identique', 'deja_change', 'pris'];
  return reponses.includes(data as ResultatAdresse) ? (data as ResultatAdresse) : 'erreur';
}

// ── Abonnements ────────────────────────────────────────────────────────────

/**
 * Clé d'abonné : l'id de profil pour un compte, le téléphone normalisé
 * sinon. Suivre une boutique ne doit pas exiger de créer un compte (§ 10),
 * sous peine que personne ne suive.
 */
export function cleAbonne(params: { profileId?: string | null; telephone?: string | null }): string | null {
  if (params.profileId) return `p:${params.profileId}`;
  const tel = cleClient(params.telephone || '');
  return tel ? `t:${tel}` : null;
}

export async function basculerAbonnement(params: {
  boutiqueId: string;
  cle: string;
  profileId?: string | null;
}): Promise<{ suit: boolean; abonnes: number } | null> {
  const a = getSupabaseAdmin();
  if (!a) return null;

  const { data: deja, error } = await a
    .from('store_follows')
    .select('store_id')
    .eq('store_id', params.boutiqueId)
    .eq('follower_key', params.cle)
    .maybeSingle();
  if (error && schemaIncomplet(error)) return null;

  if (deja) {
    await a.from('store_follows').delete().eq('store_id', params.boutiqueId).eq('follower_key', params.cle);
  } else {
    await a.from('store_follows').insert({
      store_id: params.boutiqueId,
      follower_key: params.cle,
      follower_id: params.profileId || null,
    });
  }

  const { data: total } = await a.rpc('rafraichir_abonnes_boutique', { p_store_id: params.boutiqueId });
  return { suit: !deja, abonnes: Number(total) || 0 };
}

export async function suitLaBoutique(boutiqueId: string, cle: string): Promise<boolean> {
  const a = getSupabaseAdmin();
  if (!a) return false;
  const { data } = await a
    .from('store_follows')
    .select('store_id')
    .eq('store_id', boutiqueId)
    .eq('follower_key', cle)
    .maybeSingle();
  return Boolean(data);
}

export async function boutiquesSuivies(cle: string): Promise<BoutiqueReseau[]> {
  const a = getSupabaseAdmin();
  if (!a) return [];
  const { data, error } = await a.from('store_follows').select('store_id').eq('follower_key', cle);
  if (error || !data || data.length === 0) return [];
  const { data: boutiques } = await a.from('stores').select('*').in('id', data.map((f) => f.store_id));
  // Liste affichée au client : noms publics (relecture du lot 2, 2026-10-03).
  return nomsPublicsRevendeurs(a, (boutiques || []).map(versBoutique), (b) => b);
}

/**
 * Boutiques qui recrutent des revendeurs — bannière § 18.
 *
 * Relecture du lot 2 (2026-10-03) : boutiques fournisseur et Suguba seulement.
 * Recruter est une notion fournisseur ; une boutique revendeur passée à
 * is_recruiting par l'ancienne route de modification n'y figure plus.
 */
export async function boutiquesQuiRecrutent(limite = 12): Promise<BoutiqueReseau[]> {
  const a = getSupabaseAdmin();
  if (!a) return [];
  const { data, error } = await a
    .from('stores')
    .select('*')
    .eq('is_recruiting', true)
    .eq('status', 'active')
    .neq('owner_type', 'reseller')
    .order('followers_count', { ascending: false })
    .limit(limite);
  if (error) return [];
  return (data || []).map(versBoutique);
}

/**
 * Boutiques situées dans un quartier ou à proximité (2026-09-18).
 *
 * Le quartier vient de la boutique elle-même (`stores.neighborhood`, choisi
 * par son propriétaire) ; à défaut, pour un fournisseur, de son entrepôt
 * déclaré à l'inscription. Celui d'un revendeur n'est JAMAIS déduit de son
 * profil : c'est souvent son domicile, il doit choisir de l'afficher.
 * Fonctionne aussi avant la migration (colonne absente → entrepôts seuls).
 */
export async function boutiquesParQuartier(
  quartier: string,
  limite = 40,
  /** Faux (profil « Priorité au réseau », 2026-09-26) : seules les boutiques revendeurs et Suguba. */
  avecFournisseurs = true,
): Promise<{ boutique: BoutiqueReseau; niveau: NiveauProximite; distanceKm: number }[]> {
  const a = getSupabaseAdmin();
  if (!a || !quartierReconnu(quartier)) return [];
  const { data, error } = await a
    .from('stores')
    .select('*')
    .eq('status', 'active')
    .order('followers_count', { ascending: false })
    .limit(500);
  if (error || !data) return [];

  const boutiques = data.map(versBoutique).filter((b) => avecFournisseurs || b.typeProprietaire !== 'supplier');
  // Noms publics des boutiques revendeur, lus seulement pour celles retenues
  // (relecture du lot 2, 2026-10-03 : stores.name brut publiait le nom complet).
  const publier = (liste: { boutique: BoutiqueReseau; niveau: NiveauProximite; distanceKm: number }[]) =>
    nomsPublicsRevendeurs(a, liste, (r) => r.boutique);
  if (!avecFournisseurs) return publier(classerParProximite(quartier, boutiques).slice(0, limite));
  const fournisseursSansQuartier = boutiques
    .filter((b) => !b.quartier && b.typeProprietaire === 'supplier' && b.proprietaireId)
    .map((b) => b.proprietaireId as string);
  if (fournisseursSansQuartier.length) {
    const { data: entrepots } = await a
      .from('suppliers')
      .select('profile_id, warehouse_neighborhood')
      .in('profile_id', fournisseursSansQuartier);
    const parFournisseur = new Map((entrepots || []).map((e) => [e.profile_id, e.warehouse_neighborhood as string | null]));
    for (const b of boutiques) {
      if (!b.quartier && b.typeProprietaire === 'supplier' && b.proprietaireId) {
        b.quartier = parFournisseur.get(b.proprietaireId) || null;
      }
    }
  }

  // Fournisseurs actifs qui n'ont pas encore ouvert « Ma boutique » (la
  // fiche `stores` se crée à ce moment-là) : leur vitrine historique
  // /s/<slug> existe déjà, ils ne doivent pas être invisibles pour autant.
  const avecBoutique = new Set(boutiques.filter((b) => b.typeProprietaire === 'supplier').map((b) => b.proprietaireId));
  const { data: actifs } = await a.from('profile_roles').select('profile_id').eq('role', 'supplier').eq('status', 'active');
  const idsActifs = (actifs || []).map((r) => r.profile_id as string).filter((id) => !avecBoutique.has(id));
  if (idsActifs.length) {
    const { data: fournisseurs } = await a.from('suppliers').select('*').in('profile_id', idsActifs.slice(0, 500));
    for (const f of fournisseurs || []) {
      if (!f.slug || !f.warehouse_neighborhood) continue;
      boutiques.push({
        ...versBoutique({ id: `fournisseur:${f.profile_id}`, owner_type: 'supplier', owner_id: f.profile_id }),
        slug: f.slug,
        nom: f.shop_display_name || f.company_name || 'Boutique',
        accroche: f.category || null,
        logo: f.logo_url || null,
        quartier: f.warehouse_neighborhood,
        lien: `/s/${f.slug}`,
      });
    }
  }
  return publier(classerParProximite(quartier, boutiques).slice(0, limite));
}

/**
 * Boutique de Suguba elle-même (§ 24). Une seule : retrouvée par son type,
 * créée au premier accès avec l'adresse /boutique/suguba si elle est libre.
 */
export async function boutiqueSuguba(creerSiAbsente: boolean): Promise<BoutiqueReseau | null> {
  const a = getSupabaseAdmin();
  if (!a) return null;
  const { data, error } = await a.from('stores').select('*').eq('owner_type', 'suguba').order('created_at').limit(1).maybeSingle();
  if (error) return null;
  if (data) return versBoutique(data);
  if (!creerSiAbsente) return null;
  for (const slug of ['suguba', 'suguba-officiel', 'boutique-suguba']) {
    const { data: cree, error: e } = await a.from('stores')
      .insert({ owner_type: 'suguba', owner_id: null, slug, name: 'Suguba', tagline: 'La boutique officielle Suguba' })
      .select('*').maybeSingle();
    if (!e && cree) return versBoutique(cree);
    if (e?.code !== '23505') return null;
  }
  return null;
}
