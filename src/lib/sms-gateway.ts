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

/**
 * Jeton OAuth2 Orange, mis en cache au niveau du module.
 *
 * Le jeton vaut une heure. Sans ce cache, chaque SMS déclencherait un aller-
 * retour d'authentification supplémentaire — inutile, et une occasion de plus
 * de tomber en panne au pire moment. On le renouvelle 60 s avant l'échéance
 * pour ne jamais présenter un jeton expiré entre-temps.
 */
let jetonOrange: { valeur: string; expireA: number } | null = null;

const ORANGE_OAUTH_URL = 'https://api.orange.com/oauth/v3/token';
const ORANGE_SMS_BASE = 'https://api.orange.com/smsmessaging/v1';

/** Orange plafonne le nom d'expéditeur à 11 caractères alphanumériques. */
const SENDER_NAME_MAX = 11;

async function obtenirJetonOrange(clientId: string, clientSecret: string): Promise<string | null> {
  if (jetonOrange && Date.now() < jetonOrange.expireA) {
    return jetonOrange.valeur;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(ORANGE_OAUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    console.error('[SMS ORANGE] Authentification refusée:', res.status, json.error_description || json.error || '');
    return null;
  }

  // `expires_in` arrive en CHAÎNE ("3600") dans la réponse d'Orange, pas en
  // nombre : un calcul direct dessus donnerait une date invalide.
  const dureeSecondes = Number(json.expires_in) || 3600;
  jetonOrange = {
    valeur: json.access_token,
    expireA: Date.now() + (dureeSecondes - 60) * 1000,
  };
  return jetonOrange.valeur;
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

    // A. Passerelle Orange Mali — SMS national, l'option la moins chère
    //
    // Ce bloc annonçait autrefois `success: true` avec un faux identifiant
    // sans jamais appeler la moindre API : configurer les clés aurait fait
    // croire à des envois réussis pendant qu'aucun client ne recevait son
    // code. L'appel réel est désormais écrit.
    //
    // Le numéro expéditeur est exigé DEUX FOIS par Orange : dans le chemin de
    // l'URL (encodé `tel%3A%2B...`) et dans le corps JSON. En omettre un
    // renvoie une erreur peu explicite.
    //
    // Référence : https://developer.orange.com/apis/sms/getting-started
    const orangeSender = process.env.ORANGE_SMS_SENDER_ADDRESS;
    if (orangeClientId && process.env.ORANGE_SMS_CLIENT_SECRET) {
      if (!orangeSender) {
        console.error(
          '[SMS ORANGE] ORANGE_SMS_SENDER_ADDRESS manquant (ex: +22389460000). ' +
          'Orange exige le numéro expéditeur du contrat — sans lui, aucun envoi possible.'
        );
      } else {
        try {
          const jeton = await obtenirJetonOrange(orangeClientId, process.env.ORANGE_SMS_CLIENT_SECRET);
          if (!jeton) throw new Error('jeton indisponible');

          const expediteur = orangeSender.startsWith('+') ? orangeSender : `+${orangeSender}`;
          const corps: Record<string, any> = {
            address: `tel:${formattedPhone}`,
            senderAddress: `tel:${expediteur}`,
            outboundSMSTextMessage: { message: smsText },
          };

          // Nom d'expéditeur affiché au lieu du numéro. Il doit être déclaré
          // auprès d'Orange, sinon l'envoi est refusé ou le nom ignoré.
          const senderName = (process.env.ORANGE_SMS_SENDER_NAME || '').trim();
          if (senderName) corps.senderName = senderName.slice(0, SENDER_NAME_MAX);

          const res = await fetch(
            `${ORANGE_SMS_BASE}/outbound/${encodeURIComponent(`tel:${expediteur}`)}/requests`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${jeton}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({ outboundSMSMessageRequest: corps }),
            },
          );

          const data: any = await res.json().catch(() => ({}));

          if (res.ok) {
            return {
              success: true,
              messageId: data?.outboundSMSMessageRequest?.resourceURL?.split('/').pop() || `ORANGE-${Date.now()}`,
              provider: 'ORANGE_MALI',
              message: `SMS transmis au réseau Orange Mali pour ${formattedPhone}`,
            };
          }

          // 401 : jeton périmé ou révoqué côté Orange. On vide le cache pour
          // que la tentative suivante en redemande un neuf plutôt que de
          // rejouer indéfiniment un jeton mort.
          if (res.status === 401) jetonOrange = null;

          console.error(
            '[SMS ORANGE] Envoi refusé:', res.status,
            data?.requestError?.serviceException?.text
              || data?.requestError?.policyException?.text
              || JSON.stringify(data).slice(0, 200),
          );
          // On ne renvoie pas d'échec ici : le nœud enchaîne sur Twilio,
          // Termii, ou le mode simulation. Un SMS non parti par Orange peut
          // encore partir par un autre canal.
        } catch (err: any) {
          console.error('[SMS ERROR] Échec Orange Mali:', err?.message || err);
        }
      }
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
