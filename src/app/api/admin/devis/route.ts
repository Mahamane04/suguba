import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { DevisError, listerDevisAdmin } from '@/lib/devis';

/**
 * Devis (2026-09-26) — suivi de toutes les demandes par l'équipe Suguba.
 * Lecture seule : répondre reste l'affaire du fournisseur.
 */
export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/devis');
  if (refus) return refus;
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ devis: [], migrationRequise: false, relanceHeures: 24 });
  try {
    return NextResponse.json(await listerDevisAdmin(admin), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const err = e as DevisError;
    return NextResponse.json({ error: err.message || 'Lecture impossible.' }, { status: err.status || 500 });
  }
}
