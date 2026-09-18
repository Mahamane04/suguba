import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Recherche globale (§ Z) : produits, boutiques, fournisseurs, catégories.
 * Publique. Ne renvoie que des champs déjà publics (vitrines).
 *
 * Le texte saisi est ÉCHAPPÉ avant de servir de motif `ilike` : sans cela, un
 * « % » ou un « _ » tapé par le client deviendrait un joker SQL.
 */

function motif(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 60);
  const vide = { produits: [], boutiques: [], fournisseurs: [], categories: [] };
  if (q.length < 2) return NextResponse.json(vide);
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json(vide);
  const m = motif(q);

  const [produits, parCategorie, boutiques, fournisseurs] = await Promise.all([
    admin.from('products').select('id, slug, name, category, images, public_price')
      .eq('status', 'approved').gt('public_price', 0).ilike('name', m).limit(24),
    admin.from('products').select('category').eq('status', 'approved').ilike('category', m).limit(200),
    admin.from('stores').select('slug, name, tagline, logo_url, owner_type, followers_count')
      .eq('status', 'active').ilike('name', m).limit(12),
    admin.from('suppliers').select('profile_id, company_name, shop_display_name, logo_url, slug')
      .or(`company_name.ilike.${m.replace(/[,()]/g, ' ')},shop_display_name.ilike.${m.replace(/[,()]/g, ' ')}`).limit(12),
  ]);

  const categories = Array.from(new Set((parCategorie.data || []).map((p: any) => p.category).filter(Boolean))).slice(0, 8);

  return NextResponse.json({
    produits: (produits.data || []).map((p: any) => ({
      slug: p.slug, nom: p.name, categorie: p.category, prix: Number(p.public_price) || 0,
      image: Array.isArray(p.images) ? p.images[0] || null : null,
    })),
    boutiques: (boutiques.data || []).map((b: any) => ({
      lien: `/boutique/${b.slug}`, nom: b.name, accroche: b.tagline || null, logo: b.logo_url || null,
      type: b.owner_type, abonnes: Number(b.followers_count) || 0,
    })),
    fournisseurs: (fournisseurs.data || []).filter((f: any) => f.slug).map((f: any) => ({
      lien: `/s/${f.slug}`, nom: f.shop_display_name || f.company_name, logo: f.logo_url || null,
    })),
    categories,
  });
}
