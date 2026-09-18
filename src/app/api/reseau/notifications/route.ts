import { NextRequest, NextResponse } from 'next/server';
import { sessionDeLaRequete } from '@/lib/reseau/route-session';
import { marquerLues, mesNotifications } from '@/lib/reseau/notifications';

/** Notifications du compte connecté — lecture et « tout marquer comme lu ». */

export async function GET(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  // Un visiteur n'a pas de notifications : réponse vide, pas d'erreur 401
  // rouge dans la console à chaque page (même raison que /api/auth/me).
  if (!session) return NextResponse.json({ notifications: [], nonLues: 0 });
  return NextResponse.json(await mesNotifications(session.uid));
}

export async function POST(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
  await marquerLues(session.uid);
  return NextResponse.json({ success: true });
}
