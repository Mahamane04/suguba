import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { enregistrerParrainage, mesParrainages } from '@/lib/reseau/parrainage';
import { journaliser } from '@/lib/reseau/db';
import { avancerMissions } from '@/lib/reseau/missions-db';

/** Parrainages du revendeur (§ 12). */

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });

  const parrainages = await mesParrainages(session.uid);
  return NextResponse.json({
    parrainages,
    totaux: {
      invitations: parrainages.length,
      clients: parrainages.filter((p) => p.type === 'customer').length,
      revendeurs: parrainages.filter((p) => p.type === 'reseller').length,
      gains: parrainages.reduce((s, p) => s + (p.statut === 'rewarded' ? p.recompense : 0), 0),
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });

  const corps = await req.json().catch(() => ({}));
  const type = corps.type === 'reseller' || corps.type === 'supplier' ? corps.type : 'customer';
  if (typeof corps.telephone !== 'string' || corps.telephone.replace(/\D/g, '').length < 8) {
    return NextResponse.json({ error: 'Numéro du filleul invalide.' }, { status: 400 });
  }

  const parrainage = await enregistrerParrainage({
    parrainId: session.uid,
    type,
    telephone: corps.telephone,
    linkCode: typeof corps.linkCode === 'string' ? corps.linkCode : null,
  });
  if (!parrainage) {
    return NextResponse.json({ error: 'Parrainage indisponible pour le moment.' }, { status: 503 });
  }

  await journaliser({ evenement: 'REFERRAL', acteurId: session.uid, resellerId: session.uid, sujetType: type });
  // Un même filleul ne compte qu'une fois (le parrainage existant est renvoyé).
  await avancerMissions(session.uid, 'referral', `parrainage:${parrainage.id}`);
  return NextResponse.json({ parrainage });
}
