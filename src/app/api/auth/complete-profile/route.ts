import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Deuxième étape de l'inscription — remplit les champs propres au rôle
 * (entreprise, véhicule, bénéficiaire diaspora...) sur un profil déjà
 * authentifié par OTP (voir /api/auth/verify-otp). N'accepte jamais de
 * modifier le rôle ou le statut depuis le client : l'un vient de la session
 * signée, l'autre reste piloté par /api/admin/review-profile.
 */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Session invalide ou expirée. Reconnectez-vous.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { fullName, city, metadata } = body as {
      fullName?: string;
      city?: string;
      metadata?: Record<string, unknown>;
    };

    const admin = getSupabaseAdmin();
    if (!admin) {
      // Mode local sans Supabase : rien à persister côté serveur, le
      // formulaire retombe sur sugubaStore côté client (voir register/page.tsx).
      return NextResponse.json({ success: true, cloud: false });
    }

    const update: Record<string, unknown> = {};
    if (fullName) update.full_name = fullName;
    if (city) update.city = city;
    if (metadata && typeof metadata === 'object') update.metadata = metadata;

    const { error } = await admin.from('profiles').update(update).eq('id', session.uid);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, cloud: true });
  } catch (error: any) {
    console.error('[API complete-profile ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
