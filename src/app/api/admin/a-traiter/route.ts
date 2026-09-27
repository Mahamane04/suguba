import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { permissionsDuMembre } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { permissionsEffectives } from '@/lib/reseau/permissions';
import { METIERS, TACHES, metierDuRole, preparerTaches, type Metier } from '@/lib/admin/poste';
import { chargerAffectations, chargerTaches } from '@/lib/admin/a-traiter';

/**
 * File « À traiter » (A1, 2026-09-27) : les dossiers qui attendent une
 * décision, filtrés selon les droits du membre et son métier. Renvoie aussi
 * les collègues à qui un dossier peut être transféré.
 */
export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const { permissions, teamRole } = await permissionsDuMembre(session.uid);
  if (!permissions.length) return NextResponse.json({ error: 'Aucun rôle d’équipe : demandez à un Super Admin de vous en attribuer un.' }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  // Compteurs du menu (U3) : combien de dossiers attendent, par type, pour
  // tout ce que ce membre a le droit de voir. Léger : ni affectations ni collègues.
  if (req.nextUrl.searchParams.get('compteurs') === '1') {
    const { taches, indisponibles } = await chargerTaches(admin, permissions);
    const compteurs: Partial<Record<keyof typeof TACHES, number>> = {};
    for (const t of taches) compteurs[t.type] = (compteurs[t.type] || 0) + 1;
    return NextResponse.json({ compteurs, indisponibles }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  const demande = req.nextUrl.searchParams.get('metier');
  const metier: Metier | 'toutes' = demande === 'toutes' ? 'toutes'
    : METIERS.some((m) => m.valeur === demande) ? (demande as Metier) : metierDuRole(teamRole);

  const [{ taches, indisponibles }, affectations, equipe] = await Promise.all([
    chargerTaches(admin, permissions),
    chargerAffectations(admin),
    admin.from('admin_team_members').select('profile_id, team_role, permissions'),
  ]);
  const liste = preparerTaches(taches, permissions, affectations, metier);

  // Collègues et droits : pour proposer un transfert seulement à qui peut traiter.
  const membres = equipe.data || [];
  const { data: profils } = membres.length
    ? await admin.from('profiles').select('id, full_name').in('id', membres.map((m: any) => m.profile_id))
    : { data: [] as any[] };
  const noms = new Map((profils || []).map((p: any) => [p.id, p.full_name || 'Membre']));
  const collegues = membres.map((m: any) => ({
    id: m.profile_id, nom: noms.get(m.profile_id) || 'Membre',
    types: (Object.keys(TACHES) as (keyof typeof TACHES)[]).filter((t) =>
      permissionsEffectives({ teamRole: m.team_role, permissions: m.permissions }).includes(TACHES[t].permission)),
  }));

  return NextResponse.json({
    metier, metierMembre: metierDuRole(teamRole), moi: session.uid,
    taches: liste, indisponibles, collegues,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
