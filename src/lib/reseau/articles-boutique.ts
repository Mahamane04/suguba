/**
 * Articles d'une boutique de revendeur — COUCHE COMMUNE (lot 7 du chantier
 * boutique, 2026-10-03) — SERVEUR.
 *
 * Un revendeur a une boutique principale et, avec une formule Pro, des
 * boutiques supplémentaires. Leurs articles vivent dans DEUX tables, que le
 * fondateur a décidé de ne pas fusionner :
 *  - reseller_shop_items (principale), rattachée au revendeur. Elle a un EFFET
 *    COMMERCIAL : chaque ligne est aussi l'offre du revendeur sur la fiche
 *    produit, et peut bloquer l'achat direct d'un article au prix de gros ;
 *  - store_products (boutique Pro), rattachée à la boutique, sans cet effet.
 *
 * Avant ce lot, seule la principale pouvait être rangée (ordre, coups de cœur,
 * retrait) ; une boutique Pro n'avait qu'une liste à cocher qui réécrivait tout.
 * Cette couche aiguille vers la bonne table et applique aux deux les MÊMES
 * règles (src/lib/boutique-ordre.ts) :
 *  - position négative = coup de cœur, 6 au plus ; 60 articles au plus ;
 *  - ranger = des UPDATE de position, ligne par ligne, jamais de suppression ni
 *    de réinsertion (une ligne retirée entre-temps serait recréée, avec son offre) ;
 *  - ajouter = une insertion à la suite du dernier, seulement pour un article en
 *    vente qui rapporte quelque chose ; un article déjà là n'est pas réécrit ;
 *  - retirer = la seule suppression, toujours d'UN article nommé.
 *
 * La boutique visée appartient TOUJOURS à la session : la principale par
 * l'identifiant du compte, une boutique Pro après vérification par
 * lireBoutiqueDuCompte (sinon null, que les routes traduisent en 404).
 *
 * Relecture du lot 7 (2026-10-03) : une lecture de `stores` en panne n'est plus
 * prise pour une boutique absente. cibleArticles renvoie alors BOUTIQUE_ILLISIBLE,
 * que les routes traduisent en 503 : l'écran propose « Réessayer » au lieu de dire
 * à son propriétaire que sa boutique « n'existe pas, ou n'est pas à vous ».
 */
import type { getSupabaseAdmin } from '../supabase-admin';
import { partageable } from '../shop';
import { ARTICLES_MAX, controlerEnsemble, positionAjout, positionsAEcrire, positionsPourOrdre, trierSelection, type LigneSelection } from '../boutique-ordre';
import { lireBoutiqueDuCompte, type BoutiqueReseau } from './boutiques';

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Table et clé où vivent les articles de la boutique visée. */
export type CibleArticles =
  | { table: 'reseller_shop_items'; colonne: 'reseller_id'; valeur: string; pro: false; boutique: BoutiqueReseau | null }
  | { table: 'store_products'; colonne: 'store_id'; valeur: string; pro: true; boutique: BoutiqueReseau };

/** La base n'a pas répondu : on ne sait pas si la boutique visée est à la session. */
export const BOUTIQUE_ILLISIBLE = 'illisible' as const;

/** Réponse d'une écriture, prête pour NextResponse.json(corps, { status: statut }). */
export interface ReponseArticles {
  statut: number;
  corps: Record<string, unknown>;
}

const refus = (statut: number, error: string): ReponseArticles => ({ statut, corps: { error } });

/**
 * Boutique dont on gère les articles.
 *  - `boutiqueId` absent (undefined ou null) : la principale du compte, sans
 *    aucune lecture, comme avant ;
 *  - fourni : la boutique doit appartenir au compte (lireBoutiqueDuCompte : une
 *    seule lecture de `stores`, propriétaire compris), sinon null. Une valeur vide
 *    ou illisible donne null elle aussi, JAMAIS la principale : un écran qui
 *    viserait une boutique Pro avec un identifiant perdu écrirait sinon dans la
 *    table qui porte les offres du revendeur ;
 *  - lecture en panne : BOUTIQUE_ILLISIBLE (503), jamais null (404) — et jamais la
 *    principale non plus ;
 *  - l'identifiant de la principale mène à reseller_shop_items : ses articles
 *    n'ont jamais été dans store_products.
 */
export async function cibleArticles(uid: string, boutiqueId?: unknown): Promise<CibleArticles | typeof BOUTIQUE_ILLISIBLE | null> {
  if (boutiqueId === undefined || boutiqueId === null) {
    return { table: 'reseller_shop_items', colonne: 'reseller_id', valeur: uid, pro: false, boutique: null };
  }
  if (typeof boutiqueId !== 'string' || boutiqueId.length === 0 || boutiqueId.length > 100) return null;
  const { boutique, illisible } = await lireBoutiqueDuCompte('reseller', uid, boutiqueId);
  if (illisible) return BOUTIQUE_ILLISIBLE;
  if (!boutique) return null;
  if (boutique.principale) return { table: 'reseller_shop_items', colonne: 'reseller_id', valeur: uid, pro: false, boutique };
  return { table: 'store_products', colonne: 'store_id', valeur: boutique.id, pro: true, boutique };
}

