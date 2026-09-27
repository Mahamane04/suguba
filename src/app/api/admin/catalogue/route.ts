import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { lireFiltres } from '@/lib/admin/tableau';
import { listerCatalogue } from '@/lib/admin/catalogue-admin';

/** Catalogue en tableau (A4, 2026-09-27) : filtres, tri, pagination côté serveur. */
export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/catalogue');
  if (refus) return refus;
  if (!(await sessionAvecRole(req, 'admin'))) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  const page = Math.max(1, Math.min(10000, Number(req.nextUrl.searchParams.get('page')) || 1));
  try {
    return NextResponse.json(await listerCatalogue(admin, lireFiltres(req.nextUrl.searchParams), page), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Catalogue indisponible. Réessayez.' }, { status: 503 });
  }
}
