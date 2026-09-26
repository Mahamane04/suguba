import type { SupabaseClient } from '@supabase/supabase-js';
import { prixCataloguePrixDeGros } from './offres-revendeurs';
import { motsUtiles } from './recherche-texte';

/**
 * Recherche produits R1 (2026-09-26) — SERVEUR UNIQUEMENT.
 *
 * Une seule recherche pour l'accueil et /recherche : la fonction SQL
 * rechercher_produits (accents, fautes de frappe, synonymes, nom +
 * catégorie + description). Tant que le SQL n'est pas exécuté, on retombe
 * sur l'ancienne recherche par nom, pour ne jamais casser la page.
 */

export interface ProduitTrouve {
  slug: string;
  nom: string;
  categorie: string;
  /** Prix du revendeur d'origine, sinon « dès » le moins cher pour un article au prix de gros. */
  prix: number;
  mention: 'partenaire' | 'des' | null;
  image: string | null;
}

const FONCTION_ABSENTE = ['PGRST202', '42883', '42P01'];

function motif(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Identifiants des produits trouvés, du plus pertinent au moins pertinent. */
export async function idsRecherche(admin: SupabaseClient, q: string, limite: number): Promise<string[]> {
  if (!motsUtiles(q).length) return [];
  const { data, error } = await admin.rpc('rechercher_produits', { p_q: q, p_limite: limite });
  if (!error) return (data || []).map((l: any) => String(l.product_id));
  if (!FONCTION_ABSENTE.includes(String(error.code))) throw new Error('Recherche indisponible.');

  const secours = await admin.from('products').select('id')
    .eq('status', 'approved').gt('public_price', 0).ilike('name', motif(q.trim().slice(0, 60))).limit(limite);
  if (secours.error) throw new Error('Recherche indisponible.');
  return (secours.data || []).map((l: any) => String(l.id));
}

/** Produits trouvés, dans l'ordre de pertinence, au prix du bon contexte commercial. */
export async function produitsRecherche(admin: SupabaseClient, q: string, codeRevendeur: string | null, limite = 24): Promise<ProduitTrouve[]> {
  const ids = await idsRecherche(admin, q, limite);
  if (!ids.length) return [];
  const { data, error } = await admin.from('products')
    .select('id, slug, name, category, images, public_price, mode_prix').in('id', ids);
  if (error) throw new Error('Recherche indisponible.');
  const rang = new Map(ids.map((id, i) => [id, i]));
  const lignes = (data || []).sort((a: any, b: any) => (rang.get(a.id) ?? 0) - (rang.get(b.id) ?? 0));
  const prixGros = await prixCataloguePrixDeGros(admin, lignes, codeRevendeur).catch(() => new Map());

  return lignes.map((p: any) => {
    const gros = prixGros.get(p.id);
    return {
      slug: p.slug, nom: p.name, categorie: p.category,
      prix: gros?.prix ?? (Number(p.public_price) || 0),
      mention: gros?.mention ?? null,
      image: Array.isArray(p.images) ? p.images[0] || null : null,
    };
  });
}
