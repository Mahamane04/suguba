import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut, membreEquipe } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { permissionsDuRole, permissionsEffectives, PERMISSIONS, ROLES_EQUIPE, type RoleEquipe } from '@/lib/reseau/permissions';

/**
 * Équipe administrative (§ 23, § 50 des écrans).
 *
 * ⚠️ Un membre ne peut pas modifier sa PROPRE ligne : sans cette règle, un
 * compte Support pourrait se donner « plateforme.equipe » puis tout le reste.
 */

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });

  const moi = await membreEquipe(session.uid);
  if (!(await adminPeut(session.uid, 'plateforme.equipe'))) {
    return NextResponse.json({
      membres: [],
      roles: ROLES_EQUIPE,
      permissions: PERMISSIONS,
      moi: { teamRole: moi?.teamRole || null, permissions: permissionsEffectives(moi) },
      lectureSeule: true,
    });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ membres: [], roles: ROLES_EQUIPE, permissions: PERMISSIONS });

  const { data: lignes } = await admin.from('admin_team_members').select('*');
  const { data: admins } = await admin.from('profiles').select('id, full_name, phone, email').eq('role', 'admin').limit(100);

  const index = new Map((lignes || []).map((l: any) => [l.profile_id, l]));
  const membres = (admins || []).map((p: any) => ({
    id: p.id,
    nom: p.full_name,
    contact: p.phone || p.email || null,
    teamRole: index.get(p.id)?.team_role || null,
    permissions: permissionsEffectives(index.get(p.id) ? { teamRole: index.get(p.id).team_role, permissions: index.get(p.id).permissions } : null),
    estMoi: p.id === session.uid,
  }));

  return NextResponse.json({
    membres,
    roles: ROLES_EQUIPE,
    permissions: PERMISSIONS,
    moi: { teamRole: moi?.teamRole || null, permissions: permissionsEffectives(moi) },
    lectureSeule: false,
  });
}

export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'plateforme.equipe'))) {
    return NextResponse.json({ error: 'Votre rôle ne permet pas de gérer l’équipe.' }, { status: 403 });
  }

  const { profileId, teamRole, permissions } = await req.json().catch(() => ({}));
  if (typeof profileId !== 'string' || !profileId) {
    return NextResponse.json({ error: 'Membre requis.' }, { status: 400 });
  }
  if (profileId === session.uid) {
    return NextResponse.json({ error: 'Vous ne pouvez pas modifier vos propres droits.' }, { status: 403 });
  }
  if (!ROLES_EQUIPE.some((r) => r.valeur === teamRole)) {
    return NextResponse.json({ error: 'Rôle d’équipe inconnu.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  // Les permissions supplémentaires sont filtrées sur le catalogue : une
  // chaîne libre en base deviendrait une permission fantôme, jamais vérifiée.
  const base = permissionsDuRole(teamRole as RoleEquipe);
  const sup = Array.isArray(permissions)
    ? permissions.filter((p: unknown) => (PERMISSIONS as readonly string[]).includes(p as string) && !base.includes(p as never))
    : [];

  const { error } = await admin.from('admin_team_members').upsert(
    { profile_id: profileId, team_role: teamRole, permissions: sup, created_by: session.uid },
    { onConflict: 'profile_id' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
