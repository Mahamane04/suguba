import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { permissionsDuMembre } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { libelleMetier, metierDuRole, rubriquesVisibles } from '@/lib/admin/poste';

/**
 * Poste de travail du membre connecté (A1, 2026-09-27) : son métier, ses
 * droits et les rubriques du menu qu'il peut ouvrir. Les droits eux-mêmes
 * restent vérifiés par chaque route : ce menu n'est qu'un raccourci.
 */
export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const { permissions, teamRole } = await permissionsDuMembre(session.uid);
  const metier = metierDuRole(teamRole);
  const admin = getSupabaseAdmin();
  const { data: profil } = admin
    ? await admin.from('profiles').select('full_name').eq('id', session.uid).maybeSingle()
    : { data: null };
  return NextResponse.json({
    nom: profil?.full_name || 'Admin',
    teamRole,
    metier,
    libelleMetier: libelleMetier(metier),
    permissions,
    rubriques: rubriquesVisibles(permissions),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
