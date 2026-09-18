import { NextRequest, NextResponse } from 'next/server';
import { boutiquesQuiRecrutent } from '@/lib/reseau/boutiques';

/**
 * Boutiques qui recherchent des revendeurs (§ 18).
 *
 * Route publique : c'est une vitrine de recrutement, elle doit être visible
 * par un visiteur qui n'a pas encore de compte — c'est précisément à lui
 * qu'elle s'adresse. Elle ne renvoie que des champs publics.
 */
export async function GET(_req: NextRequest) {
  const boutiques = await boutiquesQuiRecrutent(12);
  return NextResponse.json({
    boutiques: boutiques.map((b) => ({
      slug: b.slug,
      nom: b.nom,
      accroche: b.accroche,
      logo: b.logo,
      abonnes: b.abonnes,
      categories: b.categories,
    })),
  });
}
