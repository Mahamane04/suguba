import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerReglages } from '@/lib/platform-settings';
import { blocageEspeces, chargerCaisses, duParCollecteur, remunerationRetenue } from '@/lib/caisse-livreur';

/**
 * Caisse du livreur connecté (2026-09-25) : espèces encaissées pas encore
 * remises à Suguba, et historique de ses versements. Lecture seule — seul un
 * admin enregistre un versement, à la réception de l'argent.
 */
export async function GET(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'driver') {
    return NextResponse.json({ error: 'Authentification livreur requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ caisse: null, migrationRequise: false });

  const { reglages } = await chargerReglages();
  const { caisses, migrationRequise, error } = await chargerCaisses(admin, reglages, [session.uid]);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({
    caisse: caisses[0] ? { ...caisses[0], ...blocageEspeces(duParCollecteur(caisses[0]), caisses[0].plusAncienne, reglages) } : null,
    migrationRequise,
    remunerationParCourse: remunerationRetenue(reglages),
    livreurGardeRemuneration: reglages.livreurGardeRemuneration !== false,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
