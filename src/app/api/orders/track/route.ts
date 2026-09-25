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
 * Le numéro et le téléphone permettent le suivi, mais ne sont pas un secret
 * vis-à-vis du livreur. Le code de remise n’est jamais retourné par le suivi.
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

    // La fonction track_order est le PORTAIL : c'est elle qui vérifie que le
    // demandeur connaît le couple numéro + téléphone. Une fois ce contrôle
    // passé, on lit les champs d'affichage directement — plutôt que de les
    // ajouter à sa signature, ce qui imposerait une migration à chaque champ
    // que l'écran veut montrer.
    //
    // `customer_phone` est renvoyé alors qu'il pourrait sembler sensible : le
    // demandeur vient précisément de prouver qu'il le connaît en le saisissant.
    // Le lui renvoyer ne lui apprend rien, et l'écran en a besoin pour les
    // liens WhatsApp.
    const { data: affichage } = await admin
      .from('orders')
      .select('customer_name, customer_phone, quantity, product_image, assigned_driver_name')
      .eq('order_number', numero)
      .maybeSingle();
    // Heure du ramassage chez le vendeur (2026-09-24). Lue à part : si la base
    // n'a pas encore la colonne, le reste du suivi s'affiche quand même.
    const { data: ramassage } = await admin
      .from('orders').select('picked_up_at').eq('order_number', numero).maybeSingle();

    return NextResponse.json({
      success: true,
      commande: {
        orderNumber: commande.order_number,
        productName: commande.product_name,
        productImage: affichage?.product_image || '',
        quantity: Number(affichage?.quantity) || 1,
        status: commande.status,
        city: commande.city,
        neighborhood: commande.neighborhood,
        landmark: commande.landmark,
        customerName: affichage?.customer_name || '',
        customerPhone: affichage?.customer_phone || '',
        driverName: affichage?.assigned_driver_name || undefined,
        totalAmount: Number(commande.total_amount) || 0,
        paymentCollected: Boolean(commande.payment_collected),
        createdAt: commande.created_at,
        deliveredAt: commande.delivered_at,
        pickedUpAt: ramassage?.picked_up_at || undefined,
      },
    });
  } catch (error: any) {
    console.error('[TRACK] Erreur:', error);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
