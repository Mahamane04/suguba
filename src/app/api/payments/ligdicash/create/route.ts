import { NextRequest, NextResponse } from 'next/server';
import { creerFacture } from '@/lib/ligdicash';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Crée une facture LigdiCash pour une commande existante et renvoie l'URL de
 * paiement.
 *
 * ⚠️ Le montant n'est JAMAIS lu depuis la requête : il est relu en base à
 * partir du seul numéro de commande. Accepter un montant fourni par le
 * navigateur laisserait n'importe qui régler 100 F une commande de 216 500 F.
 * Même principe que la résolution du revendeur dans /api/orders/sync.
 */
export async function POST(req: NextRequest) {
  try {
    const { orderNumber } = await req.json().catch(() => ({}));
    if (!orderNumber || typeof orderNumber !== 'string') {
      return NextResponse.json({ error: 'Numéro de commande requis.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
    }

    const { data: commande } = await admin
      .from('orders')
      .select('order_number, product_name, quantity, total_amount, status, payment_collected, customer_name')
      .eq('order_number', orderNumber.trim())
      .maybeSingle();

    if (!commande) {
      return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
    }

    // Ne jamais refacturer ce qui est déjà payé : un second lien de paiement
    // sur une commande encaissée ferait payer le client deux fois.
    if (commande.payment_collected) {
      return NextResponse.json({ error: 'Cette commande est déjà payée.' }, { status: 409 });
    }
    if (commande.status === 'cancelled' || commande.status === 'returned') {
      return NextResponse.json({ error: 'Cette commande n\'est plus payable.' }, { status: 409 });
    }

    const montant = Number(commande.total_amount);
    if (!Number.isFinite(montant) || montant <= 0) {
      return NextResponse.json({ error: 'Montant de commande invalide.' }, { status: 422 });
    }

    const quantite = Number(commande.quantity) || 1;
    const [prenom, ...resteNom] = (commande.customer_name || '').trim().split(/\s+/);
    const resultat = await creerFacture({
      type: 'order',
      reference: commande.order_number,
      montantTotal: montant,
      description: `Commande Suguba ${commande.order_number}`,
      lignes: [{
        name: commande.product_name,
        quantity: quantite,
        unit_price: Math.round(montant / quantite),
        total_price: montant,
      }],
      urlRetour: `https://app.sugubaml.com/order-success/${commande.order_number}`,
      urlAnnulation: `https://app.sugubaml.com/p`,
      clientPrenom: prenom || undefined,
      clientNom: resteNom.join(' ') || undefined,
    });

    if (!resultat.ok) {
      // Le détail (noms de variables manquantes, message brut de LigdiCash)
      // reste dans les journaux serveur : l'acheteur n'a pas à lire
      // « LIGDICASH_API_KEY », et exposer la configuration interne à un
      // visiteur n'aide personne.
      console.error('[LIGDICASH create] Échec pour', commande.order_number, ':', resultat.erreur);
      return NextResponse.json(
        { error: 'Le paiement en ligne est momentanément indisponible. Réessayez dans quelques minutes.' },
        { status: 502 }
      );
    }

    // Indispensable pour la vérification côté webhook : voir le commentaire
    // en tête de src/lib/ligdicash.ts. Sans cette écriture, le webhook
    // n'aurait aucun jeton de confiance à rappeler.
    await admin.from('orders').update({ payment_invoice_token: resultat.jeton }).eq('order_number', commande.order_number);

    return NextResponse.json({
      success: true,
      urlPaiement: resultat.urlPaiement,
      jeton: resultat.jeton,
    });
  } catch (error: any) {
    console.error('[LIGDICASH create] Erreur:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
