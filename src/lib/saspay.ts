/**
 * Client SasPay — encaissement (payin) et versement (payout).
 * Documentation : https://docs.saspay.me
 *
 * Serveur uniquement : la clé secrète donne le droit d'encaisser ET de
 * décaisser au nom de Suguba. Ne jamais importer ce fichier depuis un
 * composant 'use client'.
 *
 * ── Pourquoi softpay et pas checkout-sessions ────────────────────────────
 * Le webhook SasPay ne renvoie PAS nos `metadata` : son `data` ne contient
 * que l'id de transaction SasPay, sa référence interne, le statut et les
 * montants. Impossible donc d'y lire un numéro de commande Suguba comme le
 * faisait l'ancien `custom_data` de LigdiCash.
 *
 * La seule façon fiable de rattacher un webhook à une commande est donc de
 * stocker l'id de transaction SasPay AU MOMENT DE L'INITIATION, puis de
 * retrouver la ligne par cet id. `POST /payments/softpay/` renvoie cet id
 * immédiatement ; `POST /checkout-sessions/` ne le renvoie pas (son champ
 * `transaction` vaut `null` à la création). D'où ce choix.
 * Voir la colonne `payment_transaction_id` dans migration-saspay.sql.
 *
 * ── checkout_url : toujours le tester ────────────────────────────────────
 * Softpay ne pousse pas toujours sur le téléphone. Pour Orange Money (et les
 * cartes), SasPay renvoie une `checkout_url` et le client doit y être
 * redirigé — sans quoi le paiement n'a jamais lieu. Un même réseau peut
 * basculer d'un mode à l'autre sans préavis selon le routage SasPay.
 */

const BASE_URL = 'https://api.saspay.me/api/v1';

/** Suguba n'opère qu'au Mali. */
export const PAYS = 'ML';
export const DEVISE = 'XOF';

/**
 * Réseaux SasPay disponibles au Mali.
 * ⚠️ Wave n'y figure pas : SasPay ne le couvre pas au Mali, malgré sa
 * popularité locale. Ne pas l'ajouter ici « au cas où » — un code réseau
 * inconnu fait échouer l'appel en 422 (`invalid_method`).
 * Source : https://docs.saspay.me/api-reference/reference/formats
 */
export const RESEAUX_MALI = {
  orange_ml: 'Orange Money',
  moov_ml: 'Moov Money',
  mobi_cash_ml: 'Mobi Cash',
} as const;

export type ReseauMali = keyof typeof RESEAUX_MALI;

/**
 * Réseaux globaux, non rattachés à un pays.
 *
 * ⚠️ `card` et `crypto` sont **en USD uniquement** : SasPay ignore le
 * `country` envoyé, rattache la transaction au pays technique `XX` et
 * convertit automatiquement un montant XOF au taux configuré. Ils n'ont que
 * la page hébergée — jamais de push — d'où `urlRetour` obligatoire (sinon
 * `422` avant même la création du paiement).
 * C'est la porte d'entrée du portail Diaspora, dont l'acheteur est à
 * l'étranger et n'a pas de numéro mobile money malien.
 */
export const RESEAUX_GLOBAUX = {
  card: 'Carte bancaire',
  crypto: 'Crypto / stablecoin',
} as const;

export type ReseauGlobal = keyof typeof RESEAUX_GLOBAUX;
export type Reseau = ReseauMali | ReseauGlobal;

export function estReseauMali(valeur: unknown): valeur is ReseauMali {
  return typeof valeur === 'string' && valeur in RESEAUX_MALI;
}

export function estReseauGlobal(valeur: unknown): valeur is ReseauGlobal {
  return typeof valeur === 'string' && valeur in RESEAUX_GLOBAUX;
}

/** Accepte un réseau malien ou un réseau global. */
export function estReseau(valeur: unknown): valeur is Reseau {
  return estReseauMali(valeur) || estReseauGlobal(valeur);
}

