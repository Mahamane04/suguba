import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerReglages } from '@/lib/platform-settings';
import { calculerCommande } from '@/lib/pricing';

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
  const { productId, quantity, city, pickupPointId, promoCode, resellerCode } = body || {};

  if (!productId || typeof productId !== 'string') {
    return NextResponse.json({ error: 'Produit requis.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });

  const { data: produit } = await admin
    .from('products')
    .select('supplier_price, public_price, status')
    .eq('id', productId)
    .maybeSingle();

  if (!produit || produit.status !== 'approved') {
    return NextResponse.json({ error: 'Produit indisponible.' }, { status: 404 });
  }

  // Seul effet de l'attribution sur le devis : le plafond de la remise promo,
  // qui doit laisser la commission du revendeur intacte.
  let revendeurAttribue = false;
  if (resellerCode && typeof resellerCode === 'string') {
    const { data: revendeur } = await admin
      .from('profiles')
      .select('id')
      .eq('reseller_code', resellerCode.trim())
      .maybeSingle();
    revendeurAttribue = Boolean(revendeur);
  }

  const { reglages } = await chargerReglages();
  const d = calculerCommande(
    { prixFournisseur: Number(produit.supplier_price), prixVente: Number(produit.public_price) },
    {
      quantite: Number(quantity) || 1,
      ville: typeof city === 'string' ? city : undefined,
      pointRelaisId: typeof pickupPointId === 'string' ? pickupPointId : undefined,
      codePromo: typeof promoCode === 'string' ? promoCode : undefined,
      revendeurAttribue,
    },
    reglages,
  );

  return NextResponse.json({
    devis: {
      quantite: d.quantite,
      prixUnitaire: d.prixUnitaire,
      montantArticles: d.montantArticles,
      modeLivraison: d.modeLivraison,
      ville: d.ville,
      pointRelais: d.pointRelais,
      fraisLivraison: d.fraisLivraison,
      codePromo: d.codePromo,
      remise: d.remise,
      avisPromo: d.avisPromo,
      total: d.total,
    },
  });
}
