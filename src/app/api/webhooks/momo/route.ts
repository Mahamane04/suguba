import { NextRequest, NextResponse } from 'next/server';
import { momoGateway } from '@/lib/momo-gateway';
import { sugubaStore } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-token') || req.headers.get('x-signature') || '';

    const secretKey = process.env.CINETPAY_SECRET_KEY || process.env.WAVE_WEBHOOK_SECRET || '';

    const isValid = momoGateway.verifyWebhookSignature(rawBody, signature, secretKey);
    if (!isValid) {
      return NextResponse.json({ error: 'Signature Webhook Invalide' }, { status: 401 });
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      // Si format x-www-form-urlencoded
      payload = Object.fromEntries(new URLSearchParams(rawBody));
    }

    const { cpm_trans_id, cpm_result, cpm_trans_status, transaction_id, status } = payload;

    const isSuccess = cpm_result === '00' || cpm_trans_status === 'ACCEPTED' || status === 'SUCCESS';
    const txId = cpm_trans_id || transaction_id;

    console.log(`[WEBHOOK MOMO REÇU] Transaction: ${txId} • Statut: ${isSuccess ? 'SUCCÈS' : 'ÉCHEC'}`);

    // Si la transaction concerne un retrait revendeur
    if (txId && txId.startsWith('WTH-')) {
      const state = sugubaStore.getState();
      const withdrawal = state.withdrawals.find(w => w.withdrawalCode === txId);
      if (withdrawal && isSuccess) {
        sugubaStore.processWithdrawal(withdrawal.id, `MOMO-AUTO-${Date.now()}`, 'Webhook Mobile Money Automatique');
      }
    }

    return NextResponse.json({ 
      status: 'OK', 
      message: 'Notification traitée avec succès',
      receivedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[WEBHOOK ERROR] Erreur lors du traitement du Webhook:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
