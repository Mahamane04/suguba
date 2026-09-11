/**
 * Boutiques publiques — SERVEUR UNIQUEMENT.
 *
 * Les vitrines sont servies par le serveur (service_role), qui ne renvoie que
 * des champs sûrs. Jamais le prix fournisseur, jamais la commission, jamais le
 * téléphone ni l'adresse du fournisseur : c'est Suguba qui vend et qui livre,
 * et une coordonnée directe ouvrirait la porte à la vente hors plateforme.
 *
 * Ne jamais importer ce fichier depuis un composant 'use client'.
 */
import { getSupabaseAdmin } from './supabase-admin';

type ClientAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export const URL_APP = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.sugubaml.com').replace(/\/$/, '');

export interface ProduitVitrine {
  id: string;
  slug: string;
  nom: string;
  categorie: string;
  image: string | null;
  /** Toutes les photos, pour le carrousel de la carte produit. */
  images: string[];
  prix: number;
  enStock: boolean;
  garantieMois: number;
}

export interface Boutique {
  type: 'fournisseur' | 'revendeur';
  nom: string;
  categorie: string | null;
  produits: ProduitVitrine[];
  /** Livraisons réussies des produits présentés. Affichée seulement si > 0. */
  livraisons: number;
  /** Revendeur sans sélection : on montre le catalogue partageable à la place. */
  selectionVide: boolean;
  code: string | null;
}

/** « Électro Diarra & Fils » → « electro-diarra-fils ». */
export function slugifier(texte: string): string {
  return (
    texte
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'boutique'
  );
}

/**
 * Attribue au fournisseur l'adresse publique de sa boutique, s'il n'en a pas.
 *
 * Une adresse déjà attribuée n'est JAMAIS modifiée, même si l'entreprise
 * change de nom : elle figure dans des liens partagés sur WhatsApp qui
 * cesseraient de fonctionner.
 */
export async function attribuerSlugFournisseur(
  admin: ClientAdmin,
  profileId: string,
  nomEntreprise: string,
): Promise<string | null> {
  const { data: actuel, error: lecture } = await admin.from('suppliers').select('slug').eq('profile_id', profileId).maybeSingle();
  // Colonne absente (migration-boutiques.sql pas encore appliquée) : inutile
  // d'essayer trente adresses qui échoueraient toutes.
  if (lecture) return null;
  if (actuel?.slug) return actuel.slug;

  const base = slugifier(nomEntreprise);
  for (let i = 0; i < 30; i++) {
    const candidat = i === 0 ? base : `${base}-${i + 1}`;
    const { data: pris } = await admin.from('suppliers').select('profile_id').eq('slug', candidat).maybeSingle();
    if (pris && pris.profile_id !== profileId) continue;
    const { error } = await admin.from('suppliers').update({ slug: candidat }).eq('profile_id', profileId);
    if (!error) return candidat;
  }
  console.error('[BOUTIQUE] Impossible d\'attribuer une adresse au fournisseur', profileId);
  return null;
}

function versVitrine(p: any): ProduitVitrine {
  return {
    id: p.id,
    slug: p.slug,
    nom: p.name,
    categorie: p.category || '',
    image: Array.isArray(p.images) && p.images[0] ? String(p.images[0]) : null,
    images: Array.isArray(p.images) ? p.images.filter(Boolean).map(String) : [],
    prix: Number(p.public_price) || 0,
    enStock: Number(p.stock) > 0,
    garantieMois: Number(p.warranty_months) || 0,
  };
}

const CHAMPS_PRODUIT = 'id, slug, name, category, images, public_price, stock, reseller_commission, pricing_status';

/**
 * Un produit est proposable aux revendeurs s'il leur rapporte quelque chose :
 * ni sous le plancher, ni à commission trop faible.
 */
function partageable(p: any): boolean {
  return Number(p.reseller_commission) > 0 && (!p.pricing_status || p.pricing_status === 'ok');
}

async function compterLivraisons(admin: ClientAdmin, productIds: string[]): Promise<number> {
  if (productIds.length === 0) return 0;
  const { count } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .in('product_id', productIds)
    .eq('status', 'delivered');
  return count ?? 0;
}

