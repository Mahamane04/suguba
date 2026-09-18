import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut } from '@/lib/reseau/db';
import { deciderParrainage, deciderParticipation, parrainagesAValider, participationsAValider } from '@/lib/reseau/recompenses';

/**
 * Récompenses à valider : missions atteintes et parrainages en attente.
 *
 * Rien n'est payé automatiquement : un humain valide. Une mission « 10
 * partages » se remplit en dix clics sur un bouton, un parrainage se déclare
 * avec n'importe quel numéro — verser sans contrôle reviendrait à distribuer
 * de l'argent à qui sait cliquer. Permission requise : finance.payer.
 */

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'finance.lire'))) {
    return NextResponse.json({ error: 'Votre rôle ne donne pas accès aux récompenses.' }, { status: 403 });
  }
  const [missions, parrainages] = await Promise.all([participationsAValider(), parrainagesAValider()]);
  return NextResponse.json({ missions, parrainages });
}

export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'finance.payer'))) {
    return NextResponse.json({ error: 'Votre rôle ne permet pas de verser des récompenses.' }, { status: 403 });
  }

  const { type, id, decision } = await req.json().catch(() => ({}));
  if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'Élément requis.' }, { status: 400 });

  let resultat;
  if (type === 'mission' && (decision === 'validated' || decision === 'rejected')) {
    resultat = await deciderParticipation(id, decision);
  } else if (type === 'parrainage' && (decision === 'rewarded' || decision === 'rejected')) {
    resultat = await deciderParrainage(id, decision);
  } else {
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  }
  if (!resultat.ok) return NextResponse.json({ error: resultat.erreur }, { status: 400 });
  return NextResponse.json({ success: true, verse: resultat.verse || 0 });
}
