import { NextResponse } from 'next/server';
import { nomRevendeurPublic } from '@/lib/shop';

export const dynamic = 'force-dynamic';

/**
 * GET /api/shop/revendeur?code=SG-XXXX → { nom: « Awa D. » | null }
 * Public : ne renvoie qu'un prénom et une initiale, et seulement pour un
 * revendeur actif (voir nomRevendeurPublic).
 */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code') || '';
  const nom = code ? await nomRevendeurPublic(code) : null;
  return NextResponse.json({ nom }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
