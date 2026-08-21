import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, SugubaSession, ProfileStatus } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerRoles, choisirRoleActif } from '@/lib/profile-roles';

// Même règle que pour le téléphone (voir /api/auth/verify-otp) : aucun rôle
// ne peut s'auto-attribuer admin à la création, quel que soit le chemin de
// connexion.
const SELF_SERVE_ROLES: SugubaSession['role'][] = ['reseller', 'supplier', 'driver', 'diaspora', 'customer'];

/**
 * Point d'entrée unique pour les connexions email et Google : le client a
 * déjà fini l'échange avec Supabase Auth (code OTP email vérifié, ou retour
 * OAuth Google) et détient un vrai jeton d'accès Supabase. Cette route le
 * vérifie côté serveur (jamais fait confiance à ce que le client prétend),
 * relie ce compte Supabase Auth à un profil applicatif (créé si absent), et
 * émet la même session signée que le flux téléphone — tout le reste de
 * l'app (middleware, /api/admin/review-profile, etc.) continue de
 * fonctionner sans distinguer le mode de connexion.
 */
export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase non configuré sur cet environnement.' }, { status: 503 });
  }

  try {
    const authHeader = req.headers.get('authorization') || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!accessToken) {
      return NextResponse.json({ error: 'Jeton Supabase manquant.' }, { status: 401 });
    }

    const { data: authUser, error: authErr } = await admin.auth.getUser(accessToken);
    if (authErr || !authUser?.user?.email) {
      return NextResponse.json({ error: 'Jeton Supabase invalide.' }, { status: 401 });
    }

    const email = authUser.user.email.toLowerCase();
    const authUserId = authUser.user.id;

    const body = await req.json().catch(() => ({}));
    const requestedRole = SELF_SERVE_ROLES.includes(body.intendedRole) ? body.intendedRole : 'reseller';

    // Cherche d'abord par auth_user_id (ancre stable), puis par email (cas
    // d'un compte créé autrement mais avec le même email).
    let { data: profile } = await admin.from('profiles').select('*').eq('auth_user_id', authUserId).maybeSingle();
    if (!profile) {
      const { data: byEmail } = await admin.from('profiles').select('*').eq('email', email).maybeSingle();
      profile = byEmail || null;
    }

    let uid: string;
    let role: SugubaSession['role'];
    let status: ProfileStatus;
    let fullName: string;

    if (profile) {
      uid = profile.id;
      role = profile.role;
      status = profile.status;
      fullName = profile.full_name;
      if (!profile.auth_user_id) {
        await admin.from('profiles').update({ auth_user_id: authUserId }).eq('id', profile.id);
      }
    } else {
      uid = crypto.randomUUID();
      role = requestedRole;
      status = requestedRole === 'customer' ? 'active' : 'pending_approval';
      fullName = authUser.user.user_metadata?.full_name || authUser.user.user_metadata?.name || email.split('@')[0];
      const resellerCode = role === 'reseller' ? `SG-${uid.replace(/-/g, '').slice(0, 6).toUpperCase()}` : null;

      const { error: insertErr } = await admin.from('profiles').insert({
        id: uid,
        email,
        auth_user_id: authUserId,
        full_name: fullName,
        role,
        status,
        city: 'Bamako',
        balance: 0,
        reseller_code: resellerCode,
      });
      if (insertErr) {
        console.error('[AUTH] Échec création profil (Supabase Auth):', insertErr);
        return NextResponse.json({ error: 'Erreur lors de la création du compte.' }, { status: 500 });
      }

      // Voir /api/auth/verify-otp : profile_roles est la source de vérité des
      // rôles, un compte créé sans ligne ici serait bloqué par le middleware.
      const { error: roleErr } = await admin.from('profile_roles').insert({
        profile_id: uid,
        role,
        status,
        approved_at: status === 'active' ? new Date().toISOString() : null,
      });
      if (roleErr) console.warn('[AUTH] profile_roles non renseigné:', roleErr.message);
    }

    const carteRoles = await chargerRoles(uid, role, status);
    const actif = choisirRoleActif(carteRoles, role);

    const token = await createSessionToken({
      uid,
      phone: profile?.phone || email,
      role: actif.role,
      status: actif.status,
      roles: carteRoles,
    });
    // hasPhone permet au client (voir /auth/callback) de distinguer un
    // profil Google fraîchement créé (jamais de numéro ni de quartier —
    // Google ne connaît ni l'un ni l'autre) d'un profil déjà complet, pour
    // savoir s'il faut router vers /register/complete avant /pending-approval.
    const res = NextResponse.json({
      success: true, uid, fullName,
      role: actif.role,
      status: actif.status,
      roles: carteRoles,
      hasPhone: Boolean(profile?.phone),
    });
    res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (error: any) {
    console.error('[API supabase-exchange ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
