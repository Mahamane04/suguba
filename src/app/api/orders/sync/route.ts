import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';

/**
 * Remplace l'ancien `pushOrderToCloud` qui écrivait directement dans
 * Supabase depuis le navigateur avec la clé anon (BUG-006). Le schéma
 * corrigé n'autorise plus l'anon à modifier une commande existante — cette
 * route sert donc de point de passage unique, avec service_role, pour la
 * création (publique, cœur du parcours client sans compte) ET la mise à
 * jour de statut (réservée aux comptes admin/livreur authentifiés).
 */
export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    // Pas de Supabase configuré : la commande reste locale au navigateur
    // (voir sugubaStore) — comportement inchangé, pas une erreur.
    return NextResponse.json({ success: true, cloud: false });
  }

  try {
    const body = await req.json();
    const order = body.order;
    if (!order?.id || !order?.orderNumber) {
      return NextResponse.json({ error: 'Commande invalide.' }, { status: 400 });
    }

    const { data: existing } = await admin.from('orders').select('id, status').eq('id', order.id).maybeSingle();

    // Le lien commande → revendeur ne doit jamais reposer sur le
    // `resellerId` envoyé par le client (identifiant local de démo, pas un
    // profil réel) : on résout le vrai propriétaire via son code de
    // parrainage, seule donnée qu'un lien /p/[slug]?ref=CODE transporte
    // réellement. Sans correspondance, la commande se crée quand même —
    // simplement sans commission attribuée.
    let resolvedResellerId: string | null = null;
    if (order.resellerCode) {
      const { data: resellerProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('reseller_code', order.resellerCode)
        .maybeSingle();
      resolvedResellerId = resellerProfile?.id || null;
    }

    const row = {
      id: order.id,
      order_number: order.orderNumber,
      product_id: order.productId,
      product_name: order.productName,
      product_image: order.productImage,
      reseller_id: resolvedResellerId,
      reseller_name: order.resellerName,
      reseller_code: order.resellerCode,
      reseller_commission: order.resellerCommission,
      quantity: order.quantity,
      unit_price: order.unitPrice,
      total_product_amount: order.totalProductAmount,
      delivery_fee: order.deliveryFee,
      total_amount: order.totalAmount,
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      city: order.city,
      neighborhood: order.neighborhood,
      landmark: order.landmark,
      delivery_notes: order.deliveryNotes,
      status: order.status,
      delivery_otp: order.deliveryOtp,
      payment_method: order.paymentMethod,
      payment_collected: order.paymentCollected,
      assigned_driver_id: order.driverId,
      assigned_driver_name: order.driverName,
      created_at: order.createdAt,
    };

    if (!existing) {
      // Création : publique, sans compte — cœur du parcours client.
      const { error } = await admin.from('orders').insert(row);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Commission "pending" par défaut — ne devient "available" que
      // lorsque la commande passe à 'delivered' (voir plus bas pour le cas
      // normal : mise à jour ultérieure). Gère aussi le cas, plus rare, où
      // une commande est créée déjà 'delivered' en un seul appel : sans ce
      // second cas, la commission resterait bloquée en 'pending' pour
      // toujours puisque la transition ne se déclenche que sur une mise à
      // jour de statut, jamais sur une création.
      if (resolvedResellerId && Number(order.resellerCommission) > 0) {
        const initialStatus = order.status === 'delivered' ? 'available' : 'pending';
        await admin.from('commissions').insert({
          order_id: order.id,
          order_number: order.orderNumber,
          reseller_id: resolvedResellerId,
          amount: order.resellerCommission,
          status: initialStatus,
          available_at: initialStatus === 'available' ? new Date().toISOString() : null,
        });
      }

      return NextResponse.json({ success: true, cloud: true, created: true });
    }

    // Mise à jour (confirmation, dispatch, livraison...) : réservée aux
    // comptes internes authentifiés, jamais au client final.
    const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!session || !['admin', 'driver', 'supplier'].includes(session.role)) {
      return NextResponse.json({ error: 'Authentification requise pour modifier une commande.' }, { status: 401 });
    }

    const { error } = await admin.from('orders').update(row).eq('id', order.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Livraison confirmée pour la première fois : la commission associée
    // devient réclamable. `existing.status !== 'delivered'` évite de la
    // "redébloquer" si la même mise à jour est rejouée par erreur.
    if (order.status === 'delivered' && existing.status !== 'delivered') {
      await admin
        .from('commissions')
        .update({ status: 'available', available_at: new Date().toISOString() })
        .eq('order_id', order.id)
        .eq('status', 'pending');
    }

    return NextResponse.json({ success: true, cloud: true, created: false });
  } catch (error: any) {
    console.error('[API orders/sync ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
