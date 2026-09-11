import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerReglages } from '@/lib/platform-settings';
import { calculerTarif } from '@/lib/pricing';

/**
 * Fixe le prix de vente d'un produit et l'approuve — admin seul.
 *
 * L'admin ne choisit plus que le PRIX DE VENTE. La commission est calculée
 * ici, par le moteur, à partir des réglages de la plateforme. Elle était
 * jusqu'ici saisie à la main dans le navigateur, puis enregistrée telle
 * quelle par /api/products/sync.
 *
 * C'est aussi le SEUL chemin d'approbation d'un produit : /api/products/sync
 * refuse désormais de faire passer un produit en « approuvé ». Un fournisseur
 * ne peut donc plus publier son propre article sans modération, avec la
 * commission de son choix.
 *
 * Un prix sous le plancher est refusé : Suguba perdrait de l'argent sur
 * chaque vente. La réponse donne le prix minimal et le prix recommandé.
 */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const { productId, publicPrice } = await req.json().catch(() => ({}));
  const prixVente = Number(publicPrice);
  if (!productId || !Number.isFinite(prixVente) || prixVente <= 0) {
    return NextResponse.json({ error: 'Produit et prix de vente requis.' }, { status: 400 });
  }

  const { data: produit } = await admin
    .from('products')
    .select('id, name, supplier_price, status, commission_proposee')
    .eq('id', productId)
    .maybeSingle();

  if (!produit) return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 });
  if (produit.status === 'archived') {
    return NextResponse.json({ error: 'Produit archivé : désarchivez-le avant de le tarifer.' }, { status: 409 });
  }

  const { reglages, confirme } = await chargerReglages();
  // Si le fournisseur a fixé la part du revendeur, elle est respectée : le
  // prix doit alors couvrir les coûts ET cette part.
  const tarif = calculerTarif(Number(produit.supplier_price), prixVente, reglages, produit.commission_proposee);

  if (tarif.statut === 'sous_plancher') {
    return NextResponse.json(
      {
        error: `Prix trop bas : Suguba perdrait de l'argent sur chaque vente. Prix minimal : ${tarif.prixMinimal.toLocaleString('fr-FR')} F.`,
        prixMinimal: tarif.prixMinimal,
        prixRecommande: tarif.prixRecommande,
        tarif,
      },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from('products')
    .update({
      public_price: prixVente,
      reseller_commission: tarif.commission,
      status: 'approved',
      pricing_status: tarif.statut,
      pricing_computed_at: new Date().toISOString(),
    })
    .eq('id', productId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, tarif, reglagesConfirmes: confirme });
}
