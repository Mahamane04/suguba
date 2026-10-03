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
import { identiteFournisseur } from './identite-fournisseur';
import { prixEnregistres } from './prix-revendeur';
import { ajoutDirectPossible, lireMesure, lireUniteVente, suffixeUnite, texteMinimum } from './unite-vente';
import { libelleTypeOffre, normaliserTypeOffre } from './offre';
import { estEnseigne, nomPublic } from './enseigne';
import { estCoupDeCoeur, estNouveau, trierSelection, type LigneSelection } from './boutique-ordre';

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
  /**
   * Nature de l'offre (PUB-06, lot 5 de l'audit UI/UX du 2026-10-02) : la carte
   * du catalogue affichait « le kg », « dès 3 », « Sur devis » et le bouton
   * « Ajouter » ; la même carte en vitrine perdait tout et proposait « Acheter ».
   */
  suffixeUnite?: string;
  minimum?: string;
  etiquetteOffre?: string | null;
  quantiteAjout?: number;
  ajoutDirect?: boolean;
  aChoisir?: boolean;
  /**
   * Coup de cœur choisi par le revendeur (position négative, lot 3 du chantier
   * boutique, 2026-10-03) : affiché en tête de sa vitrine, sous « Coups de cœur ».
   */
  coupDeCoeur?: boolean;
  /** Ajouté à la boutique depuis moins de 14 jours : étiquette « Nouveau » (lot 3). */
  nouveau?: boolean;
}

