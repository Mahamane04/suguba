import { NextRequest, NextResponse } from 'next/server';
import { hasOrderReceiptAccess } from '@/lib/order-access';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerRecu } from '@/lib/recu-commande';

/**
 * Reçu client complet (2026-09-25) : articles, montants, état du paiement et,
 * tant que la livraison est attendue, le code de remise (et donc le QR).
 *
 * Même garde que /api/orders/code-livraison : la clé secrète du reçu, que
 * seul l'appareil qui a passé la commande possède. Le numéro de commande et
 * le téléphone (suivi public) ne suffisent PAS à l'obtenir.
 */
export async function POST(req: NextRequest) {
  const { orderNumber, accessKey } = await req.json().catch(() => ({}));
  if (typeof orderNumber !== 'string' || !orderNumber.trim() || orderNumber.length > 100) {
    return NextResponse.json({ error: 'Numéro de commande requis.' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible. Réessayez.' }, { status: 503 });
  const numero = orderNumber.trim();
  if (!(await hasOrderReceiptAccess(admin, numero, accessKey))) {
    return NextResponse.json({ error: 'Ce reçu s’ouvre sur l’appareil qui a passé la commande.' }, { status: 403 });
  }

  const r = await chargerRecu(admin, numero);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ recu: r.valeur }, { headers: { 'Cache-Control': 'no-store' } });
}
