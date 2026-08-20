import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';

/**
 * Corrige BUG-001 / BUG-007 : jusqu'ici, /admin, /supplier, /driver (et
 * /reseller) rendaient leur contenu à quiconque tapait l'URL, sans la
 * moindre vérification. Ce middleware s'exécute AVANT le rendu de la page
 * (donc avant que la moindre donnée sensible ne parte vers le navigateur)
 * et refuse l'accès si la session signée est absente, invalide, expirée, ou
 * d'un rôle différent de celui exigé par la section visitée.
 *
 * Corrige aussi BUG-005 : /api/payouts/initiate exige désormais une session
 * admin valide avant de déclencher le moindre virement Mobile Money.
 *
 * Ajout du 2026-08-19 (demande de validation d'inscription) : même avec un
 * rôle qui correspond, un compte dont le dossier n'a pas encore été
 * approuvé par un admin (`status !== 'active'`) est redirigé vers
 * /pending-approval plutôt que vers le tableau de bord — le numéro
 * vérifié par OTP ne suffit plus à lui seul, voir /api/admin/review-profile.
 */

const ROLE_BY_PREFIX: { prefix: string; role: string }[] = [
  { prefix: '/admin', role: 'admin' },
  { prefix: '/supplier', role: 'supplier' },
  { prefix: '/driver', role: 'driver' },
  { prefix: '/reseller', role: 'reseller' },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (pathname.startsWith('/api/payouts/initiate')) {
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
    }
    return NextResponse.next();
  }

  const match = ROLE_BY_PREFIX.find(r => pathname.startsWith(r.prefix));
  if (match) {
    if (!session || session.role !== match.role) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('denied', match.role);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (session.status !== 'active' && pathname !== '/pending-approval') {
      return NextResponse.redirect(new URL('/pending-approval', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/supplier/:path*', '/driver/:path*', '/reseller/:path*', '/api/payouts/initiate'],
};
