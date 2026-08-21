/**
 * Client PayDunya — création de factures de paiement (Payin).
 *
 * Serveur uniquement : les trois clés d'API donnent le droit d'encaisser au
 * nom de Suguba, elles ne doivent jamais atteindre le navigateur. Ne jamais
 * importer ce fichier depuis un composant 'use client'.
 *
 * Le mode sandbox et le mode live n'ont pas la même URL de base mais partagent
 * la même clé maître (voir le tableau de bord PayDunya) : passer en production
 * ne change que PAYDUNYA_MODE, la clé privée et le token.
 *
 * Référence : https://developers.paydunya.com/doc/FR/http_json
 */

const BASE_SANDBOX = 'https://app.paydunya.com/sandbox-api/v1';
const BASE_LIVE = 'https://app.paydunya.com/api/v1';

/** PayDunya signale le succès par ce code, pas par le statut HTTP. */
const CODE_SUCCES = '00';

export interface LigneFacture {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface DemandeFacture {
  /** Distingue les deux flux à la réception de l'IPN. */
  type: 'order' | 'withdrawal';
  /** order_number pour une commande, id de retrait pour un versement. */
  reference: string;
  montantTotal: number;
  description: string;
  lignes: LigneFacture[];
  /** Où renvoyer l'acheteur après le paiement. */
  urlRetour: string;
  urlAnnulation: string;
}

export interface ResultatFacture {
  ok: boolean;
  urlPaiement?: string;
  jeton?: string;
  erreur?: string;
}

function config() {
  const master = process.env.PAYDUNYA_MASTER_KEY;
  const privee = process.env.PAYDUNYA_PRIVATE_KEY;
  const token = process.env.PAYDUNYA_TOKEN;
  const mode = (process.env.PAYDUNYA_MODE || 'test').toLowerCase();

  const manquantes = [
    !master && 'PAYDUNYA_MASTER_KEY',
    !privee && 'PAYDUNYA_PRIVATE_KEY',
    !token && 'PAYDUNYA_TOKEN',
  ].filter(Boolean) as string[];

  return {
    master, privee, token,
    base: mode === 'live' ? BASE_LIVE : BASE_SANDBOX,
    mode,
    manquantes,
  };
}

/** Noms de variables manquantes (jamais leurs valeurs — ce sont des secrets). */
export function configurationManquante(): string[] {
  return config().manquantes;
}

export async function creerFacture(d: DemandeFacture): Promise<ResultatFacture> {
  const c = config();
  if (c.manquantes.length > 0) {
    return { ok: false, erreur: `Configuration PayDunya incomplète : ${c.manquantes.join(', ')}` };
  }

  const corps = {
    invoice: {
      items: d.lignes,
      description: d.description,
      total_amount: d.montantTotal,
    },
    store: {
      name: 'Suguba',
      tagline: 'Vendre sans stock',
      websiteURL: 'https://app.sugubaml.com',
    },
    // Renvoyé tel quel dans l'IPN (data[custom_data][...]) : c'est ce qui
    // permet de rattacher le paiement à la bonne commande ou au bon retrait
    // sans jamais faire confiance à un identifiant venu du navigateur.
    custom_data: {
      type: d.type,
      reference: d.reference,
    },
    actions: {
      return_url: d.urlRetour,
      cancel_url: d.urlAnnulation,
      callback_url: 'https://app.sugubaml.com/api/webhooks/paydunya',
    },
  };

  try {
    const res = await fetch(`${c.base}/checkout-invoice/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PAYDUNYA-MASTER-KEY': c.master!,
        'PAYDUNYA-PRIVATE-KEY': c.privee!,
        'PAYDUNYA-TOKEN': c.token!,
      },
      body: JSON.stringify(corps),
    });

    const json: any = await res.json().catch(() => ({}));

    // PayDunya répond 200 même en cas de refus : c'est response_code qui fait
    // foi, pas le statut HTTP. Se fier à res.ok laisserait passer les erreurs.
    if (json.response_code !== CODE_SUCCES) {
      console.error('[PAYDUNYA] Création de facture refusée:', json.response_code, json.response_text);
      return { ok: false, erreur: json.response_text || 'Facture refusée par PayDunya.' };
    }

    return { ok: true, urlPaiement: json.response_text, jeton: json.token };
  } catch (error: any) {
    console.error('[PAYDUNYA] Erreur réseau:', error);
    return { ok: false, erreur: 'PayDunya injoignable.' };
  }
}
