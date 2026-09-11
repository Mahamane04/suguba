import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order } from '@/types';
import { calculerCommande, completerReglages, type Devis } from './pricing';
import { normaliserCommande } from './order-input';
import { genererNumeroCommande } from './order-number';

export class OrderCreationError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

function indisponible(): never {
  throw new OrderCreationError('Enregistrement indisponible. Réessayez avec le même formulaire.', 503);
}

/** Ne publie ni les coûts ni le snapshot économique renvoyés par PostgreSQL. */
function recu(row: Record<string, any>): Order {
  const devis = row.pricing_snapshot.devis as Devis;
  return {
    creationConfirmed: true,
    id: row.id, orderNumber: row.order_number,
    productId: row.product_id, productName: row.product_name, productImage: row.product_image || '',
    resellerId: row.reseller_id || undefined, resellerName: row.reseller_name || undefined,
    resellerCode: row.reseller_code || undefined, resellerCommission: Number(row.reseller_commission),
    quantity: Number(row.quantity), unitPrice: Number(row.unit_price),
    totalProductAmount: Number(row.total_product_amount), deliveryFee: Number(row.delivery_fee),
    totalAmount: Number(row.total_amount), discountAmount: devis.remise,
    customerName: row.customer_name, customerPhone: row.customer_phone,
    city: row.city, neighborhood: row.neighborhood, landmark: row.landmark,
    deliveryNotes: row.delivery_notes || undefined,
    pickupPointId: devis.pointRelais?.id, promoCode: devis.codePromo || undefined,
    status: row.status, deliveryOtp: row.delivery_otp,
    paymentMethod: row.payment_method, paymentCollected: row.payment_collected,
    createdAt: row.created_at,
  };
}

/** REQ-013 : le succès signifie commande ET commission validées en base. */
export async function creerCommande(admin: SupabaseClient | null, value: unknown, key: string | null) {
  if (!admin) indisponible();
  if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    throw new OrderCreationError('Référence de demande invalide. Rechargez la page.', 400);
  }
  let input;
  try { input = normaliserCommande(value); }
  catch (error) { throw new OrderCreationError((error as Error).message, 400); }
  const hash = (text: string) => createHash('sha256').update(text).digest('hex');
  const keyHash = hash(key.toLowerCase());
  const fingerprint = hash(JSON.stringify(input));

  // La clé aléatoire est une preuve de possession, jamais l'id public d'une
  // commande. Une nouvelle tentative restitue le reçu initial, même si les
  // prix ou le catalogue ont changé entre-temps.
  const { data: previous, error: previousError } = await admin.from('order_creation_requests')
    .select('request_fingerprint, receipt').eq('key_hash', keyHash).maybeSingle();
  if (previousError) indisponible();
  if (previous) {
    if (previous.request_fingerprint !== fingerprint) {
      throw new OrderCreationError('Cette demande correspond à un autre formulaire.', 409);
    }
    return { created: false, order: recu(previous.receipt) };
  }

  const { data: product, error: productError } = await admin.from('products')
    .select('id, name, images, supplier_price, public_price, status, commission_proposee, supplier_id')
    .eq('id', input.productId).maybeSingle();
  if (productError) indisponible();
  if (!product || product.status !== 'approved' || Number(product.public_price) <= 0) {
    throw new OrderCreationError('Ce produit n’est pas disponible à la vente.', 400);
  }

  // Quartier du fournisseur — voir /api/orders/quote pour le détail : sans
  // lui, repli sur le tarif plat, jamais un blocage de la commande.
  let quartierFournisseur: string | undefined;
  if (product.supplier_id) {
    const { data: fournisseur } = await admin
      .from('suppliers')
      .select('warehouse_neighborhood')
      .eq('profile_id', product.supplier_id)
      .maybeSingle();
    quartierFournisseur = fournisseur?.warehouse_neighborhood || undefined;
  }
  let reseller: { id: string; full_name: string; reseller_code: string } | null = null;
  if (input.resellerCode) {
    const result = await admin.from('profiles').select('id, full_name, reseller_code')
      .eq('reseller_code', input.resellerCode).maybeSingle();
    if (result.error) indisponible();
    if (!result.data) throw new OrderCreationError('Code revendeur introuvable. Vérifiez le lien partagé.', 400);
    reseller = result.data;
  }

  // Aucun repli silencieux sur des coûts par défaut en cas d'erreur de base.
  const { data: settings, error: settingsError } = await admin.from('platform_settings')
    .select('valeurs, updated_at').eq('id', 1).maybeSingle();
  if (settingsError) indisponible();
  const devis = calculerCommande({
    prixFournisseur: Number(product.supplier_price), prixVente: Number(product.public_price),
    commissionProposee: product.commission_proposee,
  }, {
    quantite: input.quantity, ville: input.city,
    quartierClient: input.neighborhood, quartierFournisseur,
    pointRelaisId: input.pickupPointId,
    codePromo: input.promoCode, revendeurAttribue: Boolean(reseller),
  }, completerReglages(settings?.valeurs || {}));
  if (devis.tarif.statut === 'sous_plancher' || !Number.isFinite(devis.total) || devis.total <= 0) {
    throw new OrderCreationError('Le prix de ce produit doit être actualisé avant la commande.', 409);
  }
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(), order_number: genererNumeroCommande(),
    product_id: product.id, product_name: product.name,
    product_image: Array.isArray(product.images) ? product.images[0] || null : null,
    reseller_id: reseller?.id || null, reseller_name: reseller?.full_name || null,
    reseller_code: reseller?.reseller_code || null, reseller_commission: devis.commissionTotale,
    quantity: devis.quantite, unit_price: devis.prixUnitaire,
    total_product_amount: devis.montantArticles, delivery_fee: devis.fraisLivraison,
    total_amount: devis.total, platform_margin: devis.margeSuguba,
    pricing_snapshot: { devis, reglagesDu: settings?.updated_at || null, calculeLe: now },
    customer_name: input.customerName, customer_phone: input.customerPhone,
    city: devis.ville, neighborhood: devis.pointRelais ? 'Point Relais Partenaire' : input.neighborhood,
    landmark: devis.pointRelais?.nom || input.landmark, delivery_notes: input.deliveryNotes || null,
    status: 'pending_call', delivery_otp: String(randomInt(1000, 10000)),
    payment_method: 'cash_on_delivery', payment_collected: false, created_at: now,
  };
  const { data, error } = await admin.rpc('create_order_with_commission', {
    p_key_hash: keyHash, p_fingerprint: fingerprint, p_order: row,
    p_product: {
      supplier_price: Number(product.supplier_price), public_price: Number(product.public_price),
      commission_proposee: product.commission_proposee == null ? null : Number(product.commission_proposee),
    },
  });
  if (error) {
    // Ne journalise jamais la clé de reprise, le téléphone ou le code secret.
    console.error('[ORDER CREATE]', error.code);
    if (error.code === 'P0001' && error.message === 'IDEMPOTENCY_CONFLICT') {
      throw new OrderCreationError('Cette demande correspond à un autre formulaire.', 409);
    }
    if (error.code === '40001') throw new OrderCreationError('Le produit a changé. Actualisez le devis et réessayez.', 409);
    indisponible();
  }
  if (!data?.order) indisponible();
  return { created: Boolean(data.created), order: recu(data.order) };
}
