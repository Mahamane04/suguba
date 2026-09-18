import { NextRequest, NextResponse } from 'next/server';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { boutiqueDuProprietaire, majBoutique, obtenirOuCreerBoutique, MAX_GALERIE } from '@/lib/reseau/boutiques';

/** Page commerciale du fournisseur (§ 7) : couverture, galerie, recrutement. */

export async function GET(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, null);
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const fournisseurId = acces.contexte.fournisseurId;

  const admin = getSupabaseAdmin();
  const { data: fournisseur } = (await admin?.from('suppliers').select('*').eq('profile_id', fournisseurId).maybeSingle()) || { data: null };

  const boutique =
    (await boutiqueDuProprietaire('supplier', fournisseurId)) ||
    (await obtenirOuCreerBoutique({
      typeProprietaire: 'supplier',
      proprietaireId: fournisseurId,
      nom: fournisseur?.shop_display_name || fournisseur?.company_name || 'Ma boutique',
    }));

  // Nombre de revendeurs qui ont au moins un produit de ce fournisseur en
  // boutique — l'indicateur « nombre de revendeurs » du cahier des charges.
  let revendeurs = 0;
  if (admin) {
    const { data: produits } = await admin.from('products').select('id').eq('supplier_id', fournisseurId);
    const ids = (produits || []).map((p: any) => p.id);
    if (ids.length > 0) {
      const { data: selections } = await admin.from('reseller_shop_items').select('reseller_id').in('product_id', ids);
      revendeurs = new Set((selections || []).map((s: any) => s.reseller_id)).size;
    }
  }

  return NextResponse.json({ boutique, revendeurs, maxGalerie: MAX_GALERIE });
}

export async function PATCH(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'boutique');
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const fournisseurId = acces.contexte.fournisseurId;

  const boutique = await boutiqueDuProprietaire('supplier', fournisseurId);
  if (!boutique) return NextResponse.json({ error: 'Boutique introuvable.' }, { status: 404 });

  const corps = await req.json().catch(() => ({}));
  const resultat = await majBoutique(boutique.id, fournisseurId, corps);
  if (!resultat.ok) return NextResponse.json({ error: resultat.erreur }, { status: 400 });

  return NextResponse.json({ boutique: await boutiqueDuProprietaire('supplier', fournisseurId) });
}
