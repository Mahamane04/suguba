import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut } from '@/lib/reseau/db';
import { listerMissions } from '@/lib/reseau/missions-db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { TYPES_MISSION } from '@/lib/reseau/missions';

/** Administration des missions (§ 48 des écrans). */

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'mission.gerer'))) {
    return NextResponse.json({ error: 'Votre rôle ne donne pas accès aux missions.' }, { status: 403 });
  }
  return NextResponse.json({ missions: await listerMissions(), types: TYPES_MISSION });
}

export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'mission.gerer'))) {
    return NextResponse.json({ error: 'Votre rôle ne permet pas de créer une mission.' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const corps = await req.json().catch(() => ({}));

  // Changement de statut d'une mission existante.
  if (typeof corps.missionId === 'string') {
    if (!['draft', 'active', 'paused', 'ended'].includes(corps.statut)) {
      return NextResponse.json({ error: 'Statut inconnu.' }, { status: 400 });
    }
    const { error } = await admin.from('missions').update({ status: corps.statut }).eq('id', corps.missionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  const titre = typeof corps.titre === 'string' ? corps.titre.trim() : '';
  const type = TYPES_MISSION.find((t) => t.valeur === corps.type)?.valeur;
  if (titre.length < 3 || !type) {
    return NextResponse.json({ error: 'Titre et type de mission requis.' }, { status: 400 });
  }

  const objectif = Math.max(1, Math.min(10000, Number(corps.objectif) || 1));
  const recompense = Math.max(0, Math.min(1000000, Number(corps.recompense) || 0));

  const { data, error } = await admin
    .from('missions')
    .insert({
      title: titre.slice(0, 120),
      description: typeof corps.description === 'string' ? corps.description.slice(0, 600) : null,
      mission_type: type,
      objective: objectif,
      reward_amount: recompense,
      reward_label: typeof corps.recompenseLibelle === 'string' ? corps.recompenseLibelle.slice(0, 80) : null,
      conditions: typeof corps.conditions === 'string' ? corps.conditions.slice(0, 400) : null,
      product_id: typeof corps.produitId === 'string' && corps.produitId ? corps.produitId : null,
      created_by: session.uid,
      ends_at: typeof corps.finitLe === 'string' && corps.finitLe ? new Date(corps.finitLe).toISOString() : null,
      max_participants: corps.maxParticipants ? Math.max(1, Number(corps.maxParticipants)) : null,
      // Une mission naît en brouillon : elle n'apparaît aux revendeurs
      // qu'après une activation explicite, pour éviter qu'une frappe malheureuse
      // ne promette une récompense à tout le réseau.
      status: 'draft',
    })
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ missionId: data?.id });
}
