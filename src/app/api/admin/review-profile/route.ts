import { avecJournal } from '@/lib/admin/journal-route';
import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Approuve ou rejette un dossier d'inscription (revendeur/fournisseur/
 * livreur/diaspora) — réservé aux sessions admin. Le compte concerné ne
 * devient exploitable qu'après ce passage, jamais automatiquement.
 */
export async function POST(req: NextRequest) {
  return avecJournal(req, 'POST /api/admin/review-profile', () => postInterne(req));
}

async function postInterne(req: NextRequest) {
  const refusEquipe = await refusSansPermissionAdmin(req, 'POST /api/admin/review-profile');
  if (refusEquipe) return refusEquipe;
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
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

    // Audit du 2026-10-01 : un responsable revendeurs pouvait verrouiller ou
    // rouvrir n'importe quel compte, y compris un super admin, et réactiver
    // un rôle admin retiré. Les comptes de l'équipe se gèrent dans Équipe.
    const ROLES_EXAMINABLES = ['reseller', 'supplier', 'driver', 'diaspora', 'customer'];
    if (role && !ROLES_EXAMINABLES.includes(role)) {
      return NextResponse.json({ error: 'Ce rôle ne s’examine pas ici.' }, { status: 400 });
    }
    const [{ data: cible }, { data: membre }] = await Promise.all([
      admin.from('profiles').select('role').eq('id', profileId).maybeSingle(),
      admin.from('admin_team_members').select('profile_id').eq('profile_id', profileId).maybeSingle(),
    ]);
    if (!cible) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
    if (cible.role === 'admin' || membre) {
      return NextResponse.json({ error: 'Les comptes de l’équipe se gèrent dans Équipe.' }, { status: 403 });
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
