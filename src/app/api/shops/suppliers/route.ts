import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Liste publique des boutiques fournisseurs ayant au moins un article en vente.
 *
 * Remplace les « chaînes de marque » de /reseller/channels, qui étaient des
 * entreprises INVENTÉES (« BATIMAT MALI », « BAZIN PRESTIGE ») avec des
 * chiffres fabriqués (« 142 promoteurs actifs »), présentées à de vrais
 * revendeurs comme des partenaires.
 *
 * Ne renvoie que le nom, l'adresse de boutique et le nombre d'articles : ni
 * téléphone, ni adresse, ni aucune donnée commerciale du fournisseur.
 */
export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ boutiques: [] });

  const [{ data: fournisseurs }, { data: produits }] = await Promise.all([
    admin.from('suppliers').select('profile_id, company_name, category, slug').not('slug', 'is', null),
    admin.from('products').select('supplier_id').eq('status', 'approved'),
  ]);

  const compte = new Map<string, number>();
  for (const p of produits || []) compte.set(p.supplier_id, (compte.get(p.supplier_id) || 0) + 1);

  const boutiques = (fournisseurs || [])
    .map((f) => ({ nom: f.company_name, categorie: f.category || null, slug: f.slug, articles: compte.get(f.profile_id) || 0 }))
    .filter((b) => b.articles > 0)
    .sort((a, b) => b.articles - a.articles);

  return NextResponse.json({ boutiques }, { headers: { 'Cache-Control': 'public, max-age=120' } });
}
