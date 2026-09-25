import { verifySessionToken, type SugubaSession, type SugubaRole, type ProfileStatus } from './session';
import { getSupabaseAdmin } from './supabase-admin';
import { permissionsEffectives } from './reseau/permissions';
import { PERMISSION_PAR_ROUTE } from './reseau/permissions-routes';

/** Identité actuelle en base ; allowPending est réservé à l’onboarding et à /auth/me. */
export async function verifyActiveSession(token: string | undefined, allowPending = false): Promise<SugubaSession | null> {
  const session = await verifySessionToken(token);
  if (!session) return null;
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  try {
    const uid = session.apercu?.depuis.uid || session.uid;
    const { data: profile, error } = await admin.from('profiles')
      .select('role, status, phone').eq('id', uid).maybeSingle();
    if (error || !profile || !['active', ...(allowPending ? ['pending_approval'] : [])].includes(profile.status)) return null;
    const { data: rows, error: rolesError } = await admin.from('profile_roles')
      .select('role, status').eq('profile_id', uid);
    if (rolesError) return null;
    const roles: Partial<Record<SugubaRole, ProfileStatus>> = {};
    for (const row of rows || []) roles[row.role as SugubaRole] = row.status;
    if (!roles[profile.role as SugubaRole]) roles[profile.role as SugubaRole] = profile.status;
    // L’aperçu existant conserve son identité fictive, mais jamais les droits
    // d’un administrateur suspendu ou dont l’autorisation a été retirée.
    if (session.apercu) {
      if (profile.status !== 'active' || roles.admin !== 'active' ||
          !['customer', 'reseller', 'supplier', 'diaspora'].includes(session.role) || session.uid !== `apercu-${session.role}`) return null;
      const { data: team, error: teamError } = await admin.from('admin_team_members')
        .select('team_role, permissions').eq('profile_id', uid).maybeSingle();
      if (teamError || !permissionsEffectives(team && { teamRole: team.team_role, permissions: team.permissions })
        .includes(PERMISSION_PAR_ROUTE['POST /api/admin/preview-role'])) return null;
      return session;
    }
    const status = roles[session.role];
    if (status !== 'active' && !(allowPending && status === 'pending_approval')) return null;
    return { ...session, phone: profile.phone || session.phone, status, roles };
  } catch { return null; }
}
