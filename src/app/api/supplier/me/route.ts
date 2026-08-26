import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Fiche fournisseur réelle du compte connecté, avec ses produits — quel que
 * soit leur statut. Le fournisseur doit voir ses propres soumissions même
 * "submitted"/"rejected", ce que la clé anon (RLS ne lit que les produits
 * "approved", voir supabase/schema.sql) ne permettrait jamais, y compris
 * depuis son propre appareil s'il a vidé son cache local. Voir aussi
 * /api/auth/complete-profile (écriture de cette fiche) et
 * /api/admin/pending-profiles (vue admin équivalente).
 */
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'supplier') {
    return NextResponse.json({ error: 'Authentification fournisseur requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ supplier: null, products: [] });
  }

  const { data: supplierRow, error: supplierErr } = await admin
    .from('suppliers')
    .select('*')
    .eq('profile_id', session.uid)
    .maybeSingle();

  if (supplierErr) {
    return NextResponse.json({ error: supplierErr.message }, { status: 500 });
  }

  const { data: productRows, error: productsErr } = await admin
    .from('products')
    .select('*')
    .eq('supplier_id', session.uid)
    .order('created_at', { ascending: false });

  if (productsErr) {
    return NextResponse.json({ error: productsErr.message }, { status: 500 });
  }

  const products = (productRows || []).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: p.category || 'Général',
    images: Array.isArray(p.images) ? p.images : [],
    supplierPrice: Number(p.supplier_price || 0),
    publicPrice: Number(p.public_price || 0),
    stockQuantity: Number(p.stock || 0),
    status: p.status,
    createdAt: p.created_at,
  }));

  // Revenu réel = somme des prix public des produits approuvés — provisoire
  // tant qu'il n'existe pas de grand-livre "ventes fournisseur" comme celui
  // déjà en place pour les commissions revendeur (voir schema.sql).
  const totalRevenue = products
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + p.publicPrice, 0);

  return NextResponse.json({
    supplier: supplierRow
      ? {
          companyName: supplierRow.company_name,
          managerName: supplierRow.manager_name,
          contactPhone: supplierRow.contact_phone,
          warehouseAddress: supplierRow.warehouse_address,
          warehouseNeighborhood: supplierRow.warehouse_neighborhood,
          category: supplierRow.category,
        }
      : null,
    products,
    totalRevenue,
  });
}
