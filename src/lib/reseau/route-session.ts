import { verifyActiveSession } from '../active-session';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, type SugubaRole, type SugubaSession } from '../session';

/**
 * Session d'une route API du module Réseau. Regroupée ici pour que les douze
 * routes ne recopient pas douze fois la même vérification — une copie oubliée
 * est une route ouverte.
 */
export async function sessionDeLaRequete(req: NextRequest): Promise<SugubaSession | null> {
  return verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export async function sessionAvecRole(req: NextRequest, role: SugubaRole): Promise<SugubaSession | null> {
  const session = await sessionDeLaRequete(req);
  return session && session.role === role ? session : null;
}
