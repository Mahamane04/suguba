import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Les produits `submitted`/`rejected` sont invisibles à la clé anon (RLS ne
 * lit publiquement que `status = 'approved'`, voir supabase/schema.sql). Le
 * tableau de modération admin (src/app/admin/page.tsx) ne peut donc voir un
 * dépôt fournisseur réel que via cette route service_role — jamais via le
 * client Supabase anon utilisé pour le catalogue public.
 */
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ products: [] });
  }

  const { data, error } = await admin
    .from('products')
    .select('*')
    .neq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const products = (data || []).map((p) => ({
    id: p.id,
    supplierId: p.supplier_id || 'sup-default',
    supplierName: p.supplier_name || 'Fournisseur',
    name: p.name,
    slug: p.slug,
    category: p.category || 'Général',
    description: p.description || '',
    images: Array.isArray(p.images) ? p.images : [],
    supplierPrice: Number(p.supplier_price || 0),
    publicPrice: Number(p.public_price || 0),
    resellerCommission: Number(p.reseller_commission || 0),
    sugubaMargin: Math.max(0, Number(p.public_price || 0) - Number(p.supplier_price || 0) - Number(p.reseller_commission || 0)),
    stockQuantity: Number(p.stock || 0),
    warrantyMonths: 0,
    preparationDelayHours: 2,
    stockLocationType: 'supplier',
    stockLocationAddress: 'Bamako',
    status: p.status,
    marketingPitch: '',
    createdAt: p.created_at,
  }));

  return NextResponse.json({ products });
}
