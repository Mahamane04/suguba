import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Vérification d'un livreur au guichet Suguba de Bamako.
 *
 * Un agent a vu la personne, sa moto et ses papiers. Il lève ici le verrou du
 * dispatch — `drivers.active_status` — et consigne ce qu'il a constaté.
 *
 * Ce que cette route N'EST PAS : une approbation de compte. Le compte du
 * livreur fonctionne depuis son inscription ; il peut se connecter et voir son
 * espace. Ce qui se décide ici, c'est uniquement le droit de recevoir des
 * courses, donc de prendre en charge des colis et de l'argent.
 *
 * La note est obligatoire à la vérification : « vu au guichet » sans rien
 * d'autre ne vaut pas mieux que l'ancienne approbation en un clic sur des
 * données déclaratives. Écrire ce qu'on a constaté — pièce présentée, état de
 * la moto, réserves — est ce qui distingue un contrôle d'un tampon.
 */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  }

  try {
    const { profileId, verifie, note } = await req.json().catch(() => ({}));
    if (!profileId || typeof verifie !== 'boolean') {
      return NextResponse.json({ error: 'profileId et verifie (booléen) requis.' }, { status: 400 });
    }

    const constat = String(note || '').trim();
    if (verifie && constat.length < 10) {
      return NextResponse.json(
        { error: 'Décrivez ce que vous avez constaté au guichet (pièce présentée, moto, réserves).' },
        { status: 400 },
      );
    }

    const { data: fiche } = await admin
      .from('drivers')
      .select('profile_id')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (!fiche) {
      // Sans fiche livreur, il manque le véhicule, la zone et la plaque : le
      // candidat n'a pas terminé son inscription, il n'y a rien à vérifier.
      return NextResponse.json(
        { error: 'Ce livreur n\'a pas complété son dossier (/register/complete).' },
        { status: 404 },
      );
    }

    const { error } = await admin
      .from('drivers')
      .update({
        active_status: verifie,
        verified_at: verifie ? new Date().toISOString() : null,
        verified_by: verifie ? session.uid : null,
        verified_note: verifie ? constat : constat || null,
      })
      .eq('profile_id', profileId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      verifie,
      message: verifie
        ? 'Livreur vérifié au guichet. Il peut désormais recevoir des courses.'
        : 'Vérification retirée. Ce livreur ne recevra plus de nouvelle course.',
    });
  } catch (error: any) {
    console.error('[ADMIN] Vérification livreur:', error);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
