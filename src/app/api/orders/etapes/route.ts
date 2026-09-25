import { NextRequest, NextResponse } from 'next/server';
import { hasOrderReceiptAccess } from '@/lib/order-access';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { EtapeError, repondreEtape } from '@/lib/etapes';

/**
 * Le client valide ou conteste une étape de sa prestation (2026-09-26,
 * lot 1c), depuis son reçu. Même garde que le reçu : la clé secrète que seul
 * le téléphone qui a commandé possède.
 */
export async function POST(req: NextRequest) {
  const { orderNumber, accessKey, position, decision, motif } = await req.json().catch(() => ({}));
  if (typeof orderNumber !== 'string' || !orderNumber.trim() || orderNumber.length > 100) {
    return NextResponse.json({ error: 'Commande manquante.' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible. Réessayez.' }, { status: 503 });
  const numero = orderNumber.trim();
  if (!(await hasOrderReceiptAccess(admin, numero, accessKey))) {
    return NextResponse.json({ error: 'Ce reçu s’ouvre sur l’appareil qui a passé la commande.' }, { status: 403 });
  }
  try {
    return NextResponse.json({ etape: await repondreEtape(admin, numero, { position, decision, motif }) });
  } catch (e) {
    const err = e as EtapeError;
    return NextResponse.json({ error: err.message || 'Action impossible.' }, { status: err.status || 500 });
  }
}
