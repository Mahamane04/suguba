import { verifyActiveSession } from '@/lib/active-session';
import { annoncerBaissePrix, annoncerNouveauProduit } from '@/lib/reseau/notifications';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerReglages } from '@/lib/platform-settings';
import { calculerTarif } from '@/lib/pricing';
import { adminPeut } from '@/lib/reseau/db';

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
  const refusEquipe = await refusSansPermissionAdmin(req, 'POST /api/admin/products/price');
  if (refusEquipe) return refusEquipe;
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const { productId, publicPrice, motif: motifBrut } = await req.json().catch(() => ({}));
  const motif = typeof motifBrut === 'string' ? motifBrut.trim().slice(0, 500) : '';
  const prixVente = Number(publicPrice);
  if (!productId || !Number.isFinite(prixVente) || prixVente <= 0) {
    return NextResponse.json({ error: 'Produit et prix de vente requis.' }, { status: 400 });
  }

  const { data: produit } = await admin
    .from('products')
    .select('id, name, supplier_price, public_price, status, commission_proposee')
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
        error: `Prix trop bas : ${reglages.couvrirCoutsDansLePrix ? 'il ne couvre pas les coûts de Suguba et la part revendeur' : 'il ne couvre pas le prix fournisseur et la part revendeur'}. Prix minimal : ${tarif.prixMinimal.toLocaleString('fr-FR')} F.`,
        prixMinimal: tarif.prixMinimal,
        prixRecommande: tarif.prixRecommande,
        tarif,
      },
      { status: 400 },
    );
  }

  // Protection Suguba (lot 3) : un prix qui ne laisse RIEN à Suguba (ou lui
  // fait perdre de l'argent) n'est pas une simple mise à jour de prix.
  if (tarif.margeSuguba <= 0) {
    if (!(await adminPeut(session.uid, 'marge.reduire'))) {
      return NextResponse.json({ error: 'À ce prix, Suguba ne gagne rien sur ce produit : réservé aux membres qui ont le droit « Baisser la part Suguba ».' }, { status: 403 });
    }
    if (motif.length < 5) {
      return NextResponse.json({ error: 'À ce prix, Suguba ne gagne rien sur ce produit : indiquez le motif.', motifRequis: true }, { status: 409 });
    }
    const { error: eJournal } = await admin.from('journal_part_suguba').insert({
      admin_id: session.uid, motif,
      changements: [{ cle: `produit.${productId}`, libelle: `Prix de « ${produit.name} »`, avant: Number(produit.public_price) || null, apres: prixVente, margeSuguba: tarif.margeSuguba }],
    });
    if (eJournal) return NextResponse.json({ error: 'Journal de la part Suguba indisponible : prix non enregistré. Réessayez.' }, { status: 503 });
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

  // Première mise en ligne seulement : un simple changement de prix d'un
  // produit déjà approuvé ne réveille pas les abonnés.
  if (produit.status !== 'approved') await annoncerNouveauProduit(productId);
  else await annoncerBaissePrix(productId, Number(produit.public_price) || 0, prixVente);

  return NextResponse.json({ success: true, tarif, reglagesConfirmes: confirme });
}
