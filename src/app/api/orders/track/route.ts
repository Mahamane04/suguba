import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { normaliserNumeroCommande } from '@/lib/order-number';

/**
 * Suivi de commande pour un client sans compte, depuis n'importe quel appareil.
 *
 * Publique par nécessité : l'acheteur qui commande depuis /p/[slug] n'a pas de
 * compte, et c'est tout l'intérêt du parcours. C'est donc le CONTENU de la
 * requête qui fait l'authentification : numéro de commande ET téléphone exact.
 *
 * ── Pourquoi le code de livraison est renvoyé ────────────────────────────
 * Le client en a besoin devant sa porte. Le lui refuser ici oblige à le lui
 * envoyer par SMS payant, ou à le lui faire perdre. Trois raisons de juger
 * l'exposition acceptable :
 *   1. deux facteurs, dont le numéro de commande à 6,5 × 10¹¹ combinaisons
 *      depuis le nouveau format (voir src/lib/order-number.ts) ;
 *   2. les tentatives infructueuses sont limitées, ci-dessous ;
 *   3. le code seul ne sert à rien : il faut aussi être au bon endroit, au bon
 *      moment, et recevoir le colis des mains du livreur.
 * Une commande déjà livrée ne renvoie plus le code — il n'a plus d'usage.
 *
 * ── La limitation ────────────────────────────────────────────────────────
 * Elle porte sur le NUMÉRO DE COMMANDE, pas sur l'IP : derrière un opérateur
 * mobile malien, des milliers d'abonnés partagent la même adresse, et limiter
 * par IP punirait les innocents en laissant passer l'attaquant.
 *
 * Fenêtre glissante, jamais de verrouillage définitif : quelqu'un qui connaît
 * un numéro de commande pourrait sinon bloquer indéfiniment le suivi de son
 * propriétaire légitime.
 */

const MAX_TENTATIVES = 5;
const FENETRE_MINUTES = 15;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const numero = normaliserNumeroCommande(String(body.orderNumber || ''));
    const telephoneBrut = String(body.phone || '').trim();

    if (!numero || !telephoneBrut) {
      return NextResponse.json({ error: 'Numéro de commande et téléphone requis.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
    }

    const depuis = new Date(Date.now() - FENETRE_MINUTES * 60_000).toISOString();
    const { count } = await admin
      .from('track_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('order_number', numero)
      .gte('attempted_at', depuis);

    if ((count ?? 0) >= MAX_TENTATIVES) {
      return NextResponse.json(
        { error: `Trop de tentatives. Réessayez dans ${FENETRE_MINUTES} minutes.` },
        { status: 429 },
      );
    }

    // Le client tape « 70 12 34 56 », « +223 70123456 » ou « 22370123456 ».
    // On interroge les trois écritures plutôt que de lui reprocher un format
    // qu'il n'a jamais eu à apprendre — la base stocke ce que le formulaire de
    // commande a reçu, sans normalisation.
    const chiffres = telephoneBrut.replace(/\D/g, '');
    const local = chiffres.replace(/^223/, '');
    const variantes = Array.from(new Set([telephoneBrut, local, `+223${local}`, `223${local}`]));

    let commande: any = null;
    for (const variante of variantes) {
      const { data } = await admin.rpc('track_order', {
        p_order_number: numero,
        p_customer_phone: variante,
      });
      if (Array.isArray(data) && data.length > 0) {
        commande = data[0];
        break;
      }
    }

    if (!commande) {
      await admin.from('track_attempts').insert({ order_number: numero });
      // Réponse volontairement identique que la commande n'existe pas ou que
      // le téléphone ne corresponde pas : distinguer les deux confirmerait
      // l'existence d'un numéro de commande à qui le devine.
      return NextResponse.json({ error: 'Commande introuvable avec ces informations.' }, { status: 404 });
    }

    // Succès : on efface l'ardoise, un client qui s'est trompé deux fois avant
    // de réussir ne doit pas rester pénalisé.
    await admin.from('track_attempts').delete().eq('order_number', numero);

    return NextResponse.json({
      success: true,
      commande: {
        orderNumber: commande.order_number,
        productName: commande.product_name,
        status: commande.status,
        city: commande.city,
        neighborhood: commande.neighborhood,
        landmark: commande.landmark,
        totalAmount: Number(commande.total_amount) || 0,
        paymentCollected: Boolean(commande.payment_collected),
        deliveryOtp: commande.delivery_otp,
        createdAt: commande.created_at,
        deliveredAt: commande.delivered_at,
      },
    });
  } catch (error: any) {
    console.error('[TRACK] Erreur:', error);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
