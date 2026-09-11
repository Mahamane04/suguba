import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { attribuerSlugFournisseur } from '@/lib/shop';

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

  // Fiche créée avant l'attribution automatique des adresses de boutique :
  // on lui en attribue une maintenant, une fois pour toutes.
  if (supplierRow && !supplierRow.slug) {
    supplierRow.slug = await attribuerSlugFournisseur(admin, session.uid, supplierRow.company_name || 'Fournisseur');
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
          // Adresse publique de sa boutique : /s/<slug>.
          slug: supplierRow.slug || null,
          managerName: supplierRow.manager_name,
          contactPhone: supplierRow.contact_phone,
          warehouseAddress: supplierRow.warehouse_address,
          warehouseNeighborhood: supplierRow.warehouse_neighborhood,
          category: supplierRow.category,
          // Réglages de boutique (2026-09-11, voir migration-shop-profile.sql) :
          // `undefined` tant que la migration n'est pas appliquée en base — le
          // `.select('*')` ci-dessus ne casse rien dans ce cas, il ignore
          // simplement les colonnes qui n'existent pas encore.
          shopDisplayName: supplierRow.shop_display_name || null,
          logoUrl: supplierRow.logo_url || null,
          shopDescription: supplierRow.shop_description || null,
          contactEmail: supplierRow.contact_email || null,
        }
      : null,
    products,
    totalRevenue,
  });
}

/**
 * Réglages de boutique (2026-09-11) : nom affiché, logo, description,
 * e-mail et coordonnées de contact — tout ce qu'un fournisseur peut ajuster
 * lui-même sans repasser par l'admin. Voir "Réglages de ma boutique" sur
 * /supplier/ambassadors.
 *
 * `shop_display_name` ne touche JAMAIS au `slug` (voir migration-shop-profile.sql) :
 * changer le nom affiché ne casse aucun lien déjà partagé.
 */
export async function PATCH(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'supplier') {
    return NextResponse.json({ error: 'Authentification fournisseur requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const champsAutorises: Record<string, string> = {
    shopDisplayName: 'shop_display_name',
    logoUrl: 'logo_url',
    shopDescription: 'shop_description',
    contactEmail: 'contact_email',
    managerName: 'manager_name',
    contactPhone: 'contact_phone',
  };

  const misAJour: Record<string, string | null> = {};
  for (const [cle, colonne] of Object.entries(champsAutorises)) {
    if (cle in body) {
      const valeur = body[cle];
      misAJour[colonne] = typeof valeur === 'string' && valeur.trim() ? valeur.trim() : null;
    }
  }

  if (misAJour.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(misAJour.contact_email)) {
    return NextResponse.json({ error: 'Adresse e-mail invalide.' }, { status: 400 });
  }

  if (Object.keys(misAJour).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour.' }, { status: 400 });
  }

  const { error } = await admin.from('suppliers').update(misAJour).eq('profile_id', session.uid);
  if (error) {
    // Cas attendu tant que migration-shop-profile.sql n'a pas été exécutée :
    // la colonne n'existe pas encore côté base.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
