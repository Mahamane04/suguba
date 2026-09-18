import { NextRequest, NextResponse } from 'next/server';
import { sessionDeLaRequete } from '@/lib/reseau/route-session';
import { boutiquesSuivies, cleAbonne } from '@/lib/reseau/boutiques';

/**
 * Boutiques suivies (§ 32 des écrans) — par compte, ou par le téléphone
 * mémorisé sur l'appareil pour un client sans compte. Les deux listes sont
 * réunies : un client qui a suivi une boutique avant de créer son compte ne
 * doit pas la perdre.
 */
export async function GET(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  const telephone = req.nextUrl.searchParams.get('telephone');

  const cles = [
    cleAbonne({ profileId: session?.uid }),
    cleAbonne({ telephone }),
  ].filter((c): c is string => Boolean(c));

  const listes = await Promise.all(cles.map((c) => boutiquesSuivies(c)));
  const vues = new Set<string>();
  const boutiques = listes.flat().filter((b) => (vues.has(b.id) ? false : (vues.add(b.id), true)));

  return NextResponse.json({
    boutiques: boutiques.map((b) => ({
      slug: b.slug, nom: b.nom, accroche: b.accroche, logo: b.logo,
      abonnes: b.abonnes, type: b.typeProprietaire,
    })),
  });
}
