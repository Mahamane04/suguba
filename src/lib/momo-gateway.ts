/**
 * Passerelle d'Intégration Mobile Money Unifiée — Suguba SaaS
 * Supporte : Wave Mali, Orange Money (via CinetPay / Hub2 / Paydunya), Moov Money
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface PaymentRequest {
  orderId: string;
  orderNumber: string;
  amount: number;
  customerPhone: string;
  customerName: string;
  provider: 'Orange Money' | 'Wave' | 'Moov Money' | 'Auto';
  returnUrl?: string;
  notifyUrl?: string;
}

export interface PayoutRequest {
  withdrawalId: string;
  withdrawalCode: string;
  amount: number;
  beneficiaryPhone: string;
  beneficiaryName: string;
  provider: 'Orange Money' | 'Wave' | 'Moov Money';
}

export interface GatewayResponse {
  success: boolean;
  transactionId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  paymentUrl?: string;
  message: string;
  rawResponse?: any;
}

export const momoGateway = {
  /**
   * 1. Initier un encaissement client par Mobile Money
   */
  async createPayment(req: PaymentRequest): Promise<GatewayResponse> {
    const apiKey = process.env.CINETPAY_API_KEY || process.env.WAVE_API_KEY;
    const isSandbox = !apiKey;

    if (isSandbox) {
      // Mode simulation sécurisé pour le développement
      console.log(`[SANDBOX MOMO] Initiation paiement de ${req.amount} FCFA pour ${req.customerName} (${req.customerPhone}) via ${req.provider}`);
      return {
        success: true,
        transactionId: `TX-MOMO-${Date.now()}`,
        status: 'SUCCESS',
        paymentUrl: `https://checkout.sugubaml.com/pay/sim?id=${req.orderNumber}`,
        message: 'Transaction initiée avec succès (Mode Test)',
      };
    }

    try {
      // Implémentation de l'appel réel vers la passerelle CinetPay / Wave
      const response = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apikey: process.env.CINETPAY_API_KEY,
          site_id: process.env.CINETPAY_SITE_ID,
          transaction_id: `SG-${req.orderNumber}-${Date.now()}`,
          amount: req.amount,
          currency: 'XOF',
          description: `Paiement Commande Suguba #${req.orderNumber}`,
          customer_name: req.customerName,
          customer_phone_number: req.customerPhone,
          notify_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://sugubaml.com'}/api/webhooks/momo`,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://sugubaml.com'}/order-success/${req.orderNumber}`,
        }),
      });

      const data = await response.json();

      return {
        success: data.code === '201',
        transactionId: data.data?.payment_token || `TX-${Date.now()}`,
        status: data.code === '201' ? 'PENDING' : 'FAILED',
        paymentUrl: data.data?.payment_url,
        message: data.message || 'Paiement initié',
        rawResponse: data,
      };
    } catch (error: any) {
      console.error('[GATEWAY ERROR] Échec initiation paiement:', error);
      return {
        success: false,
        transactionId: '',
        status: 'FAILED',
        message: error.message || 'Erreur passerelle de paiement',
      };
    }
  },

  /**
   * 2. Initier un virement de commission vers le Mobile Money du revendeur
   */
  async createPayout(req: PayoutRequest): Promise<GatewayResponse> {
    const apiKey = process.env.CINETPAY_DISBURSEMENT_KEY || process.env.WAVE_PAYOUT_KEY;
    const isSandbox = !apiKey;

    if (isSandbox) {
      console.log(`[SANDBOX MOMO PAYOUT] Virement de ${req.amount} FCFA vers ${req.provider} (${req.beneficiaryPhone}) pour ${req.beneficiaryName}`);
      return {
        success: true,
        transactionId: `PAYOUT-CI-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'SUCCESS',
        message: 'Virement Mobile Money exécuté avec succès (Mode Test)',
      };
    }

    try {
      // Appel réel vers l'API de décaissement (Disbursement)
      const response = await fetch('https://api-checkout.cinetpay.com/v2/disbursement/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          amount: req.amount,
          currency: 'XOF',
          recipient_phone: req.beneficiaryPhone,
          recipient_name: req.beneficiaryName,
          client_transaction_id: req.withdrawalCode,
          provider: req.provider.toLowerCase().replace(/\s+/g, '_'),
        }),
      });

      const data = await response.json();

      return {
        success: data.status === 'SUCCESS',
        transactionId: data.transaction_id || `PAYOUT-${Date.now()}`,
        status: data.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
        message: data.message || 'Virement en cours de traitement',
        rawResponse: data,
      };
    } catch (error: any) {
      console.error('[GATEWAY ERROR] Échec virement Mobile Money:', error);
      return {
        success: false,
        transactionId: '',
        status: 'FAILED',
        message: error.message || 'Erreur virement passerelle',
      };
    }
  },

  /**
   * 3. Vérification de la signature HMAC du Webhook
   *
   * Corrige BUG-004 : l'ancienne implémentation ne calculait aucun HMAC et
   * acceptait toute signature non vide (et TOUT en l'absence de clé). Elle
   * "vérifiait" en réalité rien, ce qui permettait de falsifier des
   * confirmations de paiement/retrait avec une simple requête HTTP.
   *
   * Cette version calcule un HMAC-SHA256 réel sur le corps brut de la
   * requête et compare en temps constant. Sans clé secrète configurée, elle
   * REFUSE désormais systématiquement (fail closed) au lieu d'accepter.
   *
   * ⚠️ L'algorithme exact (quel champ est signé, quel encodage) diffère
   * selon la passerelle réelle (CinetPay/Wave/Hub2) — à ajuster précisément
   * sur la documentation du fournisseur une fois les clés de production
   * obtenues. Cette implémentation pose le bon principe (fail closed +
   * comparaison en temps constant) ; l'algorithme précis reste à confirmer.
   */
  verifyWebhookSignature(payload: string, signature: string, secretKey: string): boolean {
    if (!secretKey) {
      console.error('[GATEWAY SECURITY] Webhook reçu sans secret configuré — rejeté par défaut.');
      return false;
    }
    if (!signature) return false;

    try {
      const expected = createHmac('sha256', secretKey).update(payload).digest('hex');
      const expectedBuf = Buffer.from(expected, 'utf8');
      const signatureBuf = Buffer.from(signature, 'utf8');
      if (expectedBuf.length !== signatureBuf.length) return false;
      return timingSafeEqual(expectedBuf, signatureBuf);
    } catch (err) {
      console.error('[GATEWAY SECURITY] Erreur de vérification de signature:', err);
      return false;
    }
  }
};
