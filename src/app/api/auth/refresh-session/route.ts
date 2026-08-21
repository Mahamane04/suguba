import { NextRequest, NextResponse } from 'next/server';
import {
  verifySessionToken,
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerRoles, choisirRoleActif } from '@/lib/profile-roles';

/**
 * Recharge les rôles et statuts depuis la base, et réémet le cookie.
 *
 * Corrige un défaut qui rendait la validation des inscriptions inopérante :
 * le middleware lit le statut dans le cookie signé, or ce cookie est émis à
 * la connexion et vit 7 jours. Un admin pouvait donc valider un fournisseur
 * sans que rien ne change pour lui — il restait renvoyé sur /pending-approval
 * pendant une semaine, jusqu'à ce qu'il pense de lui-même à se déconnecter
 * puis se reconnecter. Constaté sur une vraie inscription.
 *
 * Volontairement une route dédiée plutôt qu'une lecture en base dans le
 * middleware : celui-ci s'exécute sur CHAQUE requête, y compris les fichiers
 * statiques. Y ajouter un appel Supabase alourdirait tout le site pour un
 * changement qui survient une fois dans la vie d'un compte.
 */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    // Sans base, rien à rafraîchir : on renvoie l'état courant plutôt qu'une
    // erreur, la page d'attente doit continuer de fonctionner.
    return NextResponse.json({
      authenticated: true,
      role: session.role,
      status: session.status,
      changed: false,
    });
  }

  // Le statut du COMPTE prime : un compte suspendu l'est quels que soient ses
  // rôles (voir supabase/migration-multi-role.sql).
  const { data: profil } = await admin
    .from('profiles')
    .select('role, status')
    .eq('id', session.uid)
    .maybeSingle();

  if (!profil) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  if (profil.status === 'suspended' || profil.status === 'rejected') {
    const res = NextResponse.json({ authenticated: false, reason: profil.status }, { status: 403 });
    res.cookies.set(SESSION_COOKIE_NAME, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
    return res;
  }

  const carte = await chargerRoles(session.uid, profil.role, profil.status);
  // On conserve le rôle actif courant s'il est toujours utilisable, pour ne
  // pas déplacer l'utilisateur d'un espace à l'autre sans qu'il l'ait demandé.
  const actif = carte[session.role] === 'active'
    ? { role: session.role, status: 'active' as const }
    : choisirRoleActif(carte, profil.role);

  const token = await createSessionToken({
    uid: session.uid,
    phone: session.phone,
    role: actif.role,
    status: actif.status,
    roles: carte,
  });

  const res = NextResponse.json({
    authenticated: true,
    role: actif.role,
    status: actif.status,
    roles: carte,
    changed: actif.status !== session.status || actif.role !== session.role,
  });
  res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
  return res;
}
