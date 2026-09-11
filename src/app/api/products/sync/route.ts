import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { publierAutomatiquement } from '@/lib/publication-auto';

/**
 * Création et modification des fiches produit — fournisseur ou admin.
 *
 * Remplace l'ancien `pushProductToCloud` (écriture directe anon-key). Le
 * schéma ne donne plus qu'un accès public en LECTURE aux produits approuvés.
 *
 * ── Ce que cette route n'accepte plus du navigateur ──────────────────────
 * Elle enregistrait telles quelles les valeurs envoyées : prix de vente,
 * commission revendeur et STATUT. Un fournisseur pouvait donc publier son
 * propre article en « approuvé », sans modération, avec la commission de son
 * choix. Et un fournisseur pouvait écraser la fiche d'un autre en réutilisant
 * son identifiant.
 *
 * Désormais :
 *  - prix de vente et commission ne sont JAMAIS lus du navigateur : ils sont
 *    calculés par le moteur de tarification, soit à la publication
 *    automatique (src/lib/publication-auto.ts), soit via
 *    /api/admin/products/price quand l'admin ajuste le prix ;
 *  - un dépôt fournisseur est publié AUTOMATIQUEMENT au prix recommandé
 *    (décision du 2026-09-11 : plus de validation manuelle préalable), s'il a
 *    une photo et qu'un prix rentable existe ; sinon il reste en attente avec
 *    la raison, renvoyée au fournisseur ;
 *  - un fournisseur ne modifie que ses propres fiches ;
 *  - l'adresse (slug) d'un produit ne change jamais après sa création : elle
 *    figure dans les liens déjà partagés sur WhatsApp ;
 *  - un changement de prix fournisseur sur un produit en vente le fait
 *    RETARIFER automatiquement (plancher recalculé). Sans cela, un fournisseur
 *    pourrait augmenter son prix et faire passer le produit sous le plancher
 *    de Suguba sans que personne ne le voie.
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

    const { data: existant } = await admin
      .from('products')
      .select('id, supplier_id, supplier_price, status')
      .eq('id', product.id)
      .maybeSingle();

    const estFournisseur = session.role === 'supplier';

    if (estFournisseur && existant && existant.supplier_id !== session.uid) {
      return NextResponse.json({ error: 'Ce produit ne vous appartient pas.' }, { status: 403 });
    }

    // Un fournisseur ne peut jamais attribuer son dépôt à un autre
    // supplier_id que le sien. Un admin, lui, peut légitimement créer ou
    // corriger une fiche au nom d'un fournisseur donné.
    let supplierId = product.supplierId;
    let supplierName = product.supplierName;
    if (estFournisseur) {
      supplierId = session.uid;
      const { data: ownSupplier } = await admin
        .from('suppliers')
        .select('company_name')
        .eq('profile_id', session.uid)
        .maybeSingle();
      supplierName = ownSupplier?.company_name || supplierName;
    }

    const descriptif = {
      name: product.name,
      category: product.category,
      description: product.description,
      stock: product.stockQuantity,
      images: product.images,
    };
    const prixFournisseur = Number(product.supplierPrice);

    // ── Création ──────────────────────────────────────────────────────────
    if (!existant) {
      // Aucun produit ne naît approuvé : l'approbation passe par la
      // tarification admin, qui calcule la commission.
      const statut = estFournisseur || product.status === 'approved' ? 'submitted' : (product.status || 'submitted');
      const { error } = await admin.from('products').insert({
        id: product.id,
        slug: product.slug,
        ...descriptif,
        supplier_price: Number.isFinite(prixFournisseur) ? prixFournisseur : 0,
        public_price: 0,
        reseller_commission: 0,
        status: statut,
        supplier_id: supplierId,
        supplier_name: supplierName,
        created_at: product.createdAt,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Dépôt fournisseur : publication automatique. L'admin, lui, publie avec
      // SON prix juste après (voir /admin/products/new).
      if (estFournisseur) {
        const publication = await publierAutomatiquement(admin, product.id);
        return NextResponse.json({
          success: true, cloud: true, status: publication.publie ? 'approved' : statut, publication,
        });
      }
      return NextResponse.json({ success: true, cloud: true, status: statut });
    }

    // ── Modification ──────────────────────────────────────────────────────
    const maj: Record<string, unknown> = { ...descriptif };
    let statut = existant.status as string;

    if (Number.isFinite(prixFournisseur) && prixFournisseur !== Number(existant.supplier_price)) {
      maj.supplier_price = prixFournisseur;
      if (existant.status === 'approved') {
        statut = 'submitted';
        maj.reseller_commission = 0;
        maj.pricing_status = null;
      }
    }

    if (!estFournisseur) {
      if (product.supplierId) maj.supplier_id = supplierId;
      if (product.supplierName) maj.supplier_name = supplierName;
      // L'admin peut rejeter, archiver ou renvoyer en modération — jamais
      // approuver par ici. Demander « approuvé » sur un produit qui l'est déjà
      // ne change rien ; sur un produit qui ne l'est pas, c'est ignoré.
      const demande = product.status;
      if (demande && demande !== 'approved' && statut !== 'submitted') statut = demande;
      if (demande && demande !== 'approved' && existant.status !== 'approved') statut = demande;
    }

    maj.status = statut;
    const { error } = await admin.from('products').update(maj).eq('id', product.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Revenu en attente (prix fournisseur changé) ou jamais publié : on
    // retente la publication automatique au nouveau prix recommandé.
    if (statut === 'submitted') {
      const publication = await publierAutomatiquement(admin, product.id);
      return NextResponse.json({
        success: true, cloud: true, status: publication.publie ? 'approved' : statut, publication,
      });
    }
    return NextResponse.json({ success: true, cloud: true, status: statut });
  } catch (error: any) {
    console.error('[API products/sync ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
