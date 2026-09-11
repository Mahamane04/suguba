import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, rolesDeLaSession, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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
  // Nom, ville et email réels (2026-09-11) : sans eux, les écrans affichaient
  // le compte de démonstration « Moussa Coulibaly » de la mémoire locale
  // (voir sugubaStore.definirUtilisateur). Uniquement le profil du demandeur.
  let profil: { full_name?: string | null; city?: string | null; email?: string | null } | null = null;
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data } = await admin
      .from('profiles')
      .select('full_name, city, email')
      .eq('id', session.uid)
      .maybeSingle();
    profil = data;
  }

  return NextResponse.json({
    authenticated: true,
    uid: session.uid,
    fullName: profil?.full_name || '',
    city: profil?.city || '',
    email: profil?.email || '',
    role: session.role,
    phone: session.phone,
    status: session.status,
    roles: rolesDeLaSession(session),
  });
}
