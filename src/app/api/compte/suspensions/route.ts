import { NextRequest, NextResponse } from 'next/server';
import { sessionDeLaRequete } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { contester, mesSuspensions, SuspensionError } from '@/lib/suspensions';

/**
 * Mes suspensions (2026-09-26, Protection Suguba — lot 3) : le partenaire
 * voit le motif de chaque suspension et peut la contester une fois.
 *
 * GET  → suspensions du compte connecté (les 10 dernières)
 * POST { id, texte } → contestation
 */
export async function GET(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ error: 'Connectez-vous.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ suspensions: [] });
  return NextResponse.json({ suspensions: await mesSuspensions(admin, session.uid) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ error: 'Connectez-vous.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  const corps = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await contester(admin, session.uid, { id: corps.id, texte: corps.texte }));
  } catch (e) {
    if (e instanceof SuspensionError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Envoi impossible. Réessayez.' }, { status: 500 });
  }
}
