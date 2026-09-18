import { NextRequest, NextResponse } from 'next/server';
import { chargerBoutiqueRevendeur } from '@/lib/shop';
import { boutiqueDuProprietaire } from '@/lib/reseau/boutiques';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Sélection du revendeur référent, pour l'accueil (§ 9 : « le client doit voir
 * en priorité les produits proposés par ce revendeur »).
 *
 * Publique, et ne renvoie que ce que la vitrine /r/<code> publie déjà : prénom
 * + initiale, produits approuvés, prix publics. Rien sur le revendeur au-delà.
 */
export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get('code') || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,40}$/.test(code)) return NextResponse.json({ selection: null });

  const vitrine = await chargerBoutiqueRevendeur(code);
  // Revendeur sans sélection propre : la vitrine se rabat sur tout le
  // catalogue. Ce n'est pas « sa » sélection, on n'affiche donc rien.
  if (!vitrine || vitrine.selectionVide || vitrine.produits.length === 0) {
    return NextResponse.json({ selection: null });
  }

  let slugBoutique: string | null = null;
  const admin = getSupabaseAdmin();
  const { data: profil } = (await admin?.from('profiles').select('id').eq('reseller_code', code).maybeSingle()) || { data: null };
  if (profil?.id) slugBoutique = (await boutiqueDuProprietaire('reseller', profil.id))?.slug || null;

  return NextResponse.json({
    selection: {
      nom: vitrine.nom,
      code,
      lienBoutique: slugBoutique ? `/boutique/${slugBoutique}` : `/r/${code}`,
      produits: vitrine.produits.slice(0, 8).map((p) => ({ slug: p.slug, nom: p.nom, prix: p.prix, image: p.image })),
    },
  });
}
