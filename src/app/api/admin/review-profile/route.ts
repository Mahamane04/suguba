import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Approuve ou rejette un dossier d'inscription (revendeur/fournisseur/
 * livreur/diaspora) — réservé aux sessions admin. Le compte concerné ne
 * devient exploitable qu'après ce passage, jamais automatiquement.
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
    const { profileId, decision, role } = body as {
      profileId?: string;
      decision?: 'approve' | 'reject';
      role?: string;
    };

    if (!profileId || !['approve', 'reject'].includes(decision || '')) {
      return NextResponse.json({ error: 'profileId et decision (approve|reject) requis.' }, { status: 400 });
    }

    const nextStatus = decision === 'approve' ? 'active' : 'rejected';

    // Validation PAR RÔLE : c'est tout l'intérêt du multi-rôle. Sans le
    // paramètre `role`, valider la candidature « livreur » de quelqu'un
    // écraserait le statut de son activité de revendeur déjà en cours.
    if (role) {
      const { error: roleErr } = await admin
        .from('profile_roles')
        .update({
          status: nextStatus,
          approved_at: decision === 'approve' ? new Date().toISOString() : null,
          approved_by: session.uid,
        })
        .eq('profile_id', profileId)
        .eq('role', role);

      if (roleErr) {
        return NextResponse.json({ error: roleErr.message }, { status: 500 });
      }

      // Un compte encore globalement « en attente » doit s'ouvrir dès qu'un
      // de ses rôles est validé, sinon le middleware le renverrait toujours
      // sur /pending-approval malgré un rôle utilisable.
      if (decision === 'approve') {
        await admin
          .from('profiles')
          .update({ status: 'active' })
          .eq('id', profileId)
          .eq('status', 'pending_approval');
      }

      return NextResponse.json({ success: true, status: nextStatus, role });
    }

    // Sans `role` : décision au niveau du COMPTE (suspension, réactivation).
    const { error } = await admin.from('profiles').update({ status: nextStatus }).eq('id', profileId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: nextStatus });
  } catch (error: any) {
    console.error('[API review-profile ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
