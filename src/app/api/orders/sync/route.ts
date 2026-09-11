import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { verrouillerCommissionDeLivraison } from '@/lib/commissions';

/** Mises à jour internes uniquement. Création atomique : /api/orders/create. */

const STATUTS_VALIDES = ['pending_call', 'confirmed', 'dispatched', 'in_transit', 'delivered', 'cancelled', 'returned'];

export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }

  try {
    const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!session || !['admin', 'driver', 'supplier'].includes(session.role)) {
      return NextResponse.json({ error: 'Authentification requise pour modifier une commande.' }, { status: 401 });
    }

    const body = await req.json();
    const order = body.order;
    if (!order?.id || !order?.orderNumber) {
      return NextResponse.json({ error: 'Commande invalide.' }, { status: 400 });
    }

    const { data: existing, error: readError } = await admin
      .from('orders')
      .select('id, status, assigned_driver_id, product_id, reseller_id')
      .eq('id', order.id)
      .maybeSingle();

    if (readError) return NextResponse.json({ error: 'Lecture indisponible.' }, { status: 503 });
    if (!existing) {
      return NextResponse.json({ error: 'Rechargez la page pour enregistrer une nouvelle commande.' }, { status: 409 });
    }

    // ═══════════════════════════ MISE À JOUR ════════════════════════════
    // Un livreur ne peut modifier que ses propres courses assignées.
    if (session.role === 'driver' && existing.assigned_driver_id !== session.uid) {
      return NextResponse.json({ error: 'Cette commande ne vous est pas assignée.' }, { status: 403 });
    }

    // Un fournisseur ne peut modifier que les commandes de SES produits. Il
    // n'était jusqu'ici limité à rien : n'importe quel compte fournisseur
    // pouvait réécrire n'importe quelle commande.
    if (session.role === 'supplier') {
      const { data: produit } = await admin
        .from('products')
        .select('supplier_id')
        .eq('id', existing.product_id)
        .maybeSingle();
      if (!produit || produit.supplier_id !== session.uid) {
        return NextResponse.json({ error: 'Cette commande ne concerne pas vos produits.' }, { status: 403 });
      }
    }

    const statut = order.status;
    if (statut && !STATUTS_VALIDES.includes(statut)) {
      return NextResponse.json({ error: 'Statut inconnu.' }, { status: 400 });
    }

    // Le passage à « livré » passe par la vérification du code secret
    // (/api/driver/verify-delivery-otp). Seul l'admin peut le forcer ici.
    if (statut === 'delivered' && existing.status !== 'delivered' && session.role !== 'admin') {
      return NextResponse.json({ error: 'Le statut « livré » ne peut être posé que via la validation du code secret.' }, { status: 403 });
    }

    const maj: Record<string, unknown> = {};
    if (statut) maj.status = statut;

    if (session.role === 'admin') {
      // Dispatch et corrections faites par le centre d'appels.
      if ('driverId' in order) maj.assigned_driver_id = order.driverId || null;
      if ('driverName' in order) maj.assigned_driver_name = order.driverName || null;
      for (const [cle, colonne] of [
        ['deliveryNotes', 'delivery_notes'], ['neighborhood', 'neighborhood'], ['landmark', 'landmark'],
        ['customerName', 'customer_name'], ['customerPhone', 'customer_phone'],
      ] as const) {
        if (typeof order[cle] === 'string') maj[colonne] = order[cle];
      }
      // Une livraison forcée par l'admin vaut encaissement, comme la
      // validation par code secret : sans cela, la commande resterait « non
      // payée » et le client se verrait proposer de payer une seconde fois.
      if (statut === 'delivered' && existing.status !== 'delivered') maj.payment_collected = true;
    }

    if (Object.keys(maj).length === 0) {
      return NextResponse.json({ success: true, cloud: true, created: false, inchange: true });
    }

    const { error } = await admin.from('orders').update(maj).eq('id', order.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Livraison confirmée pour la première fois : la commission passe en
    // `locked` avec son délai de sécurité. Le revendeur est celui enregistré
    // en base à la création — jamais un code renvoyé par le navigateur.
    if (statut === 'delivered' && existing.status !== 'delivered') {
      await verrouillerCommissionDeLivraison(admin, order.id, existing.reseller_id || null);
    }

    return NextResponse.json({ success: true, cloud: true, created: false });
  } catch (error: any) {
    console.error('[API orders/sync ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
