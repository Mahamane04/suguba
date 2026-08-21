import { NextRequest, NextResponse } from 'next/server';
import {
  verifySessionToken,
  createSessionToken,
  rolesDeLaSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  type SugubaRole,
} from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerRoles } from '@/lib/profile-roles';

/**
 * Demande d'un rôle supplémentaire sur un compte existant.
 *
 * C'est ce qui rend le multi-rôle utilisable : un revendeur qui possède une
 * moto demande le rôle livreur sans créer de second compte, un fournisseur
 * achète pour lui-même, etc. Le rôle naît en `pending_approval` et attend la
 * validation d'un admin, exactement comme une inscription.
 *
 * `admin` est volontairement absent des rôles demandables : il ne s'attribue
 * qu'en base par un opérateur de confiance (voir scripts/create-admin.js).
 */
const ROLES_DEMANDABLES: SugubaRole[] = ['reseller', 'supplier', 'driver', 'diaspora'];

export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Connectez-vous pour ajouter un rôle.' }, { status: 401 });
  }

  try {
    const { role } = await req.json().catch(() => ({}));
    if (!ROLES_DEMANDABLES.includes(role)) {
      return NextResponse.json({ error: 'Rôle non disponible à la demande.' }, { status: 400 });
    }

    const dejaDetenus = rolesDeLaSession(session);
    if (dejaDetenus[role as SugubaRole]) {
      return NextResponse.json(
        { error: 'Vous avez déjà ce rôle.', statut: dejaDetenus[role as SugubaRole] },
        { status: 409 }
      );
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
    }

    const { error } = await admin.from('profile_roles').insert({
      profile_id: session.uid,
      role,
      status: 'pending_approval',
    });
    if (error) {
      console.error('[ROLES] Ajout impossible:', error);
      return NextResponse.json({ error: 'Impossible d\'ajouter ce rôle.' }, { status: 500 });
    }

    // La session doit refléter le nouveau rôle immédiatement, sinon
    // l'utilisateur devrait se déconnecter pour le voir apparaître. Le rôle
    // ACTIF ne change pas : le nouveau rôle n'est pas encore validé, et
    // basculer dessus mènerait droit sur /pending-approval.
    const carte = await chargerRoles(session.uid, session.role, session.status);
    const token = await createSessionToken({
      uid: session.uid,
      phone: session.phone,
      role: session.role,
      status: session.status,
      roles: carte,
    });

    const res = NextResponse.json({ success: true, role, statut: 'pending_approval', roles: carte });
    res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (error: any) {
    console.error('[API request-role ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