export interface Boutique {
  type: 'fournisseur' | 'revendeur';
  /**
   * Boutique revendeur : l'enseigne choisie, ou « Awa D. » (jamais le nom
   * complet, lot 2 du chantier boutique, 2026-10-03).
   */
  nom: string;
  /**
   * Boutique revendeur : vrai quand `nom` est une enseigne choisie par le
   * revendeur. Le titre est alors l'enseigne seule, sinon « La sélection de
   * Awa D. » (voir titreVitrine, src/lib/enseigne.ts).
   */
  enseigne?: boolean;
  categorie: string | null;
  /** Logo choisi dans "Réglages de ma boutique". null = avatar par défaut. */
  logo: string | null;
  /** Courte présentation, si le fournisseur en a écrit une. */
  description: string | null;
  /** Bannière de la boutique (boutiques du réseau, /boutique/<adresse>). */
  couverture?: string | null;
  /** Badges du propriétaire (clés, voir src/lib/reseau/badges.ts). */
  badges?: string[];
  produits: ProduitVitrine[];
  /** Livraisons réussies des produits présentés. Affichée seulement si > 0. */
  livraisons: number;
  /** Revendeur sans sélection : on montre le catalogue partageable à la place. */
  selectionVide: boolean;
  code: string | null;
  /** Profil du fournisseur (boutiques fournisseur) : sert au profil « Priorité au réseau ». */
  fournisseurId?: string | null;
  /**
   * Page de présentation (lot C, 2026-09-26) : vente directe fermée pour ce
   * fournisseur. Pas de prix ni d'achat ; les revendeurs qui proposent ses
   * produits sont mis en avant.
   */
  presentation?: { revendeurs: { nom: string; lien: string }[] } | null;
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
 * Colonnes de l'offre, lues À PART (même règle que /api/admin/products) : une
 * colonne pas encore créée en production fait échouer cette seule lecture, et
 * la vitrine s'affiche quand même, comme avant.
 */
const CHAMPS_OFFRE = 'id, unite_vente, contenu_valeur, contenu_mesure, quantite_min, mode_commande, mode_prix, mode_remise, type_offre, variant_group';

export function offreVitrine(o: any, enStock: boolean) {
  const unite = lireUniteVente(o.unite_vente);
  const min = Number(o.quantite_min) > 1 ? Number(o.quantite_min) : null;
  const modeRemise = o.mode_remise || 'livreur';
  return {
    suffixeUnite: suffixeUnite(unite, Number(o.contenu_valeur) > 0 ? Number(o.contenu_valeur) : null, lireMesure(o.contenu_mesure)),
    minimum: texteMinimum(unite, min),
    etiquetteOffre: o.mode_commande === 'devis' ? 'Sur devis'
      : libelleTypeOffre(normaliserTypeOffre(o.type_offre))
        || (modeRemise === 'fournisseur' ? 'Remis par le vendeur' : modeRemise === 'retrait' ? 'Chez le vendeur' : null),
    quantiteAjout: min ?? 1,
    ajoutDirect: ajoutDirectPossible({
      enStock, modeCommande: o.mode_commande === 'devis' ? 'devis' : 'achat', modePrix: o.mode_prix === 'gros' ? 'gros' : 'fixe',
      variantes: Boolean(o.variant_group), modeRemise,
    }),
    aChoisir: Boolean(o.variant_group) && enStock,
  };
}

async function avecOffre(admin: ClientAdmin, liste: ProduitVitrine[]): Promise<ProduitVitrine[]> {
  if (liste.length === 0) return liste;
  const { data, error } = await admin.from('products').select(CHAMPS_OFFRE).in('id', liste.map((p) => p.id));
  if (error || !data) return liste;
  const parId = new Map(data.map((o: any) => [o.id, o]));
  return liste.map((p) => (parId.has(p.id) ? { ...p, ...offreVitrine(parId.get(p.id), p.enStock) } : p));
}

/**
 * Un produit est proposable aux revendeurs s'il leur rapporte quelque chose :
 * ni sous le plancher, ni à commission trop faible.
 */
function partageable(p: any): boolean {
  return Number(p.reseller_commission) > 0 && (!p.pricing_status || p.pricing_status === 'ok');
}

/**
 * Nombre d'articles choisis par un revendeur que sa vitrine AFFICHE vraiment
 * (relecture du lot 1 du chantier boutique, 2026-10-03) : approuvés et
 * partageables, même filtre que chargerBoutiqueRevendeur. Compter toutes les
 * lignes de reseller_shop_items disait « 3 articles » et cochait « Choisir mes
 * articles » alors que la vitrine, ces articles retirés ou refusés, montrait le
 * catalogue Suguba. null si l'une des lectures échoue : « — », jamais un 0 inventé.
 */
export async function compterArticlesEnVitrine(admin: ClientAdmin, revendeurId: string): Promise<number | null> {
  return (await compterVitrine(admin, revendeurId)).articles;
}

/**
 * Articles affichés ET coups de cœur parmi eux (lot 3 du chantier boutique,
 * 2026-10-03) : l'étape « 1 coup de cœur » de « Ma boutique est prête à X % ».
 * Un coup de cœur sur un article que la vitrine n'affiche plus ne compte pas.
 * null partout si une lecture échoue.
 */
export async function compterVitrine(admin: ClientAdmin, revendeurId: string): Promise<{ articles: number | null; coupsDeCoeur: number | null }> {
  const illisible = { articles: null, coupsDeCoeur: null };
  const { data: selection, error } = await admin.from('reseller_shop_items').select('product_id, position').eq('reseller_id', revendeurId);
  if (error || !Array.isArray(selection)) return illisible;
  const ids = selection.map((s: any) => s.product_id).filter(Boolean);
  if (ids.length === 0) return { articles: 0, coupsDeCoeur: 0 };
  const { data: produits, error: erreurProduits } = await admin
    .from('products')
    .select('id, reseller_commission, pricing_status')
    .in('id', ids)
    .eq('status', 'approved');
  if (erreurProduits || !Array.isArray(produits)) return illisible;
  const affiches = new Set(produits.filter(partageable).map((p: any) => p.id));
  return {
    articles: affiches.size,
    coupsDeCoeur: selection.filter((s: any) => affiches.has(s.product_id) && estCoupDeCoeur(s.position)).length,
  };
}

/**
 * Articles choisis par le revendeur que sa vitrine ne montre plus (retirés de
 * la vente, refusés, sans commission) — lot 3 du chantier boutique, 2026-10-03.
 * Calculé côté serveur, POUR LE PROPRIÉTAIRE SEULEMENT (/boutique/<adresse>) :
 * différence entre sa sélection et les articles réellement servis. 0 si la
 * lecture échoue : jamais une alerte inventée.
 */
export async function compterArticlesNonServis(revendeurId: string, servis: readonly string[]): Promise<number> {
  const admin = getSupabaseAdmin();
  if (!admin) return 0;
  const { data, error } = await admin.from('reseller_shop_items').select('product_id').eq('reseller_id', revendeurId);
  if (error || !Array.isArray(data)) return 0;
  const affiches = new Set(servis);
  return data.filter((l: any) => l.product_id && !affiches.has(l.product_id)).length;
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

export async function chargerBoutiqueFournisseur(slug: string, identiteChoisie?: { name: string; logo_url: string | null; description: string | null; cover_url: string | null; status: string }): Promise<Boutique | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  // `select('*')` plutôt qu'une liste explicite : les colonnes de
  // personnalisation (shop_display_name, logo_url, shop_description) sont
  // récentes (voir migration-shop-profile.sql) et cette page publique ne doit
  // jamais tomber en erreur si la migration n'est pas encore passée — `*`
  // renvoie simplement ce qui existe, `undefined` pour le reste.
  const { data: fournisseur } = await admin
    .from('suppliers')
    .select('*')
    .eq('slug', slug.toLowerCase())
    .maybeSingle();
  if (!fournisseur) return null;

  const { data: produits } = await admin
    .from('products')
    .select(CHAMPS_PRODUIT)
    .eq('supplier_id', fournisseur.profile_id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  const { data: boutiques } = await admin.from('stores').select('*').eq('owner_type', 'supplier').eq('owner_id', fournisseur.profile_id).order('created_at', { ascending: true }).limit(10);
  const principale = identiteChoisie || boutiques?.find(b => b.principale !== false) || boutiques?.[0] || null;
  if (principale && principale.status !== 'active') return null;
  const identite = identiteFournisseur(fournisseur, principale);
  const liste = await avecOffre(admin, (produits || []).map(versVitrine));
  return {
    type: 'fournisseur',
    nom: identite.nom,
    categorie: fournisseur.category || null,
    logo: identite.logo,
    description: identite.description,
    couverture: identite.couverture,
    produits: liste,
    livraisons: await compterLivraisons(admin, liste.map((p) => p.id)),
    selectionVide: false,
    code: null,
    fournisseurId: fournisseur.profile_id || null,
  };
}

// « Awa Traoré Diallo » → « Awa D. ». Déplacée dans lib/enseigne (lot 2 du chantier
// boutique, 2026-10-03), module pur que les composants client peuvent importer ;
// réexportée ici pour ses appelants historiques.
export { nomPublic };

/**
 * Nom public (« Awa D. ») du revendeur ACTIF derrière un code, pour le
 * bandeau « Recommandé par … » de la fiche produit. Ce bandeau lisait les
 * revendeurs de démonstration : il ne s'affichait jamais pour un vrai code.
 */
export async function nomRevendeurPublic(codeBrut: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const code = codeBrut.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,40}$/.test(code)) return null;

