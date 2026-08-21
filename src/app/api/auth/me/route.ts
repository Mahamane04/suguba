import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, rolesDeLaSession, SESSION_COOKIE_NAME } from '@/lib/session';

/**
 * Expose l'état d'authentification réel au client — corrige le dernier
 * endroit où le "compte" affiché venait du store de démo local
 * (sugubaStore.currentUser) au lieu de la session signée : le Header
 * montrait un profil "Moussa Revendeur" à n'importe quel visiteur anonyme,
 * sans connexion, ce qui n'a rien de professionnel. Rien de sensible n'est
 * renvoyé au-delà du rôle et du numéro déjà connu du visiteur lui-même.
 */
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }
  // `roles` alimente le sélecteur d'espace du Header : il ne doit proposer
  // que les rôles réellement détenus, jamais une liste en dur — c'était le
  // défaut de l'ancien sélecteur, qui laissait n'importe qui basculer vers
  // l'espace Admin.
  return NextResponse.json({
    authenticated: true,
    role: session.role,
    phone: session.phone,
    status: session.status,
    roles: rolesDeLaSession(session),
  });
}
