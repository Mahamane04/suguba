import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { publierAutomatiquement } from '@/lib/publication-auto';

const MAX_PHOTOS = 6;

/**
 * Remplace les photos d'un produit EXISTANT — et rien d'autre (2026-09-11).
 *
 * Jusqu'ici, une photo ne pouvait être ajoutée qu'à la création du produit :
 * les 5 produits du catalogue n'en avaient aucune, et rien ne permettait d'en
 * ajouter. /api/products/sync ne convenait pas : il réécrit la fiche entière
 * (prix, statut...) à partir de ce qu'envoie le navigateur.
 *
 * Règles :
 *  - admin : n'importe quel produit ; fournisseur : uniquement les siens ;
 *  - seules des photos de NOTRE stockage sont acceptées (jamais une URL
 *    extérieure collée à la main, voir BUG-011 et /api/products/upload-image) ;
 *  - le statut du produit n'est pas modifié : changer les photos ne retire pas
 *    un article de la vente.
 */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || !['admin', 'supplier'].includes(session.role)) {
    return NextResponse.json({ error: 'Authentification fournisseur ou admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const { productId, images } = await req.json().catch(() => ({}));
  if (!productId || !Array.isArray(images)) {
    return NextResponse.json({ error: 'Produit et liste de photos requis.' }, { status: 400 });
  }
  if (images.length > MAX_PHOTOS) {
    return NextResponse.json({ error: `${MAX_PHOTOS} photos au maximum.` }, { status: 400 });
  }

  const prefixeStockage = `${String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')}/storage/v1/object/public/product-images/`;
  const invalide = images.find((u: unknown) => typeof u !== 'string' || !u.startsWith(prefixeStockage));
  if (invalide !== undefined) {
    return NextResponse.json({ error: 'Seules les photos envoyées depuis Suguba sont acceptées.' }, { status: 400 });
  }

  const { data: produit } = await admin
    .from('products')
    .select('id, supplier_id')
    .eq('id', productId)
    .maybeSingle();
  if (!produit) return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 });

  if (session.role === 'supplier' && produit.supplier_id !== session.uid) {
    return NextResponse.json({ error: 'Ce produit ne vous appartient pas.' }, { status: 403 });
  }

  const { error } = await admin.from('products').update({ images }).eq('id', productId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Un produit en attente faute de photo peut maintenant partir en vente
  // (publication automatique, voir src/lib/publication-auto.ts). Sans effet
  // sur un produit déjà en vente ou retiré par l'admin.
  const publication = await publierAutomatiquement(admin, productId);

  return NextResponse.json({ success: true, images, publication });
}
