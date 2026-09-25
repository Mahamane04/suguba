import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Reçu client Suguba (2026-09-25) — SERVEUR UNIQUEMENT.
 *
 * Un reçu couvre une LIVRAISON : les commandes d'un même panier livrées
 * ensemble partagent le même code de remise (voir create_cart_with_commissions
 * et claim_order_sms). Il n'est servi qu'au détenteur de la clé secrète du
 * reçu (hasOrderReceiptAccess), jamais au suivi public ni aux exports.
 */

export const STATUTS_ACTIFS = ['pending_call', 'confirmed', 'dispatched', 'in_transit'];

type Resultat<T> = { ok: true; valeur: T } | { ok: false; status: number; error: string };

/**
 * Code de remise du détenteur du reçu. Un code d'avant l'audit est remplacé
 * par un code neuf (claim_order_sms), et la transmission est notée
 * (confirm_delivery_sms), condition exigée par verify_delivery_atomic.
 */
export async function obtenirCodeRemise(admin: SupabaseClient, numero: string): Promise<Resultat<string>> {
  const indisponible = { ok: false as const, status: 503, error: 'Service indisponible. Réessayez.' };
  const lire = () => admin.from('orders')
    .select('status, delivery_otp, delivery_code_version, delivery_code_sent_at')
    .eq('order_number', numero).maybeSingle();

  let { data: commande, error } = await lire();
  if (error) return indisponible;
  if (!commande || !STATUTS_ACTIFS.includes(commande.status)) {
    return { ok: false, status: 409, error: 'Cette commande n’attend plus de remise.' };
  }

  if (!(Number(commande.delivery_code_version) >= 1 && commande.delivery_code_sent_at)) {
    if (!(Number(commande.delivery_code_version) >= 1)) {
      const { error: claimErr } = await admin.rpc('claim_order_sms', { p_order_number: numero });
      if (claimErr) return indisponible;
      ({ data: commande, error } = await lire());
      if (error || !commande) return indisponible;
      if (!(Number(commande.delivery_code_version) >= 1)) {
        return { ok: false, status: 429, error: 'Réessayez dans une minute.' };
      }
    }
    const { data: note, error: noteErr } = await admin.rpc('confirm_delivery_sms', {
      p_order_number: numero, p_code: commande.delivery_otp,
    });
    if (noteErr || note !== true) return indisponible;
  }
  return { ok: true, valeur: String(commande.delivery_otp) };
}

export interface ArticleRecu {
  orderNumber: string;
  productName: string;
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  articles: number;
  livraison: number;
  total: number;
  status: string;
  deliveredAt: string | null;
}

export interface RecuCommande {
  orderNumber: string;
  createdAt: string;
  status: string;
  destinataire: string;
  lieu: string;
  articles: ArticleRecu[];
  totalArticles: number;
  totalLivraison: number;
  total: number;
  /** Payé en ligne (Mobile Money) avant la livraison. */
  payeEnLigne: boolean;
  /** Montant encore à régler au livreur. */
  resteAPayer: number;
  livre: boolean;
  deliveredAt: string | null;
  /** Présent seulement tant que la livraison est attendue. */
  code: string | null;
  codeErreur: string | null;
  editeLe: string;
}

const COLONNES = 'id, order_number, cart_id, pricing_snapshot, created_at, status, product_name, product_image, quantity, unit_price, total_product_amount, delivery_fee, total_amount, customer_name, neighborhood, landmark, city, payment_method, payment_collected, delivered_at';

export async function chargerRecu(admin: SupabaseClient, numero: string): Promise<Resultat<RecuCommande>> {
  const { data: o, error } = await admin.from('orders').select(COLONNES).eq('order_number', numero).maybeSingle();
  if (error) return { ok: false, status: 503, error: 'Service indisponible. Réessayez.' };
  if (!o) return { ok: false, status: 404, error: 'Commande introuvable.' };

  // Les autres articles de la même livraison (même panier, même groupe).
  let lignes = [o];
  const groupe = o.pricing_snapshot?.panier?.groupeLivraison;
  if (o.cart_id && groupe != null) {
    const { data } = await admin.from('orders').select(COLONNES).eq('cart_id', o.cart_id);
    const memes = (data || []).filter((x) => String(x.pricing_snapshot?.panier?.groupeLivraison) === String(groupe));
    if (memes.length) lignes = memes.sort((a, b) => (a.pricing_snapshot?.panier?.position ?? 0) - (b.pricing_snapshot?.panier?.position ?? 0));
  }

  const n = (v: unknown) => Math.round(Number(v) || 0);
  const articles: ArticleRecu[] = lignes.map((x) => ({
    orderNumber: x.order_number,
    productName: x.product_name,
    productImage: x.product_image || null,
    quantity: n(x.quantity) || 1,
    unitPrice: n(x.unit_price),
    articles: n(x.total_product_amount),
    livraison: n(x.delivery_fee),
    total: n(x.total_amount),
    status: x.status,
    deliveredAt: x.delivered_at || null,
  }));
  const actifs = lignes.filter((x) => !['cancelled', 'returned'].includes(x.status));
  const payeEnLigne = actifs.length > 0 && actifs.every((x) => x.payment_method === 'mobile_money' && x.payment_collected);
  const livre = actifs.length > 0 && actifs.every((x) => x.status === 'delivered');
  const total = actifs.reduce((t, x) => t + n(x.total_amount), 0);
  const resteAPayer = actifs
    .filter((x) => x.status !== 'delivered' && !(x.payment_method === 'mobile_money' && x.payment_collected))
    .reduce((t, x) => t + n(x.total_amount), 0);

  let code: string | null = null;
  let codeErreur: string | null = null;
  if (STATUTS_ACTIFS.includes(o.status)) {
    const r = await obtenirCodeRemise(admin, numero);
    if (r.ok) code = r.valeur; else codeErreur = r.error;
  }

  return {
    ok: true,
    valeur: {
      orderNumber: o.order_number,
      createdAt: o.created_at,
      status: o.status,
      destinataire: o.customer_name || '',
      lieu: [o.neighborhood, o.city].filter(Boolean).join(', '),
      articles,
      totalArticles: actifs.reduce((t, x) => t + n(x.total_product_amount), 0),
      totalLivraison: actifs.reduce((t, x) => t + n(x.delivery_fee), 0),
      total,
      payeEnLigne,
      resteAPayer,
      livre,
      deliveredAt: livre ? actifs.map((x) => x.delivered_at).filter(Boolean).sort().pop() || null : null,
      code,
      codeErreur,
      editeLe: new Date().toISOString(),
    },
  };
}
