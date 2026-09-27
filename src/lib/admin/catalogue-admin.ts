import type { SupabaseClient } from '@supabase/supabase-js';
import { TAILLE_PAGE, type FiltresCatalogue } from './tableau';
import { lireMesure, lireUniteVente, suffixeUnite } from '@/lib/unite-vente';

/**
 * Catalogue admin en tableau (A4, 2026-09-27) — SERVEUR UNIQUEMENT.
 * Filtres, tri et pagination faits par la base : la recherche porte sur TOUT
 * le catalogue, jamais sur la seule page affichée.
 */

const COLONNES = 'id, name, slug, category, status, public_price, stock, supplier_name, images, created_at, type_offre';
const COLONNES_UNITE = ', unite_vente, contenu_valeur, contenu_mesure';

function requete(admin: SupabaseClient, f: FiltresCatalogue, colonnes: string, compter: boolean) {
  let q = admin.from('products').select(colonnes, compter ? { count: 'exact' } : undefined).neq('status', 'archived');
  if (f.q) q = q.or(`name.ilike.%${f.q}%,supplier_name.ilike.%${f.q}%,id.ilike.%${f.q}%`);
  if (f.statut) q = q.eq('status', f.statut);
  if (f.categorie) q = q.eq('category', f.categorie);
  if (f.sansPhoto) q = q.or('images.is.null,images.eq.{}');
  if (f.sansUnite) q = q.is('unite_vente', null).neq('type_offre', 'service');
  return q;
}

export async function listerCatalogue(admin: SupabaseClient, f: FiltresCatalogue, page: number) {
  const debut = (page - 1) * TAILLE_PAGE;
  let avecUnite = true;
  let r: any = await requete(admin, f, COLONNES + COLONNES_UNITE, true).order(f.tri, { ascending: f.sens === 'asc' }).order('id').range(debut, debut + TAILLE_PAGE - 1);
  if (r.error && String(r.error.code) === '42703' && !f.sansUnite) {
    // SQL de l'unité de vente pas encore exécuté : le tableau reste utilisable.
    avecUnite = false;
    r = await requete(admin, f, COLONNES, true).order(f.tri, { ascending: f.sens === 'asc' }).order('id').range(debut, debut + TAILLE_PAGE - 1);
  }
  if (r.error) throw new Error(r.error.message);
  const { data: cats } = await admin.from('products').select('category').neq('status', 'archived').limit(5000);
  return {
    total: r.count ?? 0,
    page,
    taillePage: TAILLE_PAGE,
    avecUnite,
    categories: [...new Set((cats || []).map((c: any) => c.category).filter(Boolean))].sort(),
    lignes: (r.data || []).map((p: any) => ({
      id: p.id, nom: p.name, slug: p.slug, categorie: p.category || '', statut: p.status,
      prix: Number(p.public_price) || 0, stock: Number(p.stock) || 0, fournisseur: p.supplier_name || 'Suguba',
      photos: Array.isArray(p.images) ? p.images.filter(Boolean).length : 0, creeLe: p.created_at, typeOffre: p.type_offre || null,
      uniteVente: lireUniteVente(p.unite_vente),
      unite: suffixeUnite(lireUniteVente(p.unite_vente), p.contenu_valeur == null ? null : Number(p.contenu_valeur), lireMesure(p.contenu_mesure)).replace('/ ', ''),
    })),
  };
}

/** Identifiants de tous les résultats du filtre (actions groupées « tous les résultats »). */
export async function idsDuFiltre(admin: SupabaseClient, f: FiltresCatalogue, max: number): Promise<string[]> {
  const { data, error } = await requete(admin, f, 'id', false).order('id').limit(max + 1);
  if (error) throw new Error(error.message);
  return (data || []).map((p: any) => p.id);
}
