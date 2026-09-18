import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { listerMissions, mesParticipations, rejoindreMission } from '@/lib/reseau/missions-db';
import { journaliser } from '@/lib/reseau/db';

/** Missions proposées au revendeur et sa participation (§ 13). */

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });

  const [missions, participations] = await Promise.all([
    listerMissions({ statut: 'active' }),
    mesParticipations(session.uid),
  ]);
  return NextResponse.json({ missions, participations });
}

export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });

  const { missionId } = await req.json().catch(() => ({}));
  if (typeof missionId !== 'string' || !missionId) {
    return NextResponse.json({ error: 'Mission requise.' }, { status: 400 });
  }

  const resultat = await rejoindreMission(missionId, session.uid);
  if (!resultat.ok) return NextResponse.json({ error: resultat.erreur }, { status: 400 });

  await journaliser({ evenement: 'MISSION_JOIN', acteurId: session.uid, resellerId: session.uid, sujetType: 'mission', sujetRef: missionId });
  return NextResponse.json({ success: true });
}
