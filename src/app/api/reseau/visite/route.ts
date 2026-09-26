import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session';
import { debutVisite, qualifierVisite } from '@/lib/reseau/resultats-db';

/**
 * Visites qualifiées (2026-09-26, lot 3) — route PUBLIQUE, appelée par la
 * page produit ouverte avec le code d'un revendeur.
 *
 * POST { etape: 'debut', produitId, code } → { jeton }
 * POST { etape: 'fin', jeton }             → { qualifiee }
 *
 * Aucune IP stockée (empreintes salées). La réponse ne dit jamais si la
 * visite a été payée : un tricheur n'apprend rien en rejouant l'appel.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ jeton: null });
  const corps = await req.json().catch(() => ({}));
  const visiteur = {
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    userAgent: req.headers.get('user-agent'),
    sessionUid: (await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value).catch(() => null))?.uid || null,
  };
  try {
    if (corps?.etape === 'debut') {
      const { jeton } = await debutVisite(admin, { produitId: corps.produitId, code: corps.code, ...visiteur });
      return NextResponse.json({ jeton });
    }
    if (corps?.etape === 'fin') {
      const { qualifiee } = await qualifierVisite(admin, { jeton: corps.jeton, ...visiteur });
      return NextResponse.json({ qualifiee });
    }
  } catch (e) {
    // La mesure ne doit jamais gêner le visiteur.
    console.error('[VISITE]', (e as Error).message);
  }
  return NextResponse.json({ jeton: null, qualifiee: false });
}
