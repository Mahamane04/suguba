/**
 * Boutiques (fournisseur, revendeur, Suguba) et abonnements — SERVEUR.
 *
 * La boutique est générique (table `stores`) : c'est ce qui permet à Suguba
 * d'être elle-même vendeuse (§ 24) sans un second système.
 */
import { getSupabaseAdmin } from '../supabase-admin';
import { slugifier } from '../shop';
import { cleClient } from './attribution';

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
  const { data, error } = await a
    .from('stores')
    .select('*')
    .eq('owner_type', typeProprietaire)
    .eq('owner_id', proprietaireId)
    .maybeSingle();
  if (error || !data) return null;
  return versBoutique(data);
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

  const requete = a.from('stores').update(ligne).eq('id', boutiqueId);
  const { error } = await (proprietaireId ? requete.eq('owner_id', proprietaireId) : requete.is('owner_id', null).eq('owner_type', 'suguba'));
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
