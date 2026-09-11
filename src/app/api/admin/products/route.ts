import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Tous les produits (hors archivés), quel que soit leur statut — admin seul.
 * La clé anon ne lit que les produits approuvés : sans cette route, l'admin
 * n'avait aucune liste complète de son catalogue.
 */
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const { data, error } = await admin
    .from('products')
    .select('id, name, slug, category, status, images, public_price, stock, supplier_name')
    .neq('status', 'archived')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    produits: (data || []).map((p) => ({
      id: p.id,
      nom: p.name,
      slug: p.slug,
      categorie: p.category || '',
      statut: p.status,
      images: Array.isArray(p.images) ? p.images.filter(Boolean) : [],
      prix: Number(p.public_price) || 0,
      stock: Number(p.stock) || 0,
      fournisseur: p.supplier_name || 'Suguba',
    })),
  });
}
