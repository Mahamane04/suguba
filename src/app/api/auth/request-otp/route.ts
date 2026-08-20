import { NextRequest, NextResponse } from 'next/server';
import { smsGateway } from '@/lib/sms-gateway';
import { createOtpChallenge } from '@/lib/otp-store';

function formatPhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00223')) return '+' + cleaned.slice(2);
  if (cleaned.startsWith('223')) return '+' + cleaned;
  return '+223' + cleaned;
}

/**
 * Demande d'un code de connexion. Le code n'est JAMAIS renvoyé dans la
 * réponse HTTP — corrige BUG-002 (l'ancienne implémentation renvoyait
 * `otpCode` directement au navigateur). Il part uniquement par SMS.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPhone = String(body.phone || '');
    if (rawPhone.replace(/\D/g, '').length < 8) {
      return NextResponse.json({ success: false, error: 'Numéro de téléphone invalide.' }, { status: 400 });
    }
    const phone = formatPhone(rawPhone);

    const code = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
    const codeStr = code.toString().padStart(6, '0');

    await createOtpChallenge(phone, codeStr);
    const sms = await smsGateway.sendLoginOtpSms(phone, codeStr);

    return NextResponse.json({
      success: sms.success,
      message: sms.success ? `Code envoyé au ${phone}` : "Échec d'envoi du SMS, réessayez.",
    });
  } catch (error: any) {
    console.error('[API AUTH request-otp ERROR]', error);
    return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
  }
}
