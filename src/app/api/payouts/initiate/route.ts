import { NextRequest, NextResponse } from 'next/server';
import { momoGateway } from '@/lib/momo-gateway';
import { sugubaStore } from '@/lib/store';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const PROVIDER_LABEL: Record<string, 'Orange Money' | 'Wave' | 'Moov Money'> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  moov: 'Moov Money',
  cash: 'Orange Money', // retrait agence : pas de virement Mobile Money réel à déclencher
};

export async function POST(req: NextRequest) {
  try {
    // Défense en profondeur : le middleware protège déjà cette route
    // (BUG-005), mais on revérifie ici au cas où le matcher du middleware
    // serait un jour mal configuré — un endpoint qui déclenche un virement
    // réel ne doit jamais dépendre d'une seule couche de protection.
    const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
    }

    const body = await req.json();
    const { withdrawalId } = body;

    const admin = getSupabaseAdmin();

    // Corrige la partie payouts de BUG-008 : les retraits créés via
    // /api/payouts/create vivent dans Supabase, pas dans le store local en
    // mémoire du serveur — c'est là qu'il faut chercher en priorité.
    if (admin) {
      const { data: withdrawal, error: fetchErr } = await admin.from('payouts').select('*').eq('id', withdrawalId).maybeSingle();

      if (fetchErr) {
        return NextResponse.json({ error: fetchErr.message }, { status: 500 });
      }
      if (withdrawal) {
        if (withdrawal.status !== 'pending') {
          return NextResponse.json({ error: 'Ce retrait a déjà été traité' }, { status: 400 });
        }

        const res = await momoGateway.createPayout({
          withdrawalId: withdrawal.id,
          withdrawalCode: withdrawal.id,
          amount: Number(withdrawal.amount),
          beneficiaryPhone: withdrawal.phone_number,
          beneficiaryName: withdrawal.reseller_name || 'Revendeur Suguba',
          provider: PROVIDER_LABEL[withdrawal.payment_method] || 'Orange Money',
        });

        if (res.success) {
          await admin.from('payouts').update({
            status: 'completed',
            transaction_ref: res.transactionId,
            processed_at: new Date().toISOString(),
          }).eq('id', withdrawal.id);
          // Les commissions réservées à la création du retrait (voir
          // /api/payouts/create) sont maintenant définitivement consommées.
          await admin.rpc('settle_commissions_for_withdrawal', { p_withdrawal_id: withdrawal.id });
          return NextResponse.json({ success: true, transactionId: res.transactionId, message: res.message });
        }

        await admin.from('payouts').update({ status: 'processing' }).eq('id', withdrawal.id);
        // ⚠️ Ce flux n'a pas de chemin de nouvelle tentative (le statut
        // n'étant plus 'pending', un second appel serait refusé plus haut) :
        // on libère donc les commissions réservées tout de suite pour ne pas
        // bloquer indéfiniment le solde du revendeur sur un virement qui a
        // échoué. À revoir si un vrai mécanisme de nouvelle tentative
        // asynchrone (webhook) est ajouté un jour pour ce cas d'échec.
        await admin.rpc('release_commissions_for_withdrawal', { p_withdrawal_id: withdrawal.id });
        return NextResponse.json({ success: false, error: res.message }, { status: 502 });
      }
      // Pas trouvé côté Supabase : repli sur le store local ci-dessous
      // (utile en développement, quand des retraits de démo n'existent que
      // dans les données de départ du navigateur).
    }

    const state = sugubaStore.getState();
    const withdrawal = state.withdrawals.find(w => w.id === withdrawalId);

    if (!withdrawal) {
      return NextResponse.json({ error: 'Demande de retrait introuvable' }, { status: 404 });
    }

    if (withdrawal.status !== 'pending') {
      return NextResponse.json({ error: 'Ce retrait a déjà été traité' }, { status: 400 });
    }

    const res = await momoGateway.createPayout({
      withdrawalId: withdrawal.id,
      withdrawalCode: withdrawal.withdrawalCode,
      amount: withdrawal.amount,
      beneficiaryPhone: withdrawal.payoutPhone,
      beneficiaryName: withdrawal.resellerName,
      provider: withdrawal.payoutProvider as any,
    });

    if (res.success) {
      sugubaStore.processWithdrawal(withdrawal.id, res.transactionId, 'Automate Passerelle API');
      return NextResponse.json({ success: true, transactionId: res.transactionId, message: res.message });
    } else {
      return NextResponse.json({ success: false, error: res.message }, { status: 502 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erreur interne' }, { status: 500 });
  }
}
