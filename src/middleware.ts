import { NextRequest, NextResponse } from 'next/server';
import {
  verifySessionToken,
  createSessionToken,
  rolesDeLaSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  type SugubaRole,
} from '@/lib/session';

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

/**
 * Routes API réservées à un rôle. Jusqu'ici seule /api/payouts/initiate était
 * gardée ici : toutes les autres se défendaient elles-mêmes, ce qui marchait
 * tant que chaque auteur y pensait. Une route écrite sans son contrôle serait
 * restée ouverte, sans que rien ne le signale.
 *
 * Le contrôle exercé ici est exactement celui des routes concernées
 * (`session.role !== <rôle>`), pas un contrôle d'appartenance plus permissif :
 * la barrière double la vérification existante sans en changer la sémantique.
 * Les routes gardent la leur — défense en profondeur, pas délégation.
 *
 * ⚠️ L'ordre compte : le premier préfixe qui correspond gagne. /api/payouts/
 * mélange deux rôles (create → revendeur, initiate → admin), d'où deux
 * entrées explicites plutôt qu'un préfixe commun qui casserait les retraits.
 */
const API_ROLE_BY_PREFIX: { prefix: string; role: SugubaRole }[] = [
  { prefix: '/api/admin/', role: 'admin' },
  { prefix: '/api/driver/', role: 'driver' },
  { prefix: '/api/supplier/', role: 'supplier' },
  { prefix: '/api/reseller/', role: 'reseller' },
  { prefix: '/api/payouts/initiate', role: 'admin' },
  { prefix: '/api/payouts/create', role: 'reseller' },
];

/**
 * Routes API exigeant une session valide, quel que soit le rôle.
 */
const API_SESSION_REQUISE = [
  '/api/auth/complete-profile',
  '/api/auth/me',
  '/api/auth/refresh-session',
  '/api/auth/request-role',
  '/api/orders/feed',
  // ⚠️ PAS /api/orders/sync : sa CRÉATION est publique — c'est le cœur du
  // parcours client sans compte, un acheteur qui commande depuis /p/[slug]
  // n'a pas de session. La route exige elle-même une session admin/livreur/
  // fournisseur pour les MISES À JOUR de statut, ce qui est le vrai risque.
  // L'avoir mise ici a cassé la commande invité en production le 2026-09-10.
  '/api/products/sync',
  '/api/products/upload-image',
];

/**
 * Routes API publiques par nécessité, listées pour que leur ouverture soit un
 * choix visible et non un oubli :
 *   /api/auth/supabase-exchange  — c'est la connexion elle-même ; elle vérifie
 *                                  le jeton Supabase côté serveur.
 *   /api/auth/logout             — doit marcher même sur une session morte.
 *   /api/auth/demo-login         — verrouillée par SUGUBA_DEMO_MODE côté serveur.
 *   /api/webhooks/saspay         — appelée par SasPay, pas par un navigateur ;
 *                                  gardée par signature HMAC.
 *   /api/payments/saspay/*       — un client sans compte doit pouvoir payer et
 *                                  suivre sa commande.
 *   /api/sms/send-otp            — appelée après commande par un client sans
 *                                  compte ; ne lit plus que le numéro de
 *                                  commande, tout le reste vient de la base.
 *   /api/orders/quote            — devis d'une commande (prix, livraison, remise),
 *                                  calculé par le serveur ; ne révèle aucune marge.
 *   /api/settings/public         — frais de livraison, points relais, retrait minimum.
 *   /api/orders/track            — suivi de commande par un client sans compte ;
 *                                  authentifiée par le contenu (numéro + téléphone)
 *                                  et protégée par une limitation de tentatives.
 *   /api/orders/sync             — sa CRÉATION est publique (commande invité) ;
 *                                  la route exige une session interne pour les
 *                                  mises à jour de statut, qui sont le vrai risque.
 */

const ROLE_BY_PREFIX: { prefix: string; role: string }[] = [
  { prefix: '/admin', role: 'admin' },
  { prefix: '/supplier', role: 'supplier' },
  { prefix: '/driver', role: 'driver' },
  { prefix: '/reseller', role: 'reseller' },
];

