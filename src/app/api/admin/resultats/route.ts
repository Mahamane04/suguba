import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut } from '@/lib/reseau/db';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ecrireReglagesReseau } from '@/lib/reseau/recompenses';
import { deciderResultatAdmin, qualiteMesures, resultatsAdmin, ResultatError } from '@/lib/reseau/resultats-db';

/**
 * Rémunération au résultat (2026-09-26, lot 3) — page admin « Qualité des mesures ».
 *
 * GET  → qualité des mesures (30 jours) + résultats à vérifier et récents
 * POST { action: 'interrupteur', actif }            → plateforme.parametres
 * POST { action: 'decider', id, decision, motif }   → valider / annuler
 */
export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/resultats');
  if (refus) return refus;
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  try {
    const [qualite, resultats] = await Promise.all([qualiteMesures(admin), resultatsAdmin(admin)]);
    return NextResponse.json({ ...qualite, ...resultats, migrationRequise: qualite.migrationRequise || resultats.migrationRequise });
  } catch (e) {
    const status = e instanceof ResultatError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

export async function POST(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'POST /api/admin/resultats');
  if (refus) return refus;
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  const corps = await req.json().catch(() => ({}));

  if (corps.action === 'interrupteur') {
    if (!(await adminPeut(session.uid, 'plateforme.parametres'))) {
      return NextResponse.json({ error: 'Votre rôle ne permet pas de changer ce réglage.' }, { status: 403 });
    }
    if (typeof corps.actif !== 'boolean') return NextResponse.json({ error: 'Valeur invalide.' }, { status: 400 });
    const reglages = await ecrireReglagesReseau({ remunerationResultat: corps.actif });
    if (!reglages) return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 503 });
    return NextResponse.json({ actif: reglages.remunerationResultat });
  }

  if (corps.action === 'decider') {
    try {
      return NextResponse.json(await deciderResultatAdmin(admin, session.uid, { id: corps.id, decision: corps.decision, motif: corps.motif }));
    } catch (e) {
      if (e instanceof ResultatError) return NextResponse.json({ error: e.message }, { status: e.status });
      return NextResponse.json({ error: 'Décision impossible. Réessayez.' }, { status: 500 });
    }
  }
  return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
}
