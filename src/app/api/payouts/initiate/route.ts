import { NextRequest, NextResponse } from 'next/server';
import { momoGateway } from '@/lib/momo-gateway';
import { sugubaStore } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { withdrawalId } = body;

    const state = sugubaStore.getState();
    const withdrawal = state.withdrawals.find(w => w.id === withdrawalId);

    if (!withdrawal) {
      return NextResponse.json({ error: 'Demande de retrait introuvable' }, { status: 404 });
    }

    if (withdrawal.status !== 'pending') {
      return NextResponse.json({ error: 'Ce retrait a déjà été traité' }, { status: 400 });
    }

    // Exécution du virement via la passerelle
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