// Sous-pages publiques d'onboarding : accessibles à quiconque n'a PAS
// encore de compte (formulaire d'inscription avec vérification OTP réelle,
// voir /reseller/join/page.tsx). Sans cette liste, le garde-fou par rôle
// ci-dessous les bloquait entièrement — un lien de parrainage renvoyait
// systématiquement vers /login au lieu du formulaire d'adhésion.
const PUBLIC_SUBPATHS = ['/reseller/join'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_SUBPATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  // ── Barrière API ────────────────────────────────────────────────────────
  // Une route API répond 401 en JSON, jamais par une redirection : un appel
  // fetch qui reçoit une page de connexion en HTML échoue de façon obscure.
  const apiRole = API_ROLE_BY_PREFIX.find((r) => pathname.startsWith(r.prefix));
  if (apiRole) {
    if (!session) {
      return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
    }
    if (session.role !== apiRole.role) {
      return NextResponse.json(
        { error: `Cette action demande d'agir en tant que ${apiRole.role}.` },
        { status: 403 },
      );
    }
    // Volontairement AUCUN contrôle de statut ici. Sur les quinze routes à
    // rôle, une seule le vérifie (/api/payouts/create, qui garde le sien).
    // L'ajouter globalement bloquerait un compte en attente d'approbation sur
    // des lectures qui lui sont légitimes — /pending-approval a besoin de
    // savoir où il en est. Ce durcissement se décide route par route, pas ici.
    return NextResponse.next();
  }

  if (API_SESSION_REQUISE.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!session) {
      return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
    }
    return NextResponse.next();
  }

  const match = ROLE_BY_PREFIX.find(r => pathname.startsWith(r.prefix));
  if (match) {
    if (!session) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('denied', match.role);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Test d'APPARTENANCE, plus d'égalité stricte : un compte peut détenir
    // plusieurs rôles (voir supabase/migration-multi-role.sql). L'ancien
    // `session.role !== match.role` interdisait à un revendeur-livreur
    // d'ouvrir son second espace.
    const roles = rolesDeLaSession(session);
    const statutDuRole = roles[match.role as SugubaRole];

    if (!statutDuRole) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('denied', match.role);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (statutDuRole !== 'active' && pathname !== '/pending-approval') {
      return NextResponse.redirect(new URL('/pending-approval', req.url));
    }

    // Profil jamais complété : tant qu'aucun numéro n'est enregistré, la
    // session porte l'email à sa place (voir supabase-exchange). Sans cette
    // barrière, taper /reseller ou /supplier dans la barre d'adresse sautait
    // le formulaire d'inscription — un fournisseur se retrouvait sans fiche,
    // un livreur sans véhicule. L'admin n'y est pas soumis.
    if (match.role !== 'admin' && session.phone.includes('@')) {
      return NextResponse.redirect(new URL('/register/complete', req.url));
    }

    // Le rôle actif suit l'espace visité : entrer dans /driver fait agir en
    // livreur. Sans cette bascule, un revendeur-livreur resterait « revendeur »
    // aux yeux des routes API tout en naviguant dans l'espace livreur, et les
    // contrôles `session.role === 'driver'` refuseraient ses propres données.
    if (session.role !== match.role) {
      const res = NextResponse.next();
      const nouveauJeton = await createSessionToken({
        uid: session.uid,
        phone: session.phone,
        role: match.role as SugubaRole,
        status: statutDuRole,
        roles,
      });
      res.cookies.set(SESSION_COOKIE_NAME, nouveauJeton, SESSION_COOKIE_OPTIONS);
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/supplier/:path*',
    '/driver/:path*',
    '/reseller/:path*',
    // Toutes les routes API à rôle, plus celles qui exigent une session.
    '/api/admin/:path*',
    '/api/driver/:path*',
    '/api/supplier/:path*',
    '/api/reseller/:path*',
    '/api/payouts/:path*',
    '/api/auth/complete-profile',
    '/api/auth/me',
    '/api/auth/refresh-session',
    '/api/auth/request-role',
    // `/api/orders/feed` seulement, jamais `/api/orders/:path*` : la création
    // de commande (`/api/orders/sync`) doit rester ouverte aux clients sans compte.
    '/api/orders/feed',
    '/api/products/:path*',
  ],
};
