import { NextRequest, NextResponse } from 'next/server';
import { smsGateway } from '@/lib/sms-gateway';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Envoie au client le SMS contenant son code secret de livraison.
 *
 * Cette route est publique par nécessité : elle est appelée juste après une
 * commande passée depuis /p/[slug] par un acheteur qui n'a pas de compte.
 * Elle ne peut donc pas être protégée par une session — c'est le contenu de
 * la requête qu'il faut verrouiller.
 *
 * ── Ce qu'elle acceptait avant ───────────────────────────────────────────
 * `toPhone`, `deliveryOtp`, `totalAmount` et `productName`, tous fournis par
 * le navigateur. N'importe qui pouvait donc faire envoyer, aux frais de
 * Suguba et sous son nom, un SMS de son choix à un numéro de son choix :
 *   « Suguba: votre commande #X. Montant a payer: 500 000 FCFA.
 *     Votre CODE SECRET DE LIVRAISON est: 1234. »
 * Un hameçonnage crédible, signé Suguba, et une facture SMS ouverte.
 *
 * ── Ce qu'elle accepte maintenant ────────────────────────────────────────
 * Le seul numéro de commande. Téléphone, code, montant et produit sont relus
 * en base. Le corps de la requête ne décide plus ni du destinataire ni du
 * contenu — au pire, un attaquant fait renvoyer à un vrai client son propre
 * code, sur son propre numéro.
 *
 * Deux garde-fous limitent même ce renvoi :
 *   - seules les commandes encore en `pending_call` sont concernées ;
 *   - et seulement dans les 30 minutes suivant leur création.
 * Au-delà, le SMS n'a plus de raison d'être : le service client a rappelé.
 */

/** Une commande plus ancienne que ce délai n'a plus à déclencher de SMS. */
const FENETRE_MINUTES = 30;

export async function POST(req: NextRequest) {
  try {
    const { orderNumber } = await req.json().catch(() => ({}));
    if (!orderNumber || typeof orderNumber !== 'string') {
      return NextResponse.json({ error: 'Numéro de commande requis.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      // Pas de Supabase : la commande n'existe que dans le navigateur, aucun
      // SMS ne peut être envoyé en confiance. Ce n'est pas une erreur.
      return NextResponse.json({ success: false, raison: 'base indisponible' });
    }

    const { data: commande } = await admin
      .from('orders')
      .select('order_number, product_name, customer_phone, delivery_otp, total_amount, status, created_at')
      .eq('order_number', orderNumber.trim())
      .maybeSingle();

    // Réponse volontairement identique quelle que soit la raison du refus :
    // distinguer « commande inconnue » de « commande trop ancienne »
    // permettrait de deviner quels numéros de commande existent.
    const refus = NextResponse.json({ success: false });

    if (!commande) return refus;
    if (commande.status !== 'pending_call') return refus;
    if (!commande.customer_phone || !commande.delivery_otp) return refus;

    const ageMinutes = (Date.now() - new Date(commande.created_at).getTime()) / 60000;
    if (!Number.isFinite(ageMinutes) || ageMinutes > FENETRE_MINUTES) return refus;

    const resultat = await smsGateway.sendDeliveryOtpSms({
      toPhone: commande.customer_phone,
      orderNumber: commande.order_number,
      productName: commande.product_name || 'Article Suguba',
      deliveryOtp: commande.delivery_otp,
      totalAmount: Number(commande.total_amount) || 0,
    });

    // Ni le code ni le numéro ne sont renvoyés : l'appelant n'a pas à les
    // connaître, et cette route est publique.
    return NextResponse.json({
      success: resultat.success,
      provider: resultat.provider,
      sentAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API SMS ERROR]', error);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