/** Statuts de transaction SasPay, payin comme payout. */
export type StatutTransaction = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface Client {
  email: string;
  prenom: string;
  nom: string;
  telephone: string;
}

export interface DemandePayin {
  montant: number;
  description: string;
  reseau: Reseau;
  client: Client;
  /** Où ramener le client après paiement sur page hébergée (Orange, carte). */
  urlRetour?: string;
  /** Clé d'idempotence : même clé pour tous les retrys d'une même intention. */
  cleIdempotence: string;
}

export interface DemandePayout {
  montant: number;
  description: string;
  reseau: ReseauMali;
  /** Numéro crédité. Accepté en local, international avec ou sans « + ». */
  msisdn: string;
  beneficiaire?: Partial<Client>;
  cleIdempotence: string;
}

export interface ResultatInitiation {
  ok: boolean;
  /** Id de transaction SasPay — À STOCKER : c'est la seule clé de rattachement. */
  id?: string;
  statut?: StatutTransaction;
  /** Non vide = rediriger le client, aucun push ne partira sur son téléphone. */
  urlCheckout?: string;
  erreur?: string;
  code?: string;
}

export interface ResultatVerification {
  ok: boolean;
  statut?: StatutTransaction;
  reference?: string;
  /** Montant demandé. */
  montant?: number;
  /** Ce que le payeur a réellement déboursé (payin) — à utiliser pour rapprocher. */
  debite?: number;
  /** Ce qui revient réellement à Suguba, frais déduits le cas échéant. */
  montantNet?: number;
  devise?: string;
  erreur?: string;
}

function config() {
  const cle = process.env.SASPAY_API_KEY;
  const secretWebhook = process.env.SASPAY_WEBHOOK_SECRET;
  return { cle, secretWebhook };
}

/** Noms des variables manquantes (jamais leurs valeurs — ce sont des secrets). */
export function configurationManquante(): string[] {
  const c = config();
  return [
    !c.cle && 'SASPAY_API_KEY',
    !c.secretWebhook && 'SASPAY_WEBHOOK_SECRET',
  ].filter(Boolean) as string[];
}

/** true si la clé configurée est une clé de test (sk_test_...). */
export function estEnvironnementTest(): boolean {
  return (process.env.SASPAY_API_KEY || '').startsWith('sk_test_');
}

function entetes(cle: string, cleIdempotence?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Authorization': `Bearer ${cle}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (cleIdempotence) h['Idempotency-Key'] = cleIdempotence;
  return h;
}

/** SasPay attend des montants décimaux en chaîne : "5000.00". */
function montantSasPay(montant: number): string {
  return montant.toFixed(2);
}

/**
 * Message d'erreur exploitable. SasPay répond soit `{message, code}`, soit
 * une enveloppe `{success:false, error:{...}}`, soit des erreurs de champ.
 * On ne renvoie jamais le corps brut à l'appelant : il peut contenir des
 * détails d'infrastructure sans intérêt pour un client final.
 */
function messageErreur(json: any, defaut: string): { erreur: string; code?: string } {
  const err = json?.error ?? json;
  const code = typeof err?.code === 'string' ? err.code : undefined;
  const message = err?.message || err?.detail;
  if (typeof message === 'string' && message.trim()) return { erreur: message, code };
  return { erreur: defaut, code };
}

/**
 * Initie un encaissement.
 *
 * ⚠️ L'appelant DOIT stocker `id` avant d'afficher quoi que ce soit au
 * client : sans lui, le webhook de confirmation ne pourra être rattaché à
 * aucune commande et le paiement restera invisible côté Suguba.
 */
