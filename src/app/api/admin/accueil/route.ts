import { NextRequest, NextResponse } from 'next/server';
import { avecJournal } from '@/lib/admin/journal-route';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { ecrireReglagesReseau, lireReglagesReseau } from '@/lib/reseau/recompenses';
import { normaliserBlocsAccueil } from '@/lib/reseau/reglages';

/**
 * Blocs de l'accueil client (A5, 2026-09-27) : afficher ou masquer « À la
 * une », « Boutiques près de chez vous », « Gagner de l'argent » et
 * « Garanties ». Le catalogue et la recherche restent toujours visibles.
 * Masquer un bloc ne rend rien vendable ni invendable.
 */
export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/accueil');
  if (refus) return refus;
  if (!(await sessionAvecRole(req, 'admin'))) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  return NextResponse.json({ blocs: (await lireReglagesReseau()).accueilBlocs }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: NextRequest) {
  return avecJournal(req, 'POST /api/admin/accueil', () => postInterne(req));
}

async function postInterne(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'POST /api/admin/accueil');
  if (refus) return refus;
  if (!(await sessionAvecRole(req, 'admin'))) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const corps = await req.json().catch(() => ({}));
  const blocs = normaliserBlocsAccueil(corps.blocs);
  const reglages = await ecrireReglagesReseau({ accueilBlocs: blocs });
  if (!reglages) return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 503 });
  return NextResponse.json({ ok: true, blocs: reglages.accueilBlocs });
}
