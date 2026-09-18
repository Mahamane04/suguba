import { NextRequest, NextResponse } from 'next/server';
import { boutiquesParQuartier, boutiquesQuiRecrutent } from '@/lib/reseau/boutiques';

/**
 * Boutiques publiques.
 *
 * - sans paramètre : boutiques qui recherchent des revendeurs (§ 18) ;
 * - `?quartier=<nom>` : boutiques du quartier et des environs (2026-09-18).
 *
 * Route publique : ce sont des vitrines, elles doivent être visibles par un
 * visiteur qui n'a pas encore de compte. Elle ne renvoie que des champs publics.
 */
export async function GET(req: NextRequest) {
  const quartier = req.nextUrl.searchParams.get('quartier')?.trim().slice(0, 80);
  if (quartier) {
    const resultats = await boutiquesParQuartier(quartier);
    return NextResponse.json({
      quartier,
      boutiques: resultats.map(({ boutique: b, niveau, distanceKm }) => ({
        slug: b.slug,
        nom: b.nom,
        accroche: b.accroche,
        logo: b.logo,
        couverture: b.couverture,
        abonnes: b.abonnes,
        categories: b.categories,
        quartier: b.quartier,
        lien: b.lien || `/boutique/${b.slug}`,
        niveau,
        distanceKm,
      })),
    });
  }

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
