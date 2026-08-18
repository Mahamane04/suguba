import { NextRequest, NextResponse } from 'next/server';
import { smsGateway } from '@/lib/sms-gateway';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { toPhone, orderNumber, productName, deliveryOtp, totalAmount } = body;

    if (!toPhone || !orderNumber || !deliveryOtp) {
      return NextResponse.json(
        { error: 'Paramètres manquants (toPhone, orderNumber, deliveryOtp obligatoires)' },
        { status: 400 }
      );
    }

    const result = await smsGateway.sendDeliveryOtpSms({
      toPhone,
      orderNumber,
      productName: productName || 'Article Suguba',
      deliveryOtp,
      totalAmount: totalAmount || 0,
    });

    return NextResponse.json({
      success: result.success,
      provider: result.provider,
      message: result.message,
      sentAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API SMS ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur envoi SMS' }, { status: 500 });
  }
}
