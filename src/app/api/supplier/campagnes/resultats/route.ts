import { NextRequest, NextResponse } from 'next/server';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { contesterResultat, resultatsFournisseur, ResultatError } from '@/lib/reseau/resultats-db';

/**
 * Résultats des campagnes au résultat du fournisseur (2026-09-26, lot 3).
 *
 * GET  → les 200 derniers résultats (visites et demandes payées)
 * POST { id, motif } → contester un résultat dans les 48 h : son prix est
 *      gelé jusqu'à la décision de Suguba.
 */
export async function GET(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'sponsorisation');
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ resultats: [] });
  return NextResponse.json({ resultats: await resultatsFournisseur(admin, acces.contexte.fournisseurId) });
}

export async function POST(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'sponsorisation');
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  const corps = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await contesterResultat(admin, acces.contexte.fournisseurId, { id: corps.id, motif: corps.motif }));
  } catch (e) {
    if (e instanceof ResultatError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Contestation impossible. Réessayez.' }, { status: 500 });
  }
}
