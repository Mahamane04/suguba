/**
 * Boutiques (fournisseur, revendeur, Suguba) et abonnements — SERVEUR.
 *
 * La boutique est générique (table `stores`) : c'est ce qui permet à Suguba
 * d'être elle-même vendeuse (§ 24) sans un second système.
 */
import { getSupabaseAdmin } from '../supabase-admin';
import { slugifier } from '../shop';
import { cleClient } from './attribution';
import { classerParProximite, quartierReconnu, type NiveauProximite } from './proximite';

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

function schemaIncomplet(error: { code?: string } | null): boolean {
  return !!error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703');
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
    whatsapp: r.whatsapp || null,
    recrute: Boolean(r.is_recruiting),
    abonnes: Number(r.followers_count) || 0,
    statut: r.status || 'active',
    quartier: r.neighborhood || null,
    principale: r.principale !== false,
  };
}

/** Limite de la galerie, § 7 : « jusqu'à environ 10 images ». */
export const MAX_GALERIE = 10;

export async function boutiqueParSlug(slug: string): Promise<BoutiqueReseau | null> {
  const a = getSupabaseAdmin();
  if (!a) return null;
  const { data, error } = await a.from('stores').select('*').ilike('slug', slug.trim()).maybeSingle();
  if (error || !data) return null;
  return versBoutique(data);
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
 * Récupère la boutique d'un compte, ou la crée au premier accès.
 *
 * L'adresse (slug) n'est attribuée qu'UNE fois : la renommer casserait tous
 * les liens et QR codes déjà partagés — même règle que pour les fournisseurs
 * (voir migration-boutiques.sql).
 */
export async function obtenirOuCreerBoutique(params: {
  typeProprietaire: TypeProprietaire;
  proprietaireId: string;
  nom: string;
}): Promise<BoutiqueReseau | null> {
  const existante = await boutiqueDuProprietaire(params.typeProprietaire, params.proprietaireId);
  if (existante) return existante;

  const a = getSupabaseAdmin();
  if (!a) return null;

  const base = slugifier(params.nom);
  for (let i = 0; i < 30; i++) {
    const candidat = i === 0 ? base : `${base}-${i + 1}`;
    const { data, error } = await a
      .from('stores')
      .insert({
        owner_type: params.typeProprietaire,
        owner_id: params.proprietaireId,
        slug: candidat,
        name: params.nom,
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
    // 23505 : le slug est pris (ou la boutique vient d'être créée en parallèle).
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
 * Met à jour une boutique. Liste blanche stricte : ni le slug, ni le
 * propriétaire, ni le nombre d'abonnés ne sont modifiables par cette route —
 * un revendeur pourrait sinon s'attribuer 10 000 abonnés.
 */
export async function majBoutique(
  boutiqueId: string,
  /** null = boutique Suguba, qui n'a pas de propriétaire individuel. */
  proprietaireId: string | null,
  champs: Record<string, unknown>,
): Promise<{ ok: boolean; erreur?: string }> {
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
      if (url && (url.length > 600 || !/^https:\/\/[^\s"'<>]+$/.test(url))) {
        return { ok: false, erreur: 'Image invalide. Envoyez-la à nouveau.' };
      }
      ligne[colonne] = url || null;
      continue;
    }
    const propre = valeur.trim().slice(0, cle === 'description' ? 1200 : 160);
    if (cle === 'nom' && propre.length < 2) return { ok: false, erreur: 'Le nom de la boutique est trop court.' };
    ligne[colonne] = propre || null;
  }
  if (Array.isArray(champs.galerie)) {
    ligne.gallery = (champs.galerie as unknown[]).filter((u) => typeof u === 'string').slice(0, MAX_GALERIE);
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
  if (error) return { ok: false, erreur: error.message };
  return { ok: true };
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
  return (boutiques || []).map(versBoutique);
}

/** Boutiques qui recrutent des revendeurs — bannière § 18. */
export async function boutiquesQuiRecrutent(limite = 12): Promise<BoutiqueReseau[]> {
  const a = getSupabaseAdmin();
  if (!a) return [];
  const { data, error } = await a
    .from('stores')
    .select('*')
    .eq('is_recruiting', true)
    .eq('status', 'active')
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

  const boutiques = data.map(versBoutique);
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
  return classerParProximite(quartier, boutiques).slice(0, limite);
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
