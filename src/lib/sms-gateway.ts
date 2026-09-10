/**
 * Passerelle d'Envoi SMS OTP — Suguba SaaS Mali
 * Envoie le Code Secret OTP et les notifications de commande par SMS aux clients et livreurs.
 */

export interface SmsPayload {
  toPhone: string;          // Numéro de téléphone malien (ex: 70000000 ou +22370000000)
  orderNumber: string;      // Ex: SG-10492
  productName: string;      // Ex: Kit Solaire Domestique
  deliveryOtp: string;      // Ex: 5832
  totalAmount: number;      // Ex: 40000
}

export interface SmsResponse {
  success: boolean;
  messageId?: string;
  provider: 'ORANGE_MALI' | 'TWILIO' | 'TERMII' | 'SANDBOX';
  message: string;
}

export const smsGateway = {
  /**
   * Formate le numéro au standard international Mali (+223)
   */
  formatMaliPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('223')) {
      return `+${cleaned}`;
    }
    if (cleaned.length === 8) {
      return `+223${cleaned}`;
    }
    return phone.startsWith('+') ? phone : `+${phone}`;
  },

  /**
   * Envoi du Code Secret OTP par SMS au client
   */
  async sendDeliveryOtpSms(payload: SmsPayload): Promise<SmsResponse> {
    const formattedPhone = this.formatMaliPhone(payload.toPhone);
    const smsText = `Suguba: Votre commande #${payload.orderNumber} (${payload.productName}) est enregistree. Montant a payer: ${payload.totalAmount.toLocaleString('fr-FR')} FCFA. Votre CODE SECRET DE LIVRAISON est: ${payload.deliveryOtp}. A donner UNIQUEMENT au livreur a la remise du colis.`;
    return this.sendPlainSms(formattedPhone, smsText);
  },

  /**
   * Dispatch générique vers le premier fournisseur SMS configuré.
   */
  async sendPlainSms(formattedPhone: string, smsText: string): Promise<SmsResponse> {
    // 1. Détection du fournisseur SMS configuré
    const orangeClientId = process.env.ORANGE_SMS_CLIENT_ID;
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const termiiApiKey = process.env.TERMII_API_KEY;

    // A. Passerelle Orange Mali — NON IMPLÉMENTÉE
    //
    // ⚠️ Ce bloc annonçait `success: true` avec un faux identifiant de message
    // sans jamais appeler la moindre API : configurer ORANGE_SMS_CLIENT_ID
    // aurait fait croire à un envoi réussi alors qu'aucun client n'aurait reçu
    // son code de livraison, et aucune erreur n'aurait été levée. Même famille
    // de piège que la simulation de virement CinetPay retirée le 2026-09-09.
    //
    // Tant que l'appel REST Orange n'est pas écrit, mieux vaut échouer
    // franchement : le nœud tombe alors sur Twilio, Termii, ou le mode
    // simulation explicite en fin de fonction.
    if (orangeClientId && process.env.ORANGE_SMS_CLIENT_SECRET) {
      console.error(
        '[SMS] Orange Mali est configuré mais son intégration n\'est pas écrite — ' +
        'aucun SMS ne partira par ce canal. Utilise TWILIO_* ou TERMII_API_KEY, ' +
        'ou implémente l\'appel REST Orange dans src/lib/sms-gateway.ts.'
      );
    }

    // B. Passerelle Twilio SMS
    if (twilioAccountSid && process.env.TWILIO_AUTH_TOKEN) {
      try {
        const auth = Buffer.from(`${twilioAccountSid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: formattedPhone,
            From: process.env.TWILIO_PHONE_NUMBER || 'Suguba',
            Body: smsText,
          }).toString(),
        });
        const data = await res.json();
        return {
          success: res.ok,
          messageId: data.sid,
          provider: 'TWILIO',
          message: res.ok ? 'SMS envoyé avec succès via Twilio' : data.message,
        };
      } catch (err: any) {
        console.error('[SMS ERROR] Échec Twilio:', err);
      }
    }

    // C. Passerelle Termii (Afrique de l'Ouest)
    if (termiiApiKey) {
      try {
        const res = await fetch('https://api.ng.termii.com/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: formattedPhone.replace('+', ''),
            from: 'Suguba',
            sms: smsText,
            type: 'plain',
            channel: 'generic',
            api_key: termiiApiKey,
          }),
        });
        const data = await res.json();
        return {
          success: res.ok,
          messageId: data.message_id,
          provider: 'TERMII',
          message: 'SMS envoyé via Termii',
        };
      } catch (err: any) {
        console.error('[SMS ERROR] Échec Termii:', err);
      }
    }

    // D. Mode Sandbox Sécurisé (Par défaut si aucune clé configurée)
    console.log(`\n======================================================`);
    console.log(`📱 [SIMULATION SMS SUGUBA MALI] Destinataire: ${formattedPhone}`);
    console.log(`📩 Message: "${smsText}"`);
    console.log(`======================================================\n`);

    return {
      success: true,
      messageId: `SANDBOX-SMS-${Date.now()}`,
      provider: 'SANDBOX',
      message: `[Sandbox] SMS simulé envoyé avec succès au ${formattedPhone}.`,
    };
  }
};
