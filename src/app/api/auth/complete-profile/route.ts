import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/session';
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
    const { fullName, city, phone, metadata } = body as {
      fullName?: string;
      city?: string;
      phone?: string;
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
    // Un compte créé via Google n'a jamais de numéro (Google ne le
    // connaît pas) — voir /register/complete, l'étape qui le recueille
    // juste après l'inscription. Non vérifié par OTP à ce stade : c'est
    // l'examen manuel par un admin (status pending_approval) qui filtre un
    // numéro fantaisiste, pas cette route.
    if (phone) update.phone = phone;
    if (metadata && typeof metadata === 'object') update.metadata = metadata;

    const { error } = await admin.from('profiles').update(update).eq('id', session.uid);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Réémet la session avec le vrai numéro (jusqu'ici, un profil Google
    // portait l'email en guise de "phone" dans le jeton — voir
    // supabase-exchange) : le Header et le reste de l'app doivent
    // désormais afficher/utiliser le numéro réel.
    const res = NextResponse.json({ success: true, cloud: true });
    if (phone) {
      const token = await createSessionToken({ uid: session.uid, phone, role: session.role, status: session.status });
      res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    }
    return res;
  } catch (error: any) {
    console.error('[API complete-profile ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