export async function chargerBoutiqueFournisseur(slug: string): Promise<Boutique | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data: fournisseur } = await admin
    .from('suppliers')
    .select('profile_id, company_name, category')
    .eq('slug', slug.toLowerCase())
    .maybeSingle();
  if (!fournisseur) return null;

  const { data: produits } = await admin
    .from('products')
    .select(CHAMPS_PRODUIT)
    .eq('supplier_id', fournisseur.profile_id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  const liste = (produits || []).map(versVitrine);
  return {
    type: 'fournisseur',
    nom: fournisseur.company_name,
    categorie: fournisseur.category || null,
    produits: liste,
    livraisons: await compterLivraisons(admin, liste.map((p) => p.id)),
    selectionVide: false,
    code: null,
  };
}

/** « Awa Traoré Diallo » → « Awa D. » : un prénom suffit pour une vitrine publique. */
function nomPublic(nomComplet: string | null): string {
  const mots = String(nomComplet || '').trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return 'Revendeur Suguba';
  if (mots.length === 1) return mots[0];
  return `${mots[0]} ${mots[mots.length - 1].charAt(0).toUpperCase()}.`;
}

export async function chargerBoutiqueRevendeur(codeBrut: string): Promise<Boutique | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const code = codeBrut.trim().toUpperCase();

  const { data: profil } = await admin
    .from('profiles')
    .select('id, full_name, reseller_code')
    .eq('reseller_code', code)
    .maybeSingle();
  if (!profil) return null;

  // Un code revendeur appartenant à un compte suspendu ne doit plus servir de
  // vitrine : les ventes passeraient par un revendeur qu'on a écarté.
  const { data: role } = await admin
    .from('profile_roles')
    .select('status')
    .eq('profile_id', profil.id)
    .eq('role', 'reseller')
    .maybeSingle();
  if (role && role.status !== 'active') return null;

  const { data: selection } = await admin
    .from('reseller_shop_items')
    .select('product_id, position')
    .eq('reseller_id', profil.id)
    .order('position', { ascending: true });

  const ids = (selection || []).map((s) => s.product_id);
  let produits: any[] = [];
  let selectionVide = false;

  if (ids.length > 0) {
    const { data } = await admin.from('products').select(CHAMPS_PRODUIT).in('id', ids).eq('status', 'approved');
    const ordre = new Map(ids.map((id, i) => [id, i]));
    produits = (data || []).filter(partageable).sort((a, b) => (ordre.get(a.id) ?? 0) - (ordre.get(b.id) ?? 0));
  }

  // Un revendeur qui partage sa boutique avant d'avoir choisi ses articles ne
  // doit pas envoyer ses contacts vers une page vide : on présente alors le
  // catalogue partageable, toujours avec son code.
  if (produits.length === 0) {
    selectionVide = true;
    const { data } = await admin
      .from('products')
      .select(CHAMPS_PRODUIT)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(48);
    produits = (data || []).filter(partageable);
  }

  const liste = produits.map(versVitrine);
  return {
    type: 'revendeur',
    nom: nomPublic(profil.full_name),
    categorie: null,
    produits: liste,
    livraisons: 0,
    selectionVide,
    code,
  };
}

export interface ProduitPublic {
  nom: string;
  prix: number;
  categorie: string;
  image: string | null;
}

/**
 * Données d'aperçu d'un produit (page /p/<slug>) : nom, prix public, photo
 * principale — rien d'autre. Un produit non approuvé n'a pas d'aperçu.
 */
export async function chargerProduitPublic(slug: string): Promise<ProduitPublic | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from('products')
    .select('name, category, images, public_price, status')
    .eq('slug', slug)
    .maybeSingle();
  if (!data || data.status !== 'approved') return null;
  return {
    nom: data.name,
    prix: Number(data.public_price) || 0,
    categorie: data.category || '',
    image: Array.isArray(data.images) && data.images[0] ? String(data.images[0]) : null,
  };
}
