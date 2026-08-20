import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Promeut un profil existant (identifié par téléphone) au rôle admin,
 * actif immédiatement. Réservé aux sessions admin déjà authentifiées — le
 * tout premier admin ne peut PAS passer par cette route (poule et œuf par
 * construction) : il se crée uniquement via `scripts/create-admin.ts`, en
 * ligne de commande, avec la clé service_role. Voir ce script pour la
 * procédure de bootstrap.
 */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase non configuré sur cet environnement.' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const rawPhone = String(body.phone || '');
    if (!rawPhone) {
      return NextResponse.json({ error: 'Numéro de téléphone requis.' }, { status: 400 });
    }
    const cleaned = rawPhone.replace(/[^\d+]/g, '');
    const phone = cleaned.startsWith('+') ? cleaned : cleaned.startsWith('223') ? '+' + cleaned : '+223' + cleaned;

    const { data: existing } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle();

    if (existing) {
      const { error } = await admin.from('profiles').update({ role: 'admin', status: 'active' }).eq('id', existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await admin.from('profiles').insert({
        id: crypto.randomUUID(),
        phone,
        full_name: 'Suguba Ops Master',
        role: 'admin',
        status: 'active',
        city: 'Bamako',
        balance: 0,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, phone });
  } catch (error: any) {
    console.error('[API promote ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