  const { data: profil } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('reseller_code', code)
    .maybeSingle();
  if (!profil) return null;

  const { data: role } = await admin
    .from('profile_roles')
    .select('status')
    .eq('profile_id', profil.id)
    .eq('role', 'reseller')
    .maybeSingle();
  if (!role || role.status !== 'active') return null;

  return nomPublic(profil.full_name);
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

  // Lot 3 du chantier boutique (2026-10-03) : position (négative = coup de cœur)
  // et date d'ajout (« Nouveau » pendant 14 jours). Tri refait ici, identique à
  // « Mes articles » (positions en double laissées par l'ancien ajout).
  const { data: selection } = await admin
    .from('reseller_shop_items')
    .select('product_id, position, added_at')
    .eq('reseller_id', profil.id)
    .order('position', { ascending: true });

  const lignes = trierSelection((selection || []) as LigneSelection[]);
  const ids = lignes.map((s) => s.product_id);
  const parArticle = new Map(lignes.map((s) => [s.product_id, s]));
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

  // Prix de gros (2026-09-24) : le prix choisi par CE revendeur remplace le
  // prix conseillé. Seuls les articles au prix de gros peuvent en avoir un
  // (voir /api/reseller/prix), les autres gardent leur prix fixe.
  const sesPrix = await prixEnregistres(admin, profil.id, produits.map((p) => p.id));
  const maintenant = Date.now();
  const liste = await avecOffre(admin, produits.map((p) => {
    const v = versVitrine(p);
    const avecPrix = sesPrix.has(p.id) ? { ...v, prix: sesPrix.get(p.id) as number } : v;
    // Catalogue Suguba montré à la place d'une sélection vide : ni coup de cœur ni « Nouveau ».
    const ligne = selectionVide ? undefined : parArticle.get(p.id);
    return ligne ? { ...avecPrix, coupDeCoeur: estCoupDeCoeur(ligne.position), nouveau: estNouveau(ligne.added_at, maintenant) } : avecPrix;
  }));
  // Logo, couverture et nom choisis dans « Ma boutique » (table stores). Sans
  // cette lecture, l'ancienne adresse /r/<code> — celle que les revendeurs
  // partagent le plus — affichait l'initiale et le fond par défaut même après
  // personnalisation (bug signalé le 2026-09-25). Lecture directe : importer
  // lib/reseau/boutiques créerait une dépendance circulaire.
  const { data: magasins } = await admin
    .from('stores')
    .select('*')
    .eq('owner_type', 'reseller')
    .eq('owner_id', profil.id)
    .order('created_at', { ascending: true })
    .limit(10);
  const magasin = (magasins || []).find((b: any) => b.principale !== false) || (magasins || [])[0] || null;
  const actif = magasin && (magasin.status || 'active') === 'active';
  // Titre public (lot 2 du chantier boutique, 2026-10-03) : l'enseigne seulement
  // si le revendeur en a choisi une. Les boutiques créées au nom complet du compte
  // affichaient « La sélection de Awa Traoré Diallo » ; elles affichent désormais
  // « Awa D. ». La comparaison se fait ICI, le nom complet ne quitte pas le serveur.
  const enseigne = Boolean(actif && estEnseigne(magasin.name, profil.full_name));

