import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order } from '@/types';
import { completerReglages } from './pricing';
import { calculerLignesPanier, normaliserPanier, type PanierInput } from './cart-input';
import { genererNumeroCommande } from './order-number';
import { OrderCreationError, recu } from './order-create';

/**
 * Création d'un panier multi-articles — SERVEUR.
 *
 * Un panier = un lot de commandes ordinaires (une par article), créées dans
 * UNE transaction par `create_cart_with_commissions` (voir
 * supabase/migration-panier.sql). Chaque article passe par la même fonction
 * SQL qu'une commande seule : mêmes contrôles de prix, même commission.
 *
 * Règles propres au panier :
 *   • UNE livraison par fournisseur : ses articles partent ensemble, du même
 *     endroit. Le premier article de chaque fournisseur porte les frais, les
 *     autres sont à 0. En point relais, un seul retrait donc un seul frais.
 *   • UN code de livraison par fournisseur : le livreur remet le lot contre
 *     un seul code, pas trois.
 *   • Le code promo ne s'applique qu'UNE fois (premier article) : sinon un
 *     « -2 000 F » deviendrait « -2 000 F par article ».
 */

function indisponible(): never {
  throw new OrderCreationError('Enregistrement indisponible. Réessayez avec le même panier.', 503);
}

const sha = (texte: string) => createHash('sha256').update(texte).digest('hex');

export interface ResultatPanier {
  created: boolean;
  cartId: string;
  orders: Order[];
  total: number;
}