export async function initierPayin(d: DemandePayin): Promise<ResultatInitiation> {
  const c = config();
  if (!c.cle) return { ok: false, erreur: 'Configuration SasPay incomplète : SASPAY_API_KEY.' };

  // `return_url` n'est pas une commodité pour card/crypto : sans elle,
  // SasPay rejette la requête en 422 et aucun paiement n'est créé.
  if (estReseauGlobal(d.reseau) && !d.urlRetour) {
    return { ok: false, erreur: `Une URL de retour est obligatoire pour le réseau « ${RESEAUX_GLOBAUX[d.reseau]} ».` };
  }

  const corps: Record<string, any> = {
    amount: montantSasPay(d.montant),
    currency: DEVISE,
    country: PAYS,
    description: d.description,
    network: d.reseau,
    customer: {
      email: d.client.email,
      first_name: d.client.prenom,
      last_name: d.client.nom,
      phone: d.client.telephone,
    },
  };
  if (d.urlRetour) corps.return_url = d.urlRetour;

  try {
    const res = await fetch(`${BASE_URL}/payments/softpay/`, {
      method: 'POST',
      headers: entetes(c.cle, d.cleIdempotence),
      body: JSON.stringify(corps),
    });
    const json: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      const { erreur, code } = messageErreur(json, 'Paiement refusé par SasPay.');
      console.error('[SASPAY] Initiation payin refusée:', res.status, code, erreur);
      return { ok: false, erreur, code };
    }

    const id = json.id ?? json.data?.id;
    if (!id) {
      console.error('[SASPAY] Réponse payin sans id — impossible à rattacher.');
      return { ok: false, erreur: 'Réponse SasPay inexploitable (id absent).' };
    }

    return {
      ok: true,
      id: String(id),
      statut: (json.status ?? json.data?.status) as StatutTransaction,
      // Chaîne vide = push sur le téléphone, pas de redirection.
      urlCheckout: (json.checkout_url ?? json.data?.checkout_url) || undefined,
    };
  } catch (error) {
    console.error('[SASPAY] Erreur réseau (payin):', error);
    return { ok: false, erreur: 'SasPay injoignable.' };
  }
}

/**
 * Initie un versement vers un bénéficiaire.
 *
 * Comme pour le payin, `id` doit être stocké : le webhook `transaction.*`
 * ne transporte rien d'autre qui permette de retrouver le retrait.
 */
export async function initierPayout(d: DemandePayout): Promise<ResultatInitiation> {
  const c = config();
  if (!c.cle) return { ok: false, erreur: 'Configuration SasPay incomplète : SASPAY_API_KEY.' };

  const corps: Record<string, any> = {
    amount: montantSasPay(d.montant),
    currency: DEVISE,
    country: PAYS,
    description: d.description,
    method: d.reseau,
    recipient: { msisdn: d.msisdn },
  };
  if (d.beneficiaire) {
    corps.customer = {
      email: d.beneficiaire.email,
      first_name: d.beneficiaire.prenom,
      last_name: d.beneficiaire.nom,
      phone: d.beneficiaire.telephone,
    };
  }

  try {
    const res = await fetch(`${BASE_URL}/payouts/initialize/`, {
      method: 'POST',
      headers: entetes(c.cle, d.cleIdempotence),
      body: JSON.stringify(corps),
    });
    const json: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      const { erreur, code } = messageErreur(json, 'Versement refusé par SasPay.');
      console.error('[SASPAY] Initiation payout refusée:', res.status, code, erreur);
      return { ok: false, erreur, code };
    }

    const id = json.id ?? json.data?.id;
    if (!id) {
      console.error('[SASPAY] Réponse payout sans id — impossible à rattacher.');
      return { ok: false, erreur: 'Réponse SasPay inexploitable (id absent).' };
    }

    // Un payout initialisé est PENDING : il n'est PAS exécuté à ce stade.
    // Ne jamais marquer un retrait « completed » sur cette seule réponse.
    return { ok: true, id: String(id), statut: (json.status as StatutTransaction) || 'PENDING' };
  } catch (error) {
    console.error('[SASPAY] Erreur réseau (payout):', error);
    return { ok: false, erreur: 'SasPay injoignable.' };
  }
}

