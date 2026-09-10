import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { verrouillerCommissionDeLivraison } from '@/lib/commissions';
import { chargerReglages } from '@/lib/platform-settings';
import { calculerCommande } from '@/lib/pricing';

/**
 * Point de passage unique des commandes vers Supabase (service_role) :
 *  - CRÉATION : publique, cœur du parcours client sans compte ;
 *  - MISE À JOUR : réservée aux comptes internes authentifiés.
 *
 * ── Les montants ne viennent plus jamais du navigateur ───────────────────
 * Cette route enregistrait jusqu'ici TELLES QUELLES les valeurs envoyées par
 * le navigateur : prix unitaire, montant total, commission revendeur, statut,
 * paiement encaissé. La création étant publique, n'importe qui pouvait :
 *   - créer une commande avec une commission de 500 000 F sur son propre code
 *     revendeur ;
 *   - la créer d'emblée « livrée », ce qui rendait la commission disponible
 *     au retrait sans qu'aucun colis ne bouge ;
 *   - fixer le montant total à 100 F pour un article à 45 000 F — ce que la
 *     route de paiement SasPay aurait ensuite « relu en base » en toute
 *     confiance.
 *
 * Désormais, à la création, tous les montants sont calculés ICI par
 * calculerCommande, à partir du produit tel qu'il est en base, et figés sur
 * la commande avec la décomposition complète (pricing_snapshot). Le
 * navigateur ne transmet que ce que le client a choisi : produit, quantité,
 * ville ou point relais, code promo, coordonnées.
 *
 * ── Les mises à jour ne touchent jamais l'argent ─────────────────────────
 * Elles réécrivaient toute la ligne, montants compris : un livreur pouvait
 * modifier le total ou la commission de ses courses, et un fournisseur
 * n'importe quelle commande. Seuls le statut (et, pour l'admin, le dispatch
 * et les corrections d'adresse) peuvent désormais changer.
 */

const STATUTS_VALIDES = ['pending_call', 'confirmed', 'dispatched', 'in_transit', 'delivered', 'cancelled', 'returned'];

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

    const { data: existing } = await admin
      .from('orders')
      .select('id, status, assigned_driver_id, product_id, reseller_id')
      .eq('id', order.id)
      .maybeSingle();

    // ═════════════════════════════ CRÉATION ═════════════════════════════
    if (!existing) {
      const { data: produit } = await admin
        .from('products')
        .select('id, name, images, supplier_price, public_price, status')
        .eq('id', order.productId)
        .maybeSingle();

      if (!produit || produit.status !== 'approved') {
        return NextResponse.json({ error: 'Ce produit n\'est pas disponible à la vente.' }, { status: 400 });
      }

      // Le lien commande → revendeur ne repose jamais sur un identifiant
      // envoyé par le client : on résout le vrai propriétaire via son code de
      // parrainage, seule donnée qu'un lien /p/[slug]?ref=CODE transporte.
      // Sans correspondance, la commande se crée quand même, sans commission.
      let resolvedResellerId: string | null = null;
      if (order.resellerCode) {
        const { data: resellerProfile } = await admin
          .from('profiles')
          .select('id')
          .eq('reseller_code', order.resellerCode)
          .maybeSingle();
        resolvedResellerId = resellerProfile?.id || null;
      }

      const { reglages, majLe } = await chargerReglages();
      const devis = calculerCommande(
        { prixFournisseur: Number(produit.supplier_price), prixVente: Number(produit.public_price) },
        {
          quantite: Number(order.quantity) || 1,
          ville: typeof order.city === 'string' ? order.city : undefined,
          pointRelaisId: typeof order.pickupPointId === 'string' ? order.pickupPointId : undefined,
          codePromo: typeof order.promoCode === 'string' ? order.promoCode : undefined,
          revendeurAttribue: Boolean(resolvedResellerId),
        },
        reglages,
      );

      // Le code de livraison est généré par l'écran du client, qui l'affiche
      // aussitôt. On ne le remplace que s'il n'a pas la forme attendue.
      const otp = /^\d{4}$/.test(String(order.deliveryOtp || ''))
        ? String(order.deliveryOtp)
        : String(Math.floor(1000 + Math.random() * 9000));

      const maintenant = new Date().toISOString();
      const row = {
        id: order.id,
        order_number: order.orderNumber,
        product_id: produit.id,
        product_name: produit.name,
        product_image: Array.isArray(produit.images) ? produit.images[0] || null : null,
        reseller_id: resolvedResellerId,
        reseller_name: resolvedResellerId ? order.resellerName || null : null,
        reseller_code: resolvedResellerId ? order.resellerCode : null,
        reseller_commission: devis.commissionTotale,
        quantity: devis.quantite,
        unit_price: devis.prixUnitaire,
        total_product_amount: devis.montantArticles,
        delivery_fee: devis.fraisLivraison,
        total_amount: devis.total,
        platform_margin: devis.margeSuguba,
        pricing_snapshot: { devis, reglagesDu: majLe, calculeLe: maintenant },
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        city: devis.ville,
        neighborhood: order.neighborhood,
        landmark: order.landmark,
        delivery_notes: order.deliveryNotes || null,
        // Une commande naît TOUJOURS en attente d'appel, non payée, sans
        // livreur — quoi que prétende le navigateur.
        status: 'pending_call',
        delivery_otp: otp,
        payment_method: 'cash_on_delivery',
        payment_collected: false,
        assigned_driver_id: null,
        assigned_driver_name: null,
        created_at: order.createdAt || maintenant,
      };

      const { error } = await admin.from('orders').insert(row);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Commission toujours « pending » à la création : elle ne devient
      // disponible qu'après une livraison validée par le code secret, puis le
      // délai de sécurité (voir src/lib/commissions.ts).
      if (resolvedResellerId && devis.commissionTotale > 0) {
        await admin.from('commissions').insert({
          order_id: order.id,
          order_number: order.orderNumber,
          reseller_id: resolvedResellerId,
          amount: devis.commissionTotale,
          status: 'pending',
          available_at: null,
        });
      }

      return NextResponse.json({
        success: true,
        cloud: true,
        created: true,
        // Les montants qui font foi, pour que l'écran puisse se recaler.
        montants: {
          unitPrice: devis.prixUnitaire,
          totalProductAmount: devis.montantArticles,
          deliveryFee: devis.fraisLivraison,
          discountAmount: devis.remise,
          totalAmount: devis.total,
        },
      });
    }

    // ═══════════════════════════ MISE À JOUR ════════════════════════════
    const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!session || !['admin', 'driver', 'supplier'].includes(session.role)) {
      return NextResponse.json({ error: 'Authentification requise pour modifier une commande.' }, { status: 401 });
    }

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
