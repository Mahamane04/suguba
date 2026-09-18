import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { basculerAbonnement, cleAbonne, obtenirOuCreerBoutique } from '@/lib/reseau/boutiques';

/**
 * Fournisseurs vus par le revendeur (§ page 10) : « Mes fournisseurs » (ceux
 * dont il vend les produits ou qu'il suit) et « Découvrir » (tous ceux qui ont
 * des produits partageables). Aucune coordonnée : nom, logo, badge, volume.
 */

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ fournisseurs: [] });

  const { data: produits } = await admin
    .from('products')
    .select('id, supplier_id, reseller_commission, created_at')
    .eq('status', 'approved')
    .gt('reseller_commission', 0)
    .not('supplier_id', 'is', null)
    .limit(5000);
  const parFournisseur = new Map<string, { produits: number; nouveautes: number }>();
  const ilYA30j = Date.now() - 30 * 86400000;
  for (const p of produits || []) {
    const x = parFournisseur.get(p.supplier_id) || { produits: 0, nouveautes: 0 };
    x.produits += 1;
    if (new Date(p.created_at).getTime() > ilYA30j) x.nouveautes += 1;
    parFournisseur.set(p.supplier_id, x);
  }
  const ids = [...parFournisseur.keys()];
  if (ids.length === 0) return NextResponse.json({ fournisseurs: [] });

  const [{ data: fiches }, { data: boutiques }, { data: badges }, { data: selection }] = await Promise.all([
    admin.from('suppliers').select('*').in('profile_id', ids),
    admin.from('stores').select('id, owner_id, slug, name, logo_url, followers_count, is_recruiting').eq('owner_type', 'supplier').in('owner_id', ids),
    admin.from('user_badges').select('profile_id, badge').in('profile_id', ids),
    admin.from('reseller_shop_items').select('product_id').eq('reseller_id', session.uid),
  ]);

  const produitVersFournisseur = new Map((produits || []).map((p: any) => [p.id, p.supplier_id]));
  const vendus = new Set((selection || []).map((s: any) => produitVersFournisseur.get(s.product_id)).filter(Boolean));

  const boutiqueDe = new Map((boutiques || []).map((b: any) => [b.owner_id, b]));
  const cle = cleAbonne({ profileId: session.uid })!;
  const idsBoutiques = (boutiques || []).map((b: any) => b.id);
  const { data: suivis } = idsBoutiques.length
    ? await admin.from('store_follows').select('store_id').eq('follower_key', cle).in('store_id', idsBoutiques)
    : { data: [] as any[] };
  const boutiquesSuivies = new Set((suivis || []).map((s: any) => s.store_id));

  const fournisseurs = (fiches || []).map((f: any) => {
    const b: any = boutiqueDe.get(f.profile_id);
    const suit = Boolean(b && boutiquesSuivies.has(b.id));
    return {
      id: f.profile_id,
      nom: b?.name || f.shop_display_name || f.company_name || 'Fournisseur',
      logo: b?.logo_url || f.logo_url || null,
      lien: b?.slug ? `/boutique/${b.slug}` : f.slug ? `/s/${f.slug}` : null,
      produits: parFournisseur.get(f.profile_id)?.produits || 0,
      nouveautes: parFournisseur.get(f.profile_id)?.nouveautes || 0,
      abonnes: Number(b?.followers_count) || 0,
      recrute: Boolean(b?.is_recruiting),
      verifie: (badges || []).some((x: any) => x.profile_id === f.profile_id && x.badge === 'fournisseur_verifie'),
      suit,
      vend: vendus.has(f.profile_id),
    };
  });
  fournisseurs.sort((a, b) => Number(b.recrute) - Number(a.recrute) || b.produits - a.produits);
  return NextResponse.json({ fournisseurs });
}

/** Suivre / ne plus suivre un fournisseur. Sa boutique est créée si elle n'existe pas encore. */
export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const { fournisseurId } = await req.json().catch(() => ({}));
  if (typeof fournisseurId !== 'string') return NextResponse.json({ error: 'Fournisseur requis.' }, { status: 400 });
  const { data: fiche } = await admin.from('suppliers').select('company_name, shop_display_name').eq('profile_id', fournisseurId).maybeSingle();
  if (!fiche) return NextResponse.json({ error: 'Fournisseur introuvable.' }, { status: 404 });

  const boutique = await obtenirOuCreerBoutique({
    typeProprietaire: 'supplier', proprietaireId: fournisseurId,
    nom: fiche.shop_display_name || fiche.company_name || 'Fournisseur',
  });
  if (!boutique) return NextResponse.json({ error: 'Abonnements indisponibles pour le moment.' }, { status: 503 });

  const resultat = await basculerAbonnement({ boutiqueId: boutique.id, cle: cleAbonne({ profileId: session.uid })!, profileId: session.uid });
  if (!resultat) return NextResponse.json({ error: 'Abonnements indisponibles pour le moment.' }, { status: 503 });
  return NextResponse.json(resultat);
}
