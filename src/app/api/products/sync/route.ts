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

    // Un fournisseur ne peut jamais attribuer son dépôt à un autre
    // supplier_id que le sien — le client n'est pas digne de confiance sur
    // ce champ (voir la fiche fournisseur dans `suppliers`, la source
    // fiable du nom d'entreprise). Un admin, lui, peut légitimement créer ou
    // corriger une fiche au nom d'un fournisseur donné.
    let supplierId = product.supplierId;
    let supplierName = product.supplierName;
    if (session.role === 'supplier') {
      supplierId = session.uid;
      const { data: ownSupplier } = await admin
        .from('suppliers')
        .select('company_name')
        .eq('profile_id', session.uid)
        .maybeSingle();
      supplierName = ownSupplier?.company_name || supplierName;
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
      supplier_id: supplierId,
      supplier_name: supplierName,
      created_at: product.createdAt,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, cloud: true });
  } catch (error: any) {
    console.error('[API products/sync ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
