import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { lireReglagesReseau } from '@/lib/reseau/recompenses';
import { idsRecherche, produitsRecherche } from '@/lib/recherche-produits';
import { normaliserCodeRevendeur } from '@/lib/ancrage-revendeur';
import { nomsPublicsRevendeurs } from '@/lib/reseau/boutiques';

/**
 * Recherche globale (§ Z) : produits, boutiques, fournisseurs, catégories.
 * Publique. Ne renvoie que des champs déjà publics (vitrines).
 *
 * Le texte saisi est ÉCHAPPÉ avant de servir de motif `ilike` : sans cela, un
 * « % » ou un « _ » tapé par le client deviendrait un joker SQL.
 *
 * R1 (2026-09-26) : les produits passent par la recherche unique
 * (src/lib/recherche-produits.ts) — accents, fautes, synonymes — au prix du
 * revendeur d'origine. `?format=ids` renvoie seulement les identifiants
 * classés, pour la barre de recherche de l'accueil. Une panne répond 503 :
 * le client affiche « Réessayer », jamais un faux « Aucun résultat ».
 *
 * Relecture du lot 2 du chantier boutique (2026-10-03) : une boutique revendeur
 * s'affiche sous son nom PUBLIC (l'enseigne, ou « Awa D. »), jamais stores.name
 * brut, qui vaut le nom complet du compte pour les premières boutiques. Elle
 * n'est gardée que si ce nom public contient le texte cherché : chercher
 * « Traoré » ne doit pas faire apparaître « Awa D. », et révéler ainsi son nom.
 */

/** Comparaison sans accents ni majuscules. */
function simplifier(texte: string): string {
  return texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const PRIVE = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

function motif(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 60);
  const vide = { produits: [], boutiques: [], fournisseurs: [], categories: [] };
  const seulementIds = req.nextUrl.searchParams.get('format') === 'ids';
  if (q.length < 2) return NextResponse.json(seulementIds ? { ids: [] } : vide);
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Recherche indisponible.' }, { status: 503 });

  if (seulementIds) {
    try {
      return NextResponse.json({ ids: await idsRecherche(admin, q, 200) }, { headers: PRIVE });
    } catch {
      return NextResponse.json({ error: 'Recherche indisponible.' }, { status: 503 });
    }
  }
  const m = motif(q);

  // Profil « Priorité au réseau » (2026-09-26) : sans annuaire fournisseurs,
  // la recherche client ne propose ni boutique ni vitrine de fournisseur.
  const { annuaireFournisseurs } = await lireReglagesReseau();
  const code = normaliserCodeRevendeur(req.cookies.get('suguba_ref')?.value);
  const [produits, parCategorie, boutiquesBrutes, fournisseursBruts] = await Promise.all([
    produitsRecherche(admin, q, code, 24).catch(() => null),
    admin.from('products').select('category').eq('status', 'approved').ilike('category', m).limit(200),
    admin.from('stores').select('slug, name, tagline, logo_url, owner_type, owner_id, followers_count')
      .eq('status', 'active').ilike('name', m).limit(12),
    admin.from('suppliers').select('profile_id, company_name, shop_display_name, logo_url, slug')
      .or(`company_name.ilike.${m.replace(/[,()]/g, ' ')},shop_display_name.ilike.${m.replace(/[,()]/g, ' ')}`).limit(12),
  ]);

  if (!produits) return NextResponse.json({ error: 'Recherche indisponible.' }, { status: 503 });

  const candidates = (boutiquesBrutes.data || [])
    .filter((b: any) => annuaireFournisseurs || b.owner_type !== 'supplier')
    .map((b: any) => ({ ...b, typeProprietaire: String(b.owner_type), proprietaireId: b.owner_id || null, nom: String(b.name || '') }));
  const cherche = simplifier(q);
  const boutiques = {
    data: (await nomsPublicsRevendeurs(admin, candidates, (b) => b))
      .filter((b) => b.typeProprietaire !== 'reseller' || simplifier(b.nom).includes(cherche)),
  };
  const fournisseurs = { data: annuaireFournisseurs ? fournisseursBruts.data || [] : [] };
  const categories = Array.from(new Set([...(parCategorie.data || []).map((p: any) => p.category), ...produits.map((p) => p.categorie)].filter(Boolean))).slice(0, 8);

  return NextResponse.json({
    produits,
    boutiques: (boutiques.data || []).map((b: any) => ({
      lien: `/boutique/${b.slug}`, nom: b.nom, accroche: b.tagline || null, logo: b.logo_url || null,
      type: b.owner_type, abonnes: Number(b.followers_count) || 0,
    })),
    fournisseurs: (fournisseurs.data || []).filter((f: any) => f.slug).map((f: any) => ({
      lien: `/s/${f.slug}`, nom: f.shop_display_name || f.company_name, logo: f.logo_url || null,
    })),
    categories,
  }, { headers: PRIVE });
}