async function verifier(chemin: string, quoi: string): Promise<ResultatVerification> {
  const c = config();
  if (!c.cle) return { ok: false, erreur: 'Configuration SasPay incomplète : SASPAY_API_KEY.' };

  try {
    const res = await fetch(`${BASE_URL}${chemin}`, { method: 'GET', headers: entetes(c.cle) });
    const json: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      const { erreur } = messageErreur(json, `Vérification ${quoi} refusée par SasPay.`);
      return { ok: false, erreur };
    }

    const d = json.data ?? json;
    return {
      ok: true,
      statut: d.status as StatutTransaction,
      reference: d.reference,
      montant: Number(d.requested_amount ?? d.amount ?? 0),
      debite: Number(d.debited_amount ?? 0),
      montantNet: Number(d.net_amount ?? 0),
      devise: d.currency,
    };
  } catch (error) {
    console.error(`[SASPAY] Erreur réseau (vérification ${quoi}):`, error);
    return { ok: false, erreur: 'SasPay injoignable.' };
  }
}

/**
 * Seule source de vérité sur l'état réel d'un encaissement.
 * SasPay revalide lui-même auprès du gateway quand le statut connu est
 * PENDING — ne jamais se contenter d'un statut mémorisé côté Suguba.
 */
export function verifierPayin(idTransaction: string): Promise<ResultatVerification> {
  if (!idTransaction) return Promise.resolve({ ok: false, erreur: 'Id de transaction manquant.' });
  return verifier(`/payments/${encodeURIComponent(idTransaction)}/verify/`, 'paiement');
}

/** Idem pour un versement. */
export function verifierPayout(idTransaction: string): Promise<ResultatVerification> {
  if (!idTransaction) return Promise.resolve({ ok: false, erreur: 'Id de transaction manquant.' });
  return verifier(`/payouts/${encodeURIComponent(idTransaction)}/verify/`, 'versement');
}

// ───────────────────────── Webhooks ─────────────────────────

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Tolérance d'horloge imposée par SasPay : 5 minutes. */
const TOLERANCE_SECONDES = 300;

export const ENTETE_SIGNATURE = 'x-webhook-signature';
export const ENTETE_HORODATAGE = 'x-webhook-timestamp';
export const ENTETE_EVENT = 'x-webhook-event';

export interface EventWebhook {
  event: string;
  data: Record<string, any>;
}

/**
 * Vérifie la signature d'un webhook SasPay.
 *
 * Deux contrôles, pas un seul :
 *  1. l'âge de l'horodatage — sans lui, un webhook légitime intercepté reste
 *     rejouable indéfiniment, sa signature ne périmant jamais ;
 *  2. la signature elle-même, recalculée sur le CORPS BRUT reçu.
 *
 * ⚠️ `corpsBrut` doit être le texte exact reçu (`await req.text()`), jamais
 * une re-sérialisation d'un objet parsé : l'ordre des clés ou le formatage
 * des nombres diffèrent et la comparaison bit à bit échoue.
 *
 * L'horodatage étant inclus dans la signature, un attaquant ne peut pas le
 * rajeunir pour contourner le contrôle d'âge.
 */
export function signatureWebhookValide(
  corpsBrut: string,
  signature: string | null,
  horodatage: string | null,
): boolean {
  const secret = config().secretWebhook;
  if (!secret) {
    console.error('[SASPAY] SASPAY_WEBHOOK_SECRET absent — webhook rejeté.');
    return false;
  }
  if (!signature || !horodatage) return false;

  const ts = Number(horodatage);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > TOLERANCE_SECONDES) {
    console.warn('[SASPAY] Webhook hors tolérance d\'horodatage — rejeté.');
    return false;
  }

  const attendue = createHmac('sha256', secret)
    .update(`${horodatage}.${corpsBrut}`)
    .digest('hex');

  const a = Buffer.from(signature);
  const b = Buffer.from(attendue);
  // Comparaison en temps constant : un `===` s'arrête au premier caractère
  // différent et laisse fuiter la signature attendue par mesure du temps.
  return a.length === b.length && timingSafeEqual(a, b);
}
