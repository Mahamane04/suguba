import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, SugubaSession } from '@/lib/session';

const DEMO_ROLES: SugubaSession['role'][] = ['admin', 'supplier', 'reseller', 'driver'];

/**
 * Ancienne « Connexion rapide » (BUG-003) — désormais bloquée par défaut.
 * Ne fonctionne QUE si la variable serveur SUGUBA_DEMO_MODE=true est définie
 * explicitement (jamais côté client, donc jamais falsifiable par un visiteur).
 * À ne JAMAIS activer sur un environnement exposé à de vrais clients/argent.
 */
export async function POST(req: NextRequest) {
  if (process.env.SUGUBA_DEMO_MODE !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Connexion rapide désactivée sur cet environnement.' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const role = body.role as SugubaSession['role'];
  if (!DEMO_ROLES.includes(role)) {
    return NextResponse.json({ success: false, error: 'Rôle invalide.' }, { status: 400 });
  }

  const token = await createSessionToken({ uid: `demo-${role}`, phone: '+22300000000', role, status: 'active' });
  const res = NextResponse.json({ success: true, role });
  res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
  return res;
}
