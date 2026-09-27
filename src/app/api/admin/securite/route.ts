import { NextRequest, NextResponse } from 'next/server';
import { avecJournal } from '@/lib/admin/journal-route';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { lireSecurite } from '@/lib/admin/securite';
import { ROLES_EQUIPE } from '@/lib/reseau/permissions';

/**
 * Sécurité de l'équipe (A3, 2026-09-27) : réglages (double authentification
 * obligatoire, seuil de double validation), état de chaque membre (double
 * authentification activée, dernières connexions) et « Déconnecter partout ».
 */
export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/securite');
  if (refus) return refus;
  if (!(await sessionAvecRole(req, 'admin'))) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const reglages = await lireSecurite(admin);
  const { data: membres } = await admin.from('admin_team_members').select('profile_id, team_role');
  const ids = (membres || []).map((m: any) => m.profile_id);
  const [{ data: profils }, { data: connexions }, { data: revocations }] = await Promise.all([
    ids.length ? admin.from('profiles').select('id, full_name, email, auth_user_id').in('id', ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? admin.from('journal_admin').select('auteur_id, cree_le, apres').eq('action', 'connexion').in('auteur_id', ids).order('id', { ascending: false }).limit(200) : Promise.resolve({ data: [] as any[] }),
    ids.length ? admin.from('sessions_revocations').select('profile_id, avant').in('profile_id', ids) : Promise.resolve({ data: [] as any[] }),
  ]);
  const parId = new Map((profils || []).map((p: any) => [p.id, p]));
  const liste = await Promise.all((membres || []).map(async (m: any) => {
    const p = parId.get(m.profile_id) || {};
    let mfa: boolean | null = null;
    if (p.auth_user_id) {
      const f = await admin.auth.admin.mfa.listFactors({ userId: p.auth_user_id }).catch(() => null);
      mfa = f && !f.error ? (f.data?.factors || []).some((x: { status: string }) => x.status === 'verified') : null;
    }
    return {
      id: m.profile_id,
      nom: p.full_name || 'Membre',
      role: ROLES_EQUIPE.find((r) => r.valeur === m.team_role)?.libelle || m.team_role,
      mfa,
      connexions: (connexions || []).filter((c: any) => c.auteur_id === m.profile_id).slice(0, 5)
        .map((c: any) => ({ le: c.cree_le, appareil: String(c.apres?.appareil || '').slice(0, 120), aal: c.apres?.aal || null })),
      deconnecteLe: (revocations || []).find((r: any) => r.profile_id === m.profile_id)?.avant || null,
    };
  }));
  return NextResponse.json({ reglages, membres: liste }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: NextRequest) {
  return avecJournal(req, 'POST /api/admin/securite', () => postInterne(req));
}

async function postInterne(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'POST /api/admin/securite');
  if (refus) return refus;
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  const corps = await req.json().catch(() => ({}));

  if (corps.action === 'reglages') {
    const seuil = Number(corps.seuilValidation);
    if (!Number.isInteger(seuil) || seuil < 0 || seuil > 100_000_000) return NextResponse.json({ error: 'Seuil invalide (0 pour désactiver).' }, { status: 400 });
    const { error } = await admin.from('securite_equipe').upsert({
      id: 1, mfa_obligatoire: corps.mfaObligatoire === true, seuil_validation: seuil,
      updated_at: new Date().toISOString(), updated_by: session.uid,
    });
    if (error) {
      if (['42P01', 'PGRST205'].includes(String(error.code))) return NextResponse.json({ error: 'Exécutez d’abord le SQL de sécurité (A3).' }, { status: 409 });
      return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 503 });
    }
    return NextResponse.json({ ok: true, reglages: await lireSecurite(admin) });
  }

  if (corps.action === 'deconnecter') {
    const membreId = typeof corps.membreId === 'string' ? corps.membreId : '';
    const { data: membre } = await admin.from('admin_team_members').select('profile_id').eq('profile_id', membreId).maybeSingle();
    if (!membre) return NextResponse.json({ error: 'Membre inconnu.' }, { status: 404 });
    const { error } = await admin.from('sessions_revocations').upsert({ profile_id: membreId, avant: new Date().toISOString(), par_id: session.uid });
    if (error) {
      if (['42P01', 'PGRST205'].includes(String(error.code))) return NextResponse.json({ error: 'Exécutez d’abord le SQL de sécurité (A3).' }, { status: 409 });
      return NextResponse.json({ error: 'Déconnexion impossible.' }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
}
