import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { membreEquipe, permissionsDuMembre } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { permissionsEffectives } from '@/lib/reseau/permissions';
import { TACHES, type TypeTache } from '@/lib/admin/poste';
import { journaliserAction } from '@/lib/admin/journal';

/**
 * Responsable d'un dossier de la file « À traiter » (A1, 2026-09-27) :
 * prendre, transférer à un collègue qui a le droit de le traiter, libérer.
 */
export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const { permissions } = await permissionsDuMembre(session.uid);
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const corps = await req.json().catch(() => ({}));
  const dossier = typeof corps.dossier === 'string' ? corps.dossier : '';
  const [type, ...reste] = dossier.split(':');
  const id = reste.join(':');
  if (!(type in TACHES) || !/^[A-Za-z0-9_.:-]{1,120}$/.test(id)) return NextResponse.json({ error: 'Dossier inconnu.' }, { status: 400 });
  const permission = TACHES[type as TypeTache].permission;
  if (!permissions.includes(permission)) return NextResponse.json({ error: 'Votre rôle ne permet pas de traiter ce dossier.' }, { status: 403 });

  const action = corps.action;
  let cible: string | null = null;
  if (action === 'prendre') cible = session.uid;
  else if (action === 'transferer') {
    const membre = typeof corps.membreId === 'string' ? await membreEquipe(corps.membreId) : null;
    if (!membre || !permissionsEffectives(membre).includes(permission)) {
      return NextResponse.json({ error: 'Ce collègue n’a pas le droit de traiter ce dossier.' }, { status: 400 });
    }
    cible = membre.profileId;
  } else if (action !== 'liberer') return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });

  // Alerte de modification concurrente (A2) : si un collègue a changé le
  // responsable depuis que la page a été chargée, on n'écrase pas sa décision.
  const { data: actuelle } = await admin.from('admin_affectations').select('membre_id, par_id, updated_at').eq('dossier', dossier).maybeSingle();
  const vue = typeof corps.versionVue === 'string' ? corps.versionVue : corps.versionVue === null ? null : undefined;
  if (vue !== undefined && (actuelle?.updated_at ?? null) !== vue && actuelle?.par_id !== session.uid) {
    const { data: auteur } = actuelle?.par_id
      ? await admin.from('profiles').select('full_name').eq('id', actuelle.par_id).maybeSingle()
      : { data: null };
    return NextResponse.json({ error: `Ce dossier vient d’être modifié par ${auteur?.full_name || 'un collègue'}. Actualisez avant de décider.`, conflit: true }, { status: 409 });
  }

  const { error } = cible
    ? await admin.from('admin_affectations').upsert({ dossier, membre_id: cible, par_id: session.uid, updated_at: new Date().toISOString() }, { onConflict: 'dossier' })
    : await admin.from('admin_affectations').delete().eq('dossier', dossier);
  if (error) {
    if (['42P01', 'PGRST205'].includes(String(error.code))) return NextResponse.json({ error: 'Exécutez d’abord le SQL du poste de travail (A1).' }, { status: 409 });
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 503 });
  }
  await journaliserAction(admin, {
    auteurId: session.uid, action: `affectation.${action}`, dossier,
    apres: cible ? { responsable: cible } : { responsable: null },
  });
  return NextResponse.json({ ok: true, responsable: cible });
}
