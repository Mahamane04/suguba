import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';

/**
 * Remplace l'ancien `pushProductToCloud` (écriture directe anon-key). Le
 * schéma corrigé ne donne plus qu'un accès public en LECTURE aux produits
 * approuvés — créer ou modifier une fiche produit exige désormais une
 * session fournisseur ou admin, vérifiée ici avant tout accès service_role.
 */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || !['admin', 'supplier'].includes(session.role)) {
    return NextResponse.json({ error: 'Authentification fournisseur ou admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ success: true, cloud: false });
  }

  try {
    const body = await req.json();
    const product = body.product;
    if (!product?.id || !product?.slug) {
      return NextResponse.json({ error: 'Produit invalide.' }, { status: 400 });
    }

    const { error } = await admin.from('products').upsert({
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: product.category,
      description: product.description,
      supplier_price: product.supplierPrice,
      public_price: product.publicPrice,
      reseller_commission: product.resellerCommission,
      stock: product.stockQuantity,
      images: product.images,
      status: product.status,
      supplier_id: product.supplierId,
      supplier_name: product.supplierName,
      created_at: product.createdAt,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, cloud: true });
  } catch (error: any) {
    console.error('[API products/sync ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
