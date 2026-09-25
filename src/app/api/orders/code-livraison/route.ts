import { NextRequest, NextResponse } from 'next/server';
import { hasOrderReceiptAccess } from '@/lib/order-access';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { obtenirCodeRemise } from '@/lib/recu-commande';

/**
 * Code de remise affiché DANS L'APPLICATION (2026-09-25, choix du fondateur) :
 * Suguba n'a pas de service SMS branché, et le lot d'audit n'acceptait une
 * livraison qu'après un envoi SMS confirmé — aucune livraison n'aurait pu
 * être validée.
 *
 * Seul l'appareil qui a passé la commande (il détient la clé secrète du reçu)
 * obtient le code. Les suivis publics, feeds, exports et l'équipe support ne
 * le reçoivent toujours pas. La logique (code neuf versionné, transmission
 * notée) est partagée avec le reçu complet : voir src/lib/recu-commande.ts.
 *
 * Limite assumée : pour une vente saisie par un revendeur (« + Vente »), c'est
 * le revendeur qui détient le reçu, donc le code, et qui le transmet au client.
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
    return NextResponse.json({ error: 'Le code s’affiche sur l’appareil qui a passé la commande. Sinon, contactez Suguba.' }, { status: 403 });
  }

  const r = await obtenirCodeRemise(admin, numero);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ code: r.valeur }, { headers: { 'Cache-Control': 'no-store' } });
}