  return {
    type: 'revendeur',
    nom: enseigne ? String(magasin.name).trim() : nomPublic(profil.full_name),
    enseigne,
    categorie: null,
    logo: (actif && magasin.logo_url) || null,
    couverture: (actif && magasin.cover_url) || null,
    description: (actif && magasin.description) || null,
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

/** Produits vendus par Suguba elle-même : créés par l'admin, sans fournisseur. */
export async function chargerProduitsSuguba(): Promise<ProduitVitrine[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data } = await admin
    .from('products')
    .select(CHAMPS_PRODUIT)
    .eq('status', 'approved')
    .is('supplier_id', null)
    .gt('public_price', 0)
    .order('created_at', { ascending: false })
    .limit(96);
  return avecOffre(admin, (data || []).map(versVitrine));
}

/**
 * Articles d'une boutique SUPPLÉMENTAIRE (2026-09-24, formules Pro) : sa
 * propre sélection (store_products), dans l'ordre choisi. Pour un revendeur,
 * ses prix enregistrés remplacent le prix conseillé des articles au prix de gros.
 */
export async function chargerProduitsDeLaBoutique(storeId: string, revendeurId?: string | null): Promise<ProduitVitrine[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data: selection, error } = await admin.from('store_products')
    .select('product_id, position').eq('store_id', storeId).order('position', { ascending: true });
  if (error || !selection?.length) return [];
  const ids = selection.map((s: any) => s.product_id);
  const { data } = await admin.from('products').select(CHAMPS_PRODUIT).in('id', ids).eq('status', 'approved');
  const ordre = new Map(ids.map((id: string, i: number) => [id, i]));
  const produits = (data || []).sort((a: any, b: any) => (ordre.get(a.id) ?? 0) - (ordre.get(b.id) ?? 0));
  const sesPrix = revendeurId ? await prixEnregistres(admin, revendeurId, produits.map((p: any) => p.id)) : new Map<string, number>();
  return avecOffre(admin, produits.map((p: any) => {
    const v = versVitrine(p);
    return sesPrix.has(p.id) ? { ...v, prix: sesPrix.get(p.id) as number } : v;
  }));
}
