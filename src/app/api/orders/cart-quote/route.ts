import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { completerReglages, QUANTITE_MAX } from '@/lib/pricing';
import { calculerLignesPanier, LIGNES_MAX, type ProduitPanier } from '@/lib/cart-input';
import { depotsFournisseurs } from '@/lib/depot-fournisseur';
import { prixEnregistres } from '@/lib/prix-revendeur';
import { positionValide } from '@/lib/bamako-quartiers';

/**
 * Devis d'un panier, calculé par le serveur avec la MÊME fonction que la
 * création (calculerLignesPanier) : le total affiché est celui facturé.
 *
 * Ne révèle ni prix fournisseur ni marge : uniquement prix public, frais de
 * livraison, remise et total — ce que le client paiera.
 */
export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Devis indisponible.' }, { status: 503 });

  const corps = await req.json().catch(() => ({}));
  const brutes = Array.isArray(corps.lignes) ? corps.lignes.slice(0, LIGNES_MAX) : [];
  const lignes = brutes
    .filter((l: any) => typeof l?.productId === 'string' && Number.isInteger(l.quantity) && l.quantity >= 1)
    .map((l: any) => ({ productId: l.productId, quantity: Math.min(QUANTITE_MAX, l.quantity) }));
  if (lignes.length === 0) return NextResponse.json({ lignes: [], total: 0, livraison: 0, remise: 0, indisponibles: [] });

  const { data: produits } = await admin
    .from('products')
    .select('*')
    .in('id', lignes.map((l: any) => l.productId));
  const index = new Map((produits || []).map((p: any) => [p.id, p]));

  // Un article retiré entre-temps n'est pas facturé : il est signalé, pour que
  // le client le retire avant de valider (la création le refuserait).
  const valides = lignes.filter((l: any) => {
    const p = index.get(l.productId);
    return p && p.status === 'approved' && Number(p.public_price) > 0;
  });
  const indisponibles = lignes.filter((l: any) => !valides.includes(l)).map((l: any) => l.productId);

  const depots = await depotsFournisseurs(admin, valides.map((l: any) => index.get(l.productId).supplier_id));

  // Revendeur du panier (lien partagé) : ses prix pour les articles au prix
  // de gros, exactement comme à la création (2026-09-24).
  const code = (typeof corps.resellerCode === 'string' ? corps.resellerCode : req.cookies.get('suguba_ref')?.value || '').trim().toUpperCase();
  let revendeurId: string | null = null;
  if (code) {
    const { data: revendeur } = await admin.from('profiles').select('id').eq('reseller_code', code).maybeSingle();
    revendeurId = revendeur?.id || null;
  }
  const prixRevendeur = await prixEnregistres(
    admin, revendeurId, valides.map((l: any) => index.get(l.productId)).filter((p: any) => p.mode_prix === 'gros').map((p: any) => p.id),
  );

  const { data: settings } = await admin.from('platform_settings').select('valeurs').eq('id', 1).maybeSingle();
  const calcul = calculerLignesPanier(
    valides,
    valides.map((l: any) => index.get(l.productId) as ProduitPanier),
    depots,
    {
      ville: typeof corps.city === 'string' ? corps.city : 'Bamako',
      quartierClient: typeof corps.neighborhood === 'string' ? corps.neighborhood : undefined,
      positionClient: positionValide(corps.positionClient),
      pointRelaisId: typeof corps.pickupPointId === 'string' ? corps.pickupPointId : undefined,
      codePromo: typeof corps.promoCode === 'string' ? corps.promoCode : undefined,
      revendeurAttribue: Boolean(revendeurId),
      prixRevendeur,
    },
    completerReglages(settings?.valeurs || {}),
  );

  const resultat = calcul.map((c, i) => {
    const p = index.get(valides[i].productId);
    return {
      productId: p.id, nom: p.name, slug: p.slug,
      image: Array.isArray(p.images) ? p.images[0] || null : null,
      quantite: c.devis.quantite, prixUnitaire: c.devis.prixUnitaire,
      montantArticles: c.devis.montantArticles, fraisLivraison: c.fraisLivraison,
      remise: c.devis.remise, total: c.total,
    };
  });

  return NextResponse.json({
    lignes: resultat,
    indisponibles,
    livraisons: new Set(calcul.map((c) => c.groupe)).size,
    articles: resultat.reduce((s, l) => s + l.montantArticles, 0),
    livraison: resultat.reduce((s, l) => s + l.fraisLivraison, 0),
    remise: resultat.reduce((s, l) => s + l.remise, 0),
    total: resultat.reduce((s, l) => s + l.total, 0),
    codePromoValide: resultat.some((l) => l.remise > 0),
  });
}
