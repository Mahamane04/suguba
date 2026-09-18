import { NextRequest, NextResponse } from 'next/server';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { demanderSponsorisation, listerPacks, sponsorisationsDuFournisseur } from '@/lib/reseau/sponsorisation-db';
import { EMPLACEMENTS } from '@/lib/reseau/sponsoring';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/** Sponsorisation côté fournisseur (§ 16, § 25 des écrans). */

export async function GET(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'sponsorisation');
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const fournisseurId = acces.contexte.fournisseurId;

  const [packs, sponsorisations] = await Promise.all([
    listerPacks(true),
    sponsorisationsDuFournisseur(fournisseurId),
  ]);

  const admin = getSupabaseAdmin();
  const { data: produits } = (await admin
    ?.from('products')
    .select('id, name')
    .eq('supplier_id', fournisseurId)
    .eq('status', 'approved')
    .limit(100)) || { data: [] as any[] };

  return NextResponse.json({
    packs,
    sponsorisations,
    emplacements: EMPLACEMENTS,
    produits: (produits || []).map((p: any) => ({ id: p.id, nom: p.name })),
  });
}

export async function POST(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'sponsorisation');
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const fournisseurId = acces.contexte.fournisseurId;

  const corps = await req.json().catch(() => ({}));
  const sujetType = ['product', 'store', 'promotion', 'campaign'].includes(corps.sujetType) ? corps.sujetType : null;
  const emplacement = EMPLACEMENTS.find((e) => e.valeur === corps.emplacement)?.valeur;
  if (!sujetType || !emplacement) {
    return NextResponse.json({ error: 'Choisissez ce que vous sponsorisez et où.' }, { status: 400 });
  }

  // Le sujet doit appartenir au fournisseur : sponsoriser le produit d'un
  // concurrent, même en payant, n'a aucun sens et serait exploitable.
  if (sujetType === 'product') {
    const admin = getSupabaseAdmin();
    const { data } = (await admin?.from('products').select('id').eq('id', corps.sujetRef).eq('supplier_id', fournisseurId).maybeSingle()) || { data: null };
    if (!data) return NextResponse.json({ error: 'Ce produit ne fait pas partie de votre catalogue.' }, { status: 403 });
  }

  const sponsorisation = await demanderSponsorisation({
    supplierId: fournisseurId,
    packId: typeof corps.packId === 'string' ? corps.packId : null,
    sujetType,
    sujetRef: typeof corps.sujetRef === 'string' ? corps.sujetRef : null,
    libelle: typeof corps.libelle === 'string' ? corps.libelle.slice(0, 120) : null,
    emplacement,
  });
  if (!sponsorisation) {
    return NextResponse.json({ error: 'Sponsorisation indisponible pour le moment.' }, { status: 503 });
  }
  return NextResponse.json({ sponsorisation });
}
