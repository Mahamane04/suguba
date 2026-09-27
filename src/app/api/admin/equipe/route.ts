import { avecJournal } from '@/lib/admin/journal-route';
import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut, membreEquipe } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { permissionsDuRole, permissionsEffectives, PERMISSIONS, ROLES_EQUIPE, type RoleEquipe } from '@/lib/reseau/permissions';
import { libelleProfils, motifCandidat, roleDeRepli, verifierAjout, verifierChangementRole, verifierRetrait } from '@/lib/admin/equipe';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Équipe administrative (§ 23, § 50 des écrans ; refonte U1 du 2026-09-27).
 *
 * GET              → les membres : rôle, double authentification, depuis quand.
 * GET ?candidats=  → comptes EXISTANTS trouvés par e-mail, nom ou téléphone.
 * POST ajouter     → un compte existant rejoint l'équipe avec son rôle.
 * POST role        → changer le rôle d'un membre.
 * POST retirer     → le membre quitte l'équipe (motif obligatoire).
 *
 * ⚠️ Un membre ne peut pas modifier sa PROPRE ligne : sans cette règle, un
 * compte Support pourrait se donner « plateforme.equipe » puis tout le reste.
 * Le dernier Super Admin ne peut être ni rétrogradé ni retiré.
 */

const LIMITE_CANDIDATS = 8;

async function superAdmins(admin: SupabaseClient): Promise<number> {
  const { count } = await admin.from('admin_team_members').select('profile_id', { count: 'exact', head: true }).eq('team_role', 'super_admin');
  return count ?? 0;
}