/**
 * Sélection de la boutique, dans l'ordre de sa vitrine (trierSelection). null si
 * la lecture échoue : jamais une boutique vide inventée.
 */
export async function lireSelection(admin: Admin, cible: CibleArticles): Promise<LigneSelection[] | null> {
  const { data, error } = await admin
    .from(cible.table)
    .select('product_id, position, added_at')
    .eq(cible.colonne, cible.valeur)
    .order('position', { ascending: true });
  if (error || !Array.isArray(data)) return null;
  return trierSelection(data as LigneSelection[]);
}

/**
 * Range la vitrine et choisit les coups de cœur : UPDATE de position seulement.
 * L'ordre doit contenir exactement la sélection, sinon 409 : la boutique a
 * changé ailleurs (catalogue, autre onglet) et rien n'est écrit.
 */
export async function ordonnerArticles(admin: Admin, cible: CibleArticles, ordre: unknown, coups: unknown): Promise<ReponseArticles> {
  const calcul = positionsPourOrdre(ordre as string[], coups as string[]);
  if (calcul.erreur !== undefined) return refus(400, calcul.erreur);

  const { data: lignes, error: lecture } = await admin
    .from(cible.table)
    .select('product_id, position')
    .eq(cible.colonne, cible.valeur);
  if (lecture || !Array.isArray(lignes)) return refus(503, 'Votre boutique est illisible pour le moment. Réessayez.');
  if (!controlerEnsemble(lignes.map((l: any) => l.product_id), ordre as string[])) {
    return refus(409, 'Votre boutique a changé, rechargez.');
  }

  // Seules les lignes dont la place change sont écrites (60 au plus), d'abord
  // celles qui deviennent ≥ 0 : une écriture interrompue ne laisse jamais plus de
  // 6 coups de cœur (relecture du lot 3, voir positionsAEcrire).
  const actuelles = new Map<string, number>(lignes.map((l: any) => [l.product_id, Number(l.position)]));
  const aEcrire = positionsAEcrire(calcul.positions, actuelles).slice(0, ARTICLES_MAX);
  for (const p of aEcrire) {
    const { error } = await admin
      .from(cible.table)
      .update({ position: p.position })
      .eq(cible.colonne, cible.valeur)
      .eq('product_id', p.id);
    if (error) return refus(503, 'Rangement interrompu : réessayez pour terminer.');
  }
  return { statut: 200, corps: { success: true, modifies: aEcrire.length } };
}

/**
 * Ajoute un article à la suite du dernier (jamais un coup de cœur). Seuls les
 * produits qui rapportent quelque chose au revendeur peuvent entrer dans sa
 * boutique : un article sous le plancher ou à commission nulle n'y aurait aucun
 * sens. Déjà là : rien n'est écrit, sa place et son coup de cœur sont gardés.
 */
export async function ajouterArticle(admin: Admin, cible: CibleArticles, productId: string): Promise<ReponseArticles> {
  const { data: produit } = await admin
    .from('products')
    .select('id, status, reseller_commission, pricing_status')
    .eq('id', productId)
    .maybeSingle();
  if (!produit || produit.status !== 'approved' || !partageable(produit)) {
    return refus(400, 'Ce produit ne peut pas être ajouté à votre boutique.');
  }

  const { data: lignes, error: lecture } = await admin
    .from(cible.table)
    .select('product_id, position')
    .eq(cible.colonne, cible.valeur);
  if (lecture || !Array.isArray(lignes)) return refus(503, 'Votre boutique est illisible pour le moment. Réessayez.');
  if (lignes.some((l: any) => l.product_id === productId)) return { statut: 200, corps: { success: true, deja: true } };
  if (lignes.length >= ARTICLES_MAX) return refus(409, `Votre boutique contient déjà ${ARTICLES_MAX} articles.`);

  const { error } = await admin
    .from(cible.table)
    .insert({ [cible.colonne]: cible.valeur, product_id: productId, position: positionAjout(lignes.map((l: any) => l.position)) });
  // Ajouté entre-temps (double appui, autre onglet) : il est bien dans la boutique.
  if (error && error.code === '23505') return { statut: 200, corps: { success: true, deja: true } };
  if (error) return refus(500, error.message);
  return { statut: 200, corps: { success: true } };
}

/**
 * Retire UN article. Relecture du lot 3 (2026-10-03) : l'erreur était ignorée ;
 * les écrans annonçaient « retiré » alors que la ligne restait, avec l'offre du
 * revendeur toujours visible sur la fiche produit.
 */
export async function retirerArticle(admin: Admin, cible: CibleArticles, productId: string): Promise<ReponseArticles> {
  const { error } = await admin.from(cible.table).delete().eq(cible.colonne, cible.valeur).eq('product_id', productId);
  if (error) return refus(503, 'Retrait impossible. Réessayez.');
  return { statut: 200, corps: { success: true } };
}
