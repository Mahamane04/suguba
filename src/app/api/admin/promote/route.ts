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

    let profileId: string;
    if (existing) {
      profileId = existing.id;
      const { error } = await admin.from('profiles').update({ role: 'admin', status: 'active' }).eq('id', existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      profileId = crypto.randomUUID();
      const { error } = await admin.from('profiles').insert({
        id: profileId,
        phone,
        full_name: 'Suguba Ops Master',
        role: 'admin',
        status: 'active',
        city: 'Bamako',
        balance: 0,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // La ligne dans profile_roles n'est pas cosmétique : cette route n'écrivait
    // que `profiles.role`, laissant les deux sources de vérité diverger. Le
    // repli de chargerRoles() couvrait le cas tant que profile_roles restait
    // vide pour ce compte — mais dès qu'une autre ligne y apparaissait (une
    // demande de rôle revendeur, par exemple), la carte se reconstruisait sans
    // le rôle admin et l'administrateur perdait ses droits en silence.
    const { error: roleErr } = await admin
      .from('profile_roles')
      .upsert(
        {
          profile_id: profileId,
          role: 'admin',
          status: 'active',
          approved_at: new Date().toISOString(),
          approved_by: session.uid,
        },
        { onConflict: 'profile_id,role' },
      );
    if (roleErr) {
      console.warn('[PROMOTE] profile_roles non renseigné:', roleErr.message);
    }

    return NextResponse.json({ success: true, phone });
  } catch (error: any) {
    console.error('[API promote ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
