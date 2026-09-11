import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { calculerCommande, completerReglages, QUANTITE_MAX } from '@/lib/pricing';

/**
 * Devis d'une commande, pour affichage sur la page produit — publique.
 *
 * La page calculait jusqu'ici son propre total (livraison par ville, point
 * relais, code promo), pendant que la commande enregistrée gardait 1 500 F de
 * livraison et aucune remise. Le client se voyait promettre un montant et on
 * lui en réclamait un autre à la livraison.
 *
 * Désormais la page affiche ce que CETTE route calcule, et /api/orders/sync
 * enregistre ce que la MÊME fonction calcule (calculerCommande). Un seul
 * calcul, donc un seul montant.
 *
 * Ne renvoie jamais la commission ni la marge : ce sont des éléments de la
 * structure de coûts de Suguba, et cette route est publique.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { productId, quantity, city, neighborhood, pickupPointId, promoCode, resellerCode } = body || {};

  if (!productId || typeof productId !== 'string') {
    return NextResponse.json({ error: 'Produit requis.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > QUANTITE_MAX) {
    return NextResponse.json({ error: 'Quantité invalide.' }, { status: 400 });
  }

  const { data: produit, error: produitErreur } = await admin
    .from('products')
    .select('supplier_price, public_price, status, commission_proposee, supplier_id')
    .eq('id', productId)
    .maybeSingle();

  if (produitErreur) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  if (!produit || produit.status !== 'approved' || Number(produit.public_price) <= 0) {
    return NextResponse.json({ error: 'Produit indisponible.' }, { status: 404 });
  }

  // Quartier du fournisseur de CE produit — pour le tarif de livraison à la
  // distance réelle (2026-09-11, voir livraisonDistanceBamako). Une commande
  // reste calculable sans ça : repli sur le tarif plat, jamais une erreur.
  let quartierFournisseur: string | undefined;
  if (produit.supplier_id) {
    const { data: fournisseur } = await admin
      .from('suppliers')
      .select('warehouse_neighborhood')
      .eq('profile_id', produit.supplier_id)
      .maybeSingle();
    quartierFournisseur = fournisseur?.warehouse_neighborhood || undefined;
  }

  // Seul effet de l'attribution sur le devis : le plafond de la remise promo,
  // qui doit laisser la commission du revendeur intacte.
  let revendeurAttribue = false;
  if (resellerCode && typeof resellerCode === 'string') {
    const { data: revendeur, error: revendeurErreur } = await admin
      .from('profiles')
      .select('id')
      .eq('reseller_code', resellerCode.trim().toUpperCase())
      .maybeSingle();
    if (revendeurErreur) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
    if (!revendeur) return NextResponse.json({ error: 'Code revendeur introuvable. Vérifiez le lien partagé.' }, { status: 400 });
    revendeurAttribue = true;
  }

  const { data: settings, error: settingsError } = await admin.from('platform_settings')
    .select('valeurs, updated_at').eq('id', 1).maybeSingle();
  if (settingsError) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  const reglages = completerReglages(settings?.valeurs || {});
  const d = calculerCommande(
    {
      prixFournisseur: Number(produit.supplier_price),
      prixVente: Number(produit.public_price),
      commissionProposee: produit.commission_proposee,
    },
    {
      quantite: Number(quantity) || 1,
      ville: typeof city === 'string' ? city : undefined,
      quartierClient: typeof neighborhood === 'string' ? neighborhood : undefined,
      quartierFournisseur,
      pointRelaisId: typeof pickupPointId === 'string' ? pickupPointId : undefined,
      codePromo: typeof promoCode === 'string' ? promoCode : undefined,
      revendeurAttribue,
    },
    reglages,
  );

  if (d.tarif.statut === 'sous_plancher' || !Number.isFinite(d.total) || d.total <= 0) {
    return NextResponse.json({ error: 'Le prix de ce produit doit être actualisé.' }, { status: 409 });
  }
  return NextResponse.json({
    devis: {
      quantite: d.quantite,
      prixUnitaire: d.prixUnitaire,
      montantArticles: d.montantArticles,
      modeLivraison: d.modeLivraison,
      ville: d.ville,
      pointRelais: d.pointRelais,
      fraisLivraison: d.fraisLivraison,
      distanceLivraisonKm: d.distanceLivraisonKm,
      codePromo: d.codePromo,
      remise: d.remise,
      avisPromo: d.avisPromo,
      total: d.total,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