export async function creerPanier(admin: SupabaseClient | null, value: unknown, key: string | null): Promise<ResultatPanier> {
  if (!admin) indisponible();
  if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    throw new OrderCreationError('Référence de demande invalide. Rechargez la page.', 400);
  }
  let input: PanierInput;
  try { input = normaliserPanier(value); }
  catch (error) { throw new OrderCreationError((error as Error).message, 400); }

  const keyHash = sha(key.toLowerCase());
  const fingerprint = sha(JSON.stringify(input));

  const { data: previous, error: previousError } = await admin.from('cart_creation_requests')
    .select('request_fingerprint, cart_id, receipts').eq('key_hash', keyHash).maybeSingle();
  if (previousError) indisponible();
  if (previous) {
    if (previous.request_fingerprint !== fingerprint) {
      throw new OrderCreationError('Cette demande correspond à un autre panier.', 409);
    }
    const orders = (previous.receipts as any[]).map(recu);
    return { created: false, cartId: previous.cart_id, orders, total: orders.reduce((s, o) => s + o.totalAmount, 0) };
  }

  // Produits : un par un (20 au plus), avec le même filtre qu'une commande seule.
  const produits: any[] = [];
  for (const ligne of input.lignes) {
    const { data, error } = await admin.from('products')
      .select('id, name, images, supplier_price, public_price, status, commission_proposee, supplier_id')
      .eq('id', ligne.productId).maybeSingle();
    if (error) indisponible();
    if (!data || data.status !== 'approved' || Number(data.public_price) <= 0) {
      throw new OrderCreationError(
        data?.name ? `« ${data.name} » n’est plus disponible. Retirez-le du panier.` : 'Un article du panier n’est plus disponible.',
        400,
      );
    }
    produits.push(data);
  }

  const quartiers = new Map<string, string | undefined>();
  for (const p of produits) {
    if (!p.supplier_id || quartiers.has(p.supplier_id)) continue;
    const { data } = await admin.from('suppliers').select('warehouse_neighborhood').eq('profile_id', p.supplier_id).maybeSingle();
    quartiers.set(p.supplier_id, data?.warehouse_neighborhood || undefined);
  }

  let reseller: { id: string; full_name: string; reseller_code: string } | null = null;
  if (input.resellerCode) {
    const result = await admin.from('profiles').select('id, full_name, reseller_code')
      .eq('reseller_code', input.resellerCode).maybeSingle();
    if (result.error) indisponible();
    if (!result.data) throw new OrderCreationError('Code revendeur introuvable. Vérifiez le lien partagé.', 400);
    reseller = result.data;
  }

  const { data: settings, error: settingsError } = await admin.from('platform_settings')
    .select('valeurs, updated_at').eq('id', 1).maybeSingle();
  if (settingsError) indisponible();
  const reglages = completerReglages(settings?.valeurs || {});

  const cartId = randomUUID();
  const now = new Date().toISOString();
  const otpParGroupe = new Map<string, string>();
  const calcul = calculerLignesPanier(input.lignes, produits, quartiers, {
    ville: input.city, quartierClient: input.neighborhood, pointRelaisId: input.pickupPointId,
    codePromo: input.promoCode, revendeurAttribue: Boolean(reseller),
  }, reglages);

  const items = input.lignes.map((ligne, i) => {
    const product = produits[i];
    const { devis, groupe, porteLaLivraison, fraisLivraison, total } = calcul[i];
    if (devis.tarif.statut === 'sous_plancher' || !Number.isFinite(devis.total) || devis.total <= 0) {
      throw new OrderCreationError(`Le prix de « ${product.name} » doit être actualisé avant la commande.`, 409);
    }
    // Un seul code de livraison par groupe : le livreur remet le lot entier.
    if (!otpParGroupe.has(groupe)) otpParGroupe.set(groupe, String(randomInt(1000, 10000)));

    const order = {
      id: randomUUID(), order_number: genererNumeroCommande(),
      product_id: product.id, product_name: product.name,
      product_image: Array.isArray(product.images) ? product.images[0] || null : null,
      reseller_id: reseller?.id || null, reseller_name: reseller?.full_name || null,
      reseller_code: reseller?.reseller_code || null, reseller_commission: devis.commissionTotale,
      quantity: devis.quantite, unit_price: devis.prixUnitaire,
      total_product_amount: devis.montantArticles, delivery_fee: fraisLivraison,
      total_amount: total, platform_margin: devis.margeSuguba,
      pricing_snapshot: {
        devis, reglagesDu: settings?.updated_at || null, calculeLe: now,
        panier: { cartId, position: i, groupeLivraison: groupe, livraisonPortee: porteLaLivraison },
      },
      customer_name: input.customerName, customer_phone: input.customerPhone,
      city: devis.ville, neighborhood: devis.pointRelais ? 'Point Relais Partenaire' : input.neighborhood,
      landmark: devis.pointRelais?.nom || input.landmark, delivery_notes: input.deliveryNotes || null,
      status: 'pending_call', delivery_otp: otpParGroupe.get(groupe)!,
      payment_method: 'cash_on_delivery', payment_collected: false, created_at: now,
    };
    return {
      key_hash: sha(`${keyHash}:${i}`),
      fingerprint: sha(`${fingerprint}:${i}`),
      order,
      product: {
        supplier_price: Number(product.supplier_price), public_price: Number(product.public_price),
        commission_proposee: product.commission_proposee == null ? null : Number(product.commission_proposee),
      },
    };
  });

  const { data, error } = await admin.rpc('create_cart_with_commissions', {
    p_key_hash: keyHash, p_fingerprint: fingerprint, p_cart_id: cartId, p_items: items,
  });
  if (error) {
    console.error('[CART CREATE]', error.code);
    if (error.code === 'P0001' && error.message === 'IDEMPOTENCY_CONFLICT') {
      throw new OrderCreationError('Cette demande correspond à un autre panier.', 409);
    }
    if (error.code === '40001') throw new OrderCreationError('Un article a changé de prix. Actualisez le panier et réessayez.', 409);
    indisponible();
  }
  if (!data?.orders) indisponible();
  const orders = (data.orders as any[]).map(recu);
  return {
    created: Boolean(data.created),
    cartId: data.cart_id,
    orders,
    total: orders.reduce((s, o) => s + o.totalAmount, 0),
  };
}
