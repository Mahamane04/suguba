import { NextResponse } from 'next/server';
import { boutiqueRevendeurPublique } from '@/lib/shop';

export const dynamic = 'force-dynamic';

/**
 * GET /api/shop/revendeur?code=SG-XXXX → { nom: « Awa D. » | null, enseigne, slug }
 * Public : ne renvoie qu'un prénom et une initiale, et seulement pour un
 * revendeur actif (voir nomRevendeurPublic).
 *
 * Lot 4 du chantier boutique (2026-10-03) : + l'enseigne (nom de sa boutique s'il
 * en a choisi un) et l'adresse de sa boutique principale ACTIVE. La fiche produit
 * en fait « Boutique de <enseigne> · Voir sa boutique » : le client revient vers la
 * boutique d'où il vient. Le nom complet ne quitte jamais le serveur.
 */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code') || '';
  const boutique = code ? await boutiqueRevendeurPublique(code) : null;
  return NextResponse.json(
    { nom: boutique?.nom ?? null, enseigne: boutique?.enseigne ?? null, slug: boutique?.slug ?? null },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
