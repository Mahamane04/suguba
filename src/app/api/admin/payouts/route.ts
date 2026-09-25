import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Retraits des revendeurs, côté admin (2026-09-11).
 *
 * Le tableau de bord lisait les retraits dans la mémoire LOCALE du
 * navigateur (state.withdrawals) : une demande faite par un revendeur depuis
 * son téléphone n'apparaissait jamais chez l'admin. Et « Valider le
 * virement » / « Guichet » ne changeaient que cette mémoire locale — la mise
 * à jour serveur est désactivée côté client depuis BUG-006.
 *
 *   GET  → retraits en attente ou en cours (table `payouts`)
 *   POST { id, action: 'payer_especes' } → retrait au guichet remis en main
 *        propre : `completed` + commissions consommées, comme le fait le
 *        webhook SasPay pour un virement (settle_commissions_for_withdrawal).
 *   POST { id, action: 'rejeter' } → `rejected` + commissions rendues au
 *        revendeur (release_commissions_for_withdrawal).
 *
 * Un virement mobile money, lui, part par /api/payouts/initiate (SasPay).
 */

async function sessionAdmin(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  return session && session.role === 'admin' ? session : null;
}

export async function GET(req: NextRequest) {
  const refusEquipe = await refusSansPermissionAdmin(req, 'GET /api/admin/payouts');
  if (refusEquipe) return refusEquipe;
  if (!(await sessionAdmin(req))) {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ retraits: [] });

  const { data, error } = await admin
    .from('payouts')
    .select('*')
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    retraits: (data || []).map((r) => ({
      id: r.id,
      revendeur: r.reseller_name || 'Revendeur',
      montant: Number(r.amount) || 0,
      montantDemande: r.montant_demande != null ? Number(r.montant_demande) : null,
      frais: r.frais_retrait != null ? Number(r.frais_retrait) : null,
      moyen: r.payment_method,
      telephone: r.phone_number,
      statut: r.status,
      creeLe: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const refusEquipe = await refusSansPermissionAdmin(req, 'POST /api/admin/payouts');
  if (refusEquipe) return refusEquipe;
  const session = await sessionAdmin(req);
  if (!session) {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const { id, action } = await req.json().catch(() => ({}));
  if (!id || (action !== 'payer_especes' && action !== 'rejeter')) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const { data: retrait } = await admin
    .from('payouts')
    .select('id, payment_method, status')
    .eq('id', String(id).trim().toUpperCase())
    .maybeSingle();

  if (!retrait) return NextResponse.json({ error: 'Aucun retrait avec ce code.' }, { status: 404 });
  if (retrait.status !== 'pending') {
    return NextResponse.json({ error: 'Ce retrait a déjà été traité.' }, { status: 400 });
  }

  if (action === 'payer_especes' && retrait.payment_method !== 'cash') {
    return NextResponse.json({ error: 'Ce retrait se règle par Mobile Money.' }, { status: 422 });
  }
  const { data, error } = await admin.rpc('finalize_payout_atomic', {
    p_expected_status: 'pending', p_id: retrait.id, p_status: action === 'payer_especes' ? 'completed' : 'rejected',
    p_reference: action === 'payer_especes' ? `GUICHET ${session.uid}` : null,
  });
  if (error || !data) return NextResponse.json({ error: 'Retrait non validé. Vérifiez le grand-livre avant de réessayer.' }, { status: 503 });
  return NextResponse.json({ success: true });
}
