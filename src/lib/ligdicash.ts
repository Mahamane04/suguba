/**
 * Client LigdiCash — création et vérification de factures de paiement (Payin).
 *
 * Serveur uniquement : les deux clés d'API donnent le droit d'encaisser au
 * nom de Suguba, elles ne doivent jamais atteindre le navigateur. Ne jamais
 * importer ce fichier depuis un composant 'use client'.
 *
 * ⚠️ Contrairement à PayDunya (dont ce module prend la suite), LigdiCash ne
 * signe pas le corps de sa notification webhook — voir
 * src/app/api/webhooks/ligdicash/route.ts. La seule vérification fiable est
 * de rappeler `verifierFacture()` avec le jeton que NOUS avons stocké à la
 * création (jamais celui reçu dans le webhook). D'où `creerFacture` qui
 * renvoie ce jeton : l'appelant doit le conserver (voir migration-ligdicash.sql,
 * colonne `payment_invoice_token` sur `orders`/`payouts`) pour pouvoir
 * re-vérifier plus tard.
 *
 * LigdiCash n'a pas de sandbox : les clés fournies sont toujours celles d'un
 * compte réel (même en intégration). Voir https://developers.ligdicash.com/
 */

const BASE_URL = 'https://app.ligdicash.com/pay/v01';

const CODE_SUCCES = '00';

export interface LigneFacture {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface DemandeFacture {
  /** Distingue les deux flux à la réception du callback. */
  type: 'order' | 'withdrawal';
  /** order_number pour une commande, id de retrait pour un versement. */
  reference: string;
  montantTotal: number;
  description: string;
  lignes: LigneFacture[];
  urlRetour: string;
  urlAnnulation: string;
  clientPrenom?: string;
  clientNom?: string;
  clientEmail?: string;
}

export interface ResultatFacture {
  ok: boolean;
  urlPaiement?: string;
  jeton?: string;
  erreur?: string;
}

export type StatutFacture = 'completed' | 'pending' | 'notcompleted';

export interface ResultatVerification {
  ok: boolean;
  statut?: StatutFacture;
  montant?: number;
  erreur?: string;
}

function config() {
  const apiKey = process.env.LIGDICASH_API_KEY;
  const apiToken = process.env.LIGDICASH_API_TOKEN;

  const manquantes = [
    !apiKey && 'LIGDICASH_API_KEY',
    !apiToken && 'LIGDICASH_API_TOKEN',
  ].filter(Boolean) as string[];

  return { apiKey, apiToken, manquantes };
}

/** Noms de variables manquantes (jamais leurs valeurs — ce sont des secrets). */
export function configurationManquante(): string[] {
  return config().manquantes;
}

function headers(c: ReturnType<typeof config>) {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Apikey': c.apiKey!,
    'Authorization': `Bearer ${c.apiToken}`,
  };
}

export async function creerFacture(d: DemandeFacture): Promise<ResultatFacture> {
  const c = config();
  if (c.manquantes.length > 0) {
    return { ok: false, erreur: `Configuration LigdiCash incomplète : ${c.manquantes.join(', ')}` };
  }

  const corps = {
    commande: {
      invoice: {
        items: d.lignes,
        total_amount: d.montantTotal,
        devise: 'XOF',
        description: d.description,
        customer: '',
        customer_firstname: d.clientPrenom || '',
        customer_lastname: d.clientNom || '',
        customer_email: d.clientEmail || '',
        external_id: d.reference,
        otp: '',
      },
      store: {
        name: 'Suguba',
        website_url: 'https://app.sugubaml.com',
      },
      actions: {
        cancel_url: d.urlAnnulation,
        return_url: d.urlRetour,
        callback_url: 'https://app.sugubaml.com/api/webhooks/ligdicash',
      },
      // Renvoyé tel quel dans le callback (custom_data) : c'est ce qui permet
      // de rattacher le paiement à la bonne commande/au bon retrait sans
      // jamais faire confiance à un identifiant venu du navigateur.
      custom_data: {
        type: d.type,
        reference: d.reference,
      },
    },
  };

  try {
    const res = await fetch(`${BASE_URL}/redirect/checkout-invoice/create`, {
      method: 'POST',
      headers: headers(c),
      body: JSON.stringify(corps),
    });

    const json: any = await res.json().catch(() => ({}));

    // LigdiCash répond par response_code, pas seulement par le statut HTTP.
    if (json.response_code !== CODE_SUCCES) {
      console.error('[LIGDICASH] Création de facture refusée:', json.response_code, json.response_text);
      return { ok: false, erreur: json.response_text || 'Facture refusée par LigdiCash.' };
    }

    return { ok: true, urlPaiement: json.response_text, jeton: json.token };
  } catch (error: any) {
    console.error('[LIGDICASH] Erreur réseau:', error);
    return { ok: false, erreur: 'LigdiCash injoignable.' };
  }
}

/**
 * Seule source de vérité sur l'état réel d'un paiement : à appeler avec le
 * jeton STOCKÉ PAR NOUS à la création (jamais un jeton lu dans le corps d'un
 * webhook, qui n'est pas signé et donc pas fiable).
 */
export async function verifierFacture(invoiceToken: string): Promise<ResultatVerification> {
  const c = config();
  if (c.manquantes.length > 0) {
    return { ok: false, erreur: `Configuration LigdiCash incomplète : ${c.manquantes.join(', ')}` };
  }
  if (!invoiceToken) {
    return { ok: false, erreur: 'Jeton de facture manquant.' };
  }

  try {
    const res = await fetch(`${BASE_URL}/redirect/checkout-invoice/confirm?invoiceToken=${encodeURIComponent(invoiceToken)}`, {
      method: 'GET',
      headers: headers(c),
    });
    const json: any = await res.json().catch(() => ({}));

    if (json.response_code !== CODE_SUCCES) {
      return { ok: false, erreur: json.response_text || 'Vérification refusée par LigdiCash.' };
    }

    return { ok: true, statut: json.status as StatutFacture, montant: Number(json.amount ?? json.montant ?? 0) };
  } catch (error: any) {
    console.error('[LIGDICASH] Erreur réseau (vérification):', error);
    return { ok: false, erreur: 'LigdiCash injoignable.' };
  }
}
