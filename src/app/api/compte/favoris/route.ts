import { NextRequest, NextResponse } from 'next/server';
import { sessionDeLaRequete } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { basculerFavori, CompteError, mesFavoris } from '@/lib/compte-client';

/**
 * Favoris du compte (2026-09-26, compte client — C2).
 * GET → produits gardés ; POST { produitId, actif } → ajouter / retirer.
 */
export async function GET(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ error: 'Connectez-vous.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ favoris: [] });
  try {
    return NextResponse.json(await mesFavoris(admin, session.uid), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof CompteError ? e.status : 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ error: 'Connectez-vous pour garder vos favoris.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  const corps = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await basculerFavori(admin, session.uid, corps.produitId, corps.actif));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof CompteError ? e.status : 500 });
  }
}
