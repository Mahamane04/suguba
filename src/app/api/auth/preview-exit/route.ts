import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, verifySessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/session';

/**
 * Quitte le mode aperçu (voir /api/admin/preview-role) et restaure la vraie
 * session admin d'origine.
 *
 * Volontairement HORS de `/api/admin/*` : au moment de l'appel, la session a
 * `role` = 'reseller'/'supplier'/'diaspora'/'customer' (le rôle prévisualisé),
 * jamais 'admin' — une route sous `/api/admin/*` serait bloquée par le
 * middleware avant même d'arriver ici. La sécurité vient d'ailleurs :
 * seule une session marquée `apercu` (posée uniquement par preview-role,
 * signée par le même secret) peut restaurer quoi que ce soit, et seulement
 * l'identité qu'ELLE portait déjà (`apercu.depuis`) — jamais un uid fourni
 * par le corps de la requête.
 */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || !session.apercu) {
    return NextResponse.json({ error: "Aucun aperçu en cours." }, { status: 400 });
  }

  const token = await createSessionToken({
    uid: session.apercu.depuis.uid,
    phone: session.apercu.depuis.phone,
    role: 'admin',
    status: 'active',
    roles: { admin: 'active' },
  });

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
  return res;
}
