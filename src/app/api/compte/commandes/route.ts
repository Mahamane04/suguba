import { NextRequest, NextResponse } from 'next/server';
import { sessionDeLaRequete } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { CompteError, delivrerCle, mesAchats, rattacherAnciens } from '@/lib/compte-client';

/**
 * Mes commandes (2026-09-26, compte client — C1), pour tout compte connecté.
 *
 * GET  → commandes et devis rattachés au compte
 * POST { action: 'cle', type: 'commande' | 'devis', ref } → clé pour ouvrir
 *      ce reçu ou ce devis sur ce téléphone (propriétaire seulement)
 * POST { action: 'rattacher', commandes: [{numero, cle}], devis: [{numero, cle}] }
 *      → ajoute des achats passés sans compte, avec la clé gardée sur ce téléphone
 */
export async function GET(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ error: 'Connectez-vous.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ commandes: [], devis: [] });
  try {
    return NextResponse.json(await mesAchats(admin, session.uid), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof CompteError ? e.status : 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ error: 'Connectez-vous.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  const corps = await req.json().catch(() => ({}));
  try {
    if (corps.action === 'cle') return NextResponse.json(await delivrerCle(admin, session.uid, corps.type, corps.ref), { headers: { 'Cache-Control': 'no-store' } });
    if (corps.action === 'rattacher') return NextResponse.json(await rattacherAnciens(admin, session.uid, corps));
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof CompteError ? e.status : 500 });
  }
}
