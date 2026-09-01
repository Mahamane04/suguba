import { NextRequest, NextResponse } from 'next/server';
import { verifierFacture } from '@/lib/ligdicash';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Callback LigdiCash — notification de paiement.
 *
 * ⚠️ Contrairement à PayDunya (qui envoyait un hash de la clé maître dans
 * chaque notification), LigdiCash n'a AUCUN mécanisme de signature dans le
 * corps du webhook — leur propre documentation le dit explicitement : le
 * champ `token` du callback est toujours vide, et le seul moyen fiable de
 * savoir si un paiement est réellement passé est de rappeler leur endpoint
 * de vérification avec le jeton QUE NOUS AVONS STOCKÉ à la création (voir
 * /api/payments/ligdicash/create). Ne JAMAIS déclencher de mouvement
 * d'argent sur la seule foi de ce que ce webhook prétend — n'importe qui
 * connaissant l'URL peut y poster un corps arbitraire.
 *
 * LigdiCash envoie deux requêtes par événement (form-urlencoded puis JSON,
 * contenu identique) — ce n'est pas un souci d'idempotence ici puisqu'on ne
 * fait jamais confiance au corps : chaque requête déclenche sa propre
 * re-vérification, mais les gardes de statut ci-dessous (n'agir que si la
 * commande/le retrait est encore dans l'état "non traité") empêchent tout
 * double traitement, exactement comme pour l'ancien webhook PayDunya.
 *
 * Deux flux sont traités, distingués par `custom_data.type` que nous
 * plaçons nous-mêmes à la création de la facture :
 *   - `order`      : encaissement d'une commande (paiement carte diaspora)
 *   - `withdrawal` : versement d'une commission à un revendeur
 *
 * Référence : https://developers.ligdicash.com/
 */

const STATUT_PAYE = 'completed';

/** Extrait le corps, qu'il arrive en JSON ou en form-urlencoded. */
async function lireCorps(req: NextRequest): Promise<Record<string, any>> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await req.json().catch(() => ({}));
  }
  const texte = await req.text();
  const params = new URLSearchParams(texte);
  const objet: Record<string, any> = {};
  for (const [cle, valeur] of params) objet[cle] = valeur;
  return objet;
}

/** `custom_data` peut arriver en objet ({type, reference}) ou en tableau
 * (voir le format callback documenté : [{keyof_customdata, valueof_customdata}]). */
function extraireCustomData(corps: Record<string, any>): { type: string; reference: string } {
  const raw = corps.custom_data;
  if (Array.isArray(raw)) {
    const trouver = (cle: string) => raw.find((e: any) => e.keyof_customdata === cle)?.valueof_customdata || '';
    return { type: String(trouver('type')).trim(), reference: String(trouver('reference')).trim() };
  }
  if (raw && typeof raw === 'object') {
    return { type: String(raw.type || '').trim(), reference: String(raw.reference || '').trim() };
  }
  return { type: '', reference: '' };
}

export async function POST(req: NextRequest) {
  try {
    const corps = await lireCorps(req);
    const { type, reference } = extraireCustomData(corps);

    if (!type || !reference) {
      console.warn('[WEBHOOK LIGDICASH] custom_data.type/reference absent — notification ignorée.');
      return NextResponse.json({ status: 'OK', ignore: 'custom_data incomplet' });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      console.error('[WEBHOOK LIGDICASH] Supabase indisponible — paiement reçu mais non enregistré:', reference);
      return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
    }

    if (type === 'withdrawal' && reference) {
      const { data: retrait } = await admin
        .from('payouts')
        .select('id, status, payment_invoice_token')
        .eq('id', reference)
        .maybeSingle();

      if (!retrait) {
        console.warn('[WEBHOOK LIGDICASH] Retrait introuvable:', reference);
        return NextResponse.json({ status: 'OK', ignore: 'retrait inconnu' });
      }
      if (retrait.status !== 'pending' && retrait.status !== 'processing') {
        return NextResponse.json({ status: 'OK', ignore: 'déjà traité' });
      }

      const verif = await verifierFacture(retrait.payment_invoice_token || '');
      if (!verif.ok || verif.statut !== STATUT_PAYE) {
        console.warn('[WEBHOOK LIGDICASH] Vérification négative pour retrait', reference, verif);
        return NextResponse.json({ status: 'OK', ignore: `statut vérifié: ${verif.statut || verif.erreur}` });
      }

      await admin.from('payouts').update({
        status: 'completed',
        transaction_ref: `LIGDICASH-${retrait.payment_invoice_token || Date.now()}`,
        processed_at: new Date().toISOString(),
      }).eq('id', reference);

      await admin.rpc('settle_commissions_for_withdrawal', { p_withdrawal_id: reference });

      return NextResponse.json({ status: 'OK', traite: 'retrait' });
    }

    if (type === 'order' && reference) {
      const { data: commande } = await admin
        .from('orders')
        .select('order_number, status, payment_invoice_token')
        .eq('order_number', reference)
        .maybeSingle();

      if (!commande) {
        console.warn('[WEBHOOK LIGDICASH] Commande introuvable:', reference);
        return NextResponse.json({ status: 'OK', ignore: 'commande inconnue' });
      }
      if (commande.status !== 'pending_call') {
        return NextResponse.json({ status: 'OK', ignore: 'déjà traité' });
      }

      const verif = await verifierFacture(commande.payment_invoice_token || '');
      if (!verif.ok || verif.statut !== STATUT_PAYE) {
        console.warn('[WEBHOOK LIGDICASH] Vérification négative pour commande', reference, verif);
        return NextResponse.json({ status: 'OK', ignore: `statut vérifié: ${verif.statut || verif.erreur}` });
      }

      await admin.from('orders').update({
        status: 'confirmed',
        // Indispensable : sans ce marquage, la commande reste vue comme un
        // paiement à la livraison et le livreur réclamerait au client une
        // somme déjà réglée par mobile money.
        payment_collected: true,
        payment_method: 'mobile_money',
      }).eq('order_number', reference);

      return NextResponse.json({ status: 'OK', traite: 'commande' });
    }

    console.warn('[WEBHOOK LIGDICASH] custom_data.type non reconnu:', type);
    return NextResponse.json({ status: 'OK', ignore: 'type non reconnu' });
  } catch (error: any) {
    console.error('[WEBHOOK LIGDICASH] Erreur de traitement:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
