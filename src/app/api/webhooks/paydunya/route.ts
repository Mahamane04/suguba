import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * IPN PayDunya — notification de paiement confirmé.
 *
 * Endpoint distinct de /api/webhooks/momo, et non une extension de celui-ci :
 * les deux fournisseurs n'ont ni le même format ni la même authentification.
 *   - momo (CinetPay/Wave) : JSON, signature HMAC du corps dans l'en-tête `x-token`
 *   - PayDunya            : application/x-www-form-urlencoded, clés `data[...]`,
 *                           et un hash SHA-512 de la CLÉ MAÎTRE — le corps n'est
 *                           pas signé du tout.
 * Router PayDunya vers l'ancien endpoint aurait produit un rejet 401 silencieux
 * à chaque paiement.
 *
 * Deux flux sont traités, distingués par `data[custom_data][type]` que nous
 * plaçons nous-mêmes à la création de la facture :
 *   - `order`      : encaissement d'une commande (paiement carte diaspora)
 *   - `withdrawal` : versement d'une commission à un revendeur
 *
 * Références : https://developers.paydunya.com/doc/FR/http_json
 */

/** Statuts renvoyés par PayDunya. Seul `completed` engage de l'argent. */
const STATUT_PAYE = 'completed';

/**
 * Convertit le corps form-urlencoded à clés crochetées (`data[invoice][token]`)
 * en objet imbriqué. PayDunya n'envoie pas de JSON : sans cette étape, tout se
 * lit comme des clés plates et la vérification échoue.
 */
function analyserClesCrochetees(corps: string): Record<string, any> {
  const racine: Record<string, any> = {};
  for (const [cle, valeur] of new URLSearchParams(corps)) {
    const chemin = cle.replace(/\]/g, '').split('[');
    let courant = racine;
    chemin.forEach((segment, i) => {
      if (i === chemin.length - 1) {
        courant[segment] = valeur;
      } else {
        if (typeof courant[segment] !== 'object' || courant[segment] === null) {
          courant[segment] = {};
        }
        courant = courant[segment];
      }
    });
  }
  return racine;
}

/**
 * PayDunya ne signe pas le corps : il envoie le SHA-512 de notre clé maître.
 * On recalcule et on compare en temps constant. Sans clé configurée, on
 * refuse — jamais de repli permissif sur un endpoint qui déclenche des
 * mouvements d'argent.
 */
function hashValide(hashRecu: string): boolean {
  const cleMaitre = process.env.PAYDUNYA_MASTER_KEY;
  if (!cleMaitre || !hashRecu) return false;

  const attendu = createHash('sha512').update(cleMaitre).digest('hex');
  const a = Buffer.from(attendu, 'utf8');
  const b = Buffer.from(hashRecu.trim().toLowerCase(), 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.PAYDUNYA_MASTER_KEY) {
      console.error('[IPN PAYDUNYA] PAYDUNYA_MASTER_KEY absente — notification refusée.');
      return NextResponse.json({ error: 'Passerelle non configurée.' }, { status: 503 });
    }

    const corps = await req.text();
    const { data } = analyserClesCrochetees(corps);

    if (!data || !hashValide(data.hash)) {
      console.warn('[IPN PAYDUNYA] Hash invalide ou absent — notification ignorée.');
      return NextResponse.json({ error: 'Notification non authentifiée.' }, { status: 401 });
    }

    // trim() sur les valeurs qui servent de clé de recherche : une espace ou
    // un retour chariot en fin de champ ferait échouer le `.eq()` en base et
    // le paiement serait silencieusement ignoré.
    const statut = String(data.status || '').trim().toLowerCase();
    const reference = String(data.custom_data?.reference || '').trim();
    const type = String(data.custom_data?.type || '').trim();
    const jeton = String(data.invoice?.token || '').trim();

    console.log(`[IPN PAYDUNYA] type=${type} reference=${reference} statut=${statut} jeton=${jeton}`);

    // Accusé de réception immédiat pour tout ce qui n'est pas un paiement
    // abouti : PayDunya renvoie aussi PENDING et CANCELLED, qui n'ont rien à
    // déclencher côté métier mais ne doivent pas être traités comme des échecs.
    if (statut !== STATUT_PAYE) {
      return NextResponse.json({ status: 'OK', ignore: `statut ${statut}` });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      console.error('[IPN PAYDUNYA] Supabase indisponible — paiement reçu mais non enregistré:', reference);
      return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
    }

    if (type === 'withdrawal' && reference) {
      // Versement d'une commission. Idempotent : on ne solde que si le retrait
      // est encore en attente, PayDunya pouvant rejouer une notification.
      const { data: retrait } = await admin
        .from('payouts')
        .select('id, status')
        .eq('id', reference)
        .maybeSingle();

      if (!retrait) {
        console.warn('[IPN PAYDUNYA] Retrait introuvable:', reference);
        return NextResponse.json({ status: 'OK', ignore: 'retrait inconnu' });
      }

      if (retrait.status === 'pending' || retrait.status === 'processing') {
        await admin.from('payouts').update({
          status: 'completed',
          transaction_ref: `PAYDUNYA-${jeton || Date.now()}`,
          processed_at: new Date().toISOString(),
        }).eq('id', reference);

        // Sort définitivement les commissions réservées du solde du revendeur.
        await admin.rpc('settle_commissions_for_withdrawal', { p_withdrawal_id: reference });
      }

      return NextResponse.json({ status: 'OK', traite: 'retrait' });
    }

    if (type === 'order' && reference) {
      // Encaissement d'une commande (parcours diaspora payé par carte).
      // La commande passe de l'attente d'appel à confirmée : elle est déjà
      // payée, l'appel de confirmation n'a plus lieu d'être.
      const { data: commande } = await admin
        .from('orders')
        .select('order_number, status')
        .eq('order_number', reference)
        .maybeSingle();

      if (!commande) {
        console.warn('[IPN PAYDUNYA] Commande introuvable:', reference);
        return NextResponse.json({ status: 'OK', ignore: 'commande inconnue' });
      }

      if (commande.status === 'pending_call') {
        await admin.from('orders').update({
          status: 'confirmed',
          // Indispensable : sans ce marquage, la commande reste vue comme un
          // paiement à la livraison et le livreur réclamerait au client une
          // somme déjà réglée par carte.
          payment_collected: true,
          payment_method: 'mobile_money',
        }).eq('order_number', reference);
      }

      return NextResponse.json({ status: 'OK', traite: 'commande' });
    }

    console.warn('[IPN PAYDUNYA] custom_data.type non reconnu:', type);
    return NextResponse.json({ status: 'OK', ignore: 'type non reconnu' });
  } catch (error: any) {
    console.error('[IPN PAYDUNYA] Erreur de traitement:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