/** Déconnecte le compte partout : il repart d'une session neuve (nouveaux droits). */
async function fermerSessions(admin: SupabaseClient, profileId: string, parId: string) {
  await admin.from('sessions_revocations').upsert({ profile_id: profileId, avant: new Date().toISOString(), par_id: parId });
}

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
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const q = req.nextUrl.searchParams.get('candidats');
  if (q !== null) return candidats(admin, q);

  // Membres = ligne d'équipe, OU profil admin (rôle principal ou profil actif)
  // encore sans rôle d'équipe : ceux-là apparaissent « Affectation requise ».
  const [{ data: lignes, error: e1 }, { data: parRole }, { data: parProfil }] = await Promise.all([
    admin.from('admin_team_members').select('profile_id, team_role, permissions, created_at'),
    admin.from('profiles').select('id').eq('role', 'admin').limit(200),
    admin.from('profile_roles').select('profile_id').eq('role', 'admin').eq('status', 'active').limit(200),
  ]);
  if (e1) return NextResponse.json({ error: 'Lecture de l’équipe impossible.' }, { status: 503 });
  const ids = [...new Set([
    ...(lignes || []).map((l: any) => l.profile_id),
    ...(parRole || []).map((p: any) => p.id),
    ...(parProfil || []).map((p: any) => p.profile_id),
  ])];
  const { data: profils } = ids.length
    ? await admin.from('profiles').select('id, full_name, phone, email, auth_user_id').in('id', ids)
    : { data: [] as any[] };

  const index = new Map((lignes || []).map((l: any) => [l.profile_id, l]));
  const membres = await Promise.all((profils || []).map(async (p: any) => {
    const ligne = index.get(p.id);
    let mfa: boolean | null = null;
    if (p.auth_user_id) {
      const f = await admin.auth.admin.mfa.listFactors({ userId: p.auth_user_id }).catch(() => null);
      mfa = f && !f.error ? (f.data?.factors || []).some((x: { status: string }) => x.status === 'verified') : null;
    }
    return {
      id: p.id,
      nom: p.full_name || 'Sans nom',
      contact: p.email || p.phone || null,
      teamRole: ligne?.team_role || null,
      permissions: permissionsEffectives(ligne ? { teamRole: ligne.team_role, permissions: ligne.permissions } : null),
      depuis: ligne?.created_at || null,
      mfa,
      estMoi: p.id === session.uid,
    };
  }));
  // Soi d'abord, puis les comptes sans rôle (à affecter), puis par nom.
  membres.sort((a, b) => (Number(b.estMoi) - Number(a.estMoi))
    || (Number(Boolean(a.teamRole)) - Number(Boolean(b.teamRole)))
    || a.nom.localeCompare(b.nom, 'fr'));

  return NextResponse.json({
    membres,
    roles: ROLES_EQUIPE,
    permissions: PERMISSIONS,
    moi: { teamRole: moi?.teamRole || null, permissions: permissionsEffectives(moi) },
    lectureSeule: false,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

async function candidats(admin: SupabaseClient, brut: string) {
  const m = motifCandidat(brut);
  if (!m.ok) return NextResponse.json({ candidats: [], erreur: m.erreur });
  let requete = admin.from('profiles').select('id, full_name, phone, email, role, status').limit(LIMITE_CANDIDATS);
  requete = m.type === 'email' ? requete.ilike('email', `%${m.texte}%`)
    : m.type === 'telephone' ? requete.eq('phone', m.texte)
    : requete.ilike('full_name', `%${m.texte}%`);
  const { data, error } = await requete;
  if (error) return NextResponse.json({ error: 'Recherche indisponible.' }, { status: 503 });
  const ids = (data || []).map((p: any) => p.id);
  const [{ data: roles }, { data: equipe }] = ids.length
    ? await Promise.all([
      admin.from('profile_roles').select('profile_id, role, status').in('profile_id', ids),
      admin.from('admin_team_members').select('profile_id').in('profile_id', ids),
    ])
    : [{ data: [] as any[] }, { data: [] as any[] }];
  const membres = new Set((equipe || []).map((e: any) => e.profile_id));
  return NextResponse.json({
    candidats: (data || []).map((p: any) => ({
      id: p.id,
      nom: p.full_name || 'Sans nom',
      contact: p.email || p.phone || null,
      profils: libelleProfils(p.role, (roles || []).filter((r: any) => r.profile_id === p.id)),
      dejaMembre: membres.has(p.id),
      suspendu: p.status === 'suspended' || p.status === 'rejected',
    })),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: NextRequest) {
  return avecJournal(req, 'POST /api/admin/equipe', () => postInterne(req));
}

async function postInterne(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'plateforme.equipe'))) {
    return NextResponse.json({ error: 'Votre rôle ne permet pas de gérer l’équipe.' }, { status: 403 });
  }

  const corps = await req.json().catch(() => ({}));
  const { profileId, teamRole, permissions, motif } = corps;
  const action = corps.action === 'ajouter' || corps.action === 'retirer' ? corps.action : 'role';
  if (typeof profileId !== 'string' || !profileId) {
    return NextResponse.json({ error: 'Membre requis.' }, { status: 400 });
  }
  if (action !== 'retirer' && !ROLES_EQUIPE.some((r) => r.valeur === teamRole)) {
    return NextResponse.json({ error: 'Rôle d’équipe inconnu.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const [{ data: profil }, { data: ligne }, { data: roles }] = await Promise.all([
    admin.from('profiles').select('id, full_name, role, status').eq('id', profileId).maybeSingle(),
    admin.from('admin_team_members').select('team_role').eq('profile_id', profileId).maybeSingle(),
    admin.from('profile_roles').select('role, status').eq('profile_id', profileId),
  ]);
  if (!profil) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
  const nom = profil.full_name || 'Ce compte';
  const estAdmin = profil.role === 'admin' || (roles || []).some((r: any) => r.role === 'admin' && r.status === 'active');

  if (action === 'ajouter') {
    const refus = verifierAjout({ cibleId: profileId, moiId: session.uid, statutCompte: profil.status, dejaMembre: Boolean(ligne) });
    if (refus) return NextResponse.json({ error: refus }, { status: 409 });
    const maintenant = new Date().toISOString();
    // Son profil actuel (client, revendeur…) garde sa propre ligne : sans
    // elle, le passage du rôle principal à « admin » le lui ferait perdre.
    if (profil.role !== 'admin' && !(roles || []).some((r: any) => r.role === profil.role)) {
      await admin.from('profile_roles').upsert(
        { profile_id: profileId, role: profil.role, status: profil.status || 'active', approved_at: maintenant },
        { onConflict: 'profile_id,role', ignoreDuplicates: true },
      );
    }
    const { error: eRole } = await admin.from('profile_roles').upsert(
      { profile_id: profileId, role: 'admin', status: 'active', approved_at: maintenant, approved_by: session.uid },
      { onConflict: 'profile_id,role' },
    );
    if (eRole) return NextResponse.json({ error: 'Ajout non enregistré. Réessayez.' }, { status: 500 });
    const { error: eProfil } = await admin.from('profiles').update({ role: 'admin' }).eq('id', profileId);
    if (eProfil) return NextResponse.json({ error: 'Ajout non enregistré. Réessayez.' }, { status: 500 });
    const { error: eEquipe } = await admin.from('admin_team_members').upsert(
      { profile_id: profileId, team_role: teamRole, permissions: [], created_by: session.uid },
      { onConflict: 'profile_id' },
    );
    if (eEquipe) return NextResponse.json({ error: 'Ajout non enregistré. Réessayez.' }, { status: 500 });
    await fermerSessions(admin, profileId, session.uid);
    return NextResponse.json({ success: true, message: `${nom} a rejoint l’équipe. À sa prochaine connexion, il arrive sur « À traiter ».` });
  }

  if (!ligne && !estAdmin) {
    return NextResponse.json({ error: action === 'retirer' ? 'Ce compte ne fait pas partie de l’équipe.' : 'Ajoutez d’abord ce compte à l’équipe.' }, { status: 409 });
  }
  const nbSuperAdmins = await superAdmins(admin);

  if (action === 'retirer') {
    const refus = verifierRetrait({ cibleId: profileId, moiId: session.uid, roleCible: ligne?.team_role || null, superAdmins: nbSuperAdmins, motif });
    if (refus) return NextResponse.json({ error: refus }, { status: 409 });
    // Ordre choisi pour qu'un arrêt en cours de route laisse un état SÛR :
    // les droits d'abord, puis les sessions, puis le profil principal.
    const { error: eEquipe } = await admin.from('admin_team_members').delete().eq('profile_id', profileId);
    if (eEquipe) return NextResponse.json({ error: 'Retrait non enregistré. Réessayez.' }, { status: 500 });
    await fermerSessions(admin, profileId, session.uid);
    await admin.from('profile_roles').update({ status: 'suspended' }).eq('profile_id', profileId).eq('role', 'admin');
    if (profil.role === 'admin') {
      const repli = roleDeRepli((roles || []).filter((r: any) => r.role !== 'admin'));
      if (repli === 'customer') {
        await admin.from('profile_roles').upsert(
          { profile_id: profileId, role: 'customer', status: 'active', approved_at: new Date().toISOString() },
          { onConflict: 'profile_id,role', ignoreDuplicates: true },
        );
      }
      await admin.from('profiles').update({ role: repli }).eq('id', profileId);
    }
    return NextResponse.json({ success: true, message: `${nom} ne fait plus partie de l’équipe. Ses sessions ont été fermées.` });
  }

  // Changer le rôle d'un membre.
  const refus = verifierChangementRole({ cibleId: profileId, moiId: session.uid, ancienRole: ligne?.team_role || null, nouveauRole: teamRole, superAdmins: nbSuperAdmins });
  if (refus) return NextResponse.json({ error: refus }, { status: profileId === session.uid ? 403 : 409 });

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
  if (error) return NextResponse.json({ error: 'Rôle non enregistré. Réessayez.' }, { status: 400 });
  return NextResponse.json({ success: true, message: `Rôle de ${nom} mis à jour.` });
}
