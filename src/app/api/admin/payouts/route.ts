import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
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
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  return session && session.role === 'admin' ? session : null;
}

export async function GET(req: NextRequest) {
  if (!(await sessionAdmin(req))) {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ retraits: [] });

  const { data, error } = await admin
    .from('payouts')
    .select('id, reseller_name, amount, payment_method, phone_number, status, created_at')
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    retraits: (data || []).map((r) => ({
      id: r.id,
      revendeur: r.reseller_name || 'Revendeur',
      montant: Number(r.amount) || 0,
      moyen: r.payment_method,
      telephone: r.phone_number,
      statut: r.status,
      creeLe: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
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

  if (action === 'payer_especes') {
    if (retrait.payment_method !== 'cash') {
      return NextResponse.json({ error: 'Ce retrait se paie par virement mobile money, pas au guichet.' }, { status: 422 });
    }
    // Conditionné à `pending` : deux clics simultanés ne consomment pas deux fois.
    const { data: maj, error } = await admin
      .from('payouts')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        transaction_ref: `GUICHET ${new Date().toISOString().slice(0, 10)} (${session.phone})`,
      })
      .eq('id', retrait.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!maj) return NextResponse.json({ error: 'Ce retrait vient d\'être traité ailleurs.' }, { status: 409 });

    await admin.rpc('settle_commissions_for_withdrawal', { p_withdrawal_id: retrait.id });
    return NextResponse.json({ success: true });
  }

  const { data: maj, error } = await admin
    .from('payouts')
    .update({ status: 'rejected', processed_at: new Date().toISOString() })
    .eq('id', retrait.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!maj) return NextResponse.json({ error: 'Ce retrait vient d\'être traité ailleurs.' }, { status: 409 });

  // Le revendeur retrouve son solde.
  await admin.rpc('release_commissions_for_withdrawal', { p_withdrawal_id: retrait.id });
  return NextResponse.json({ success: true });
}
