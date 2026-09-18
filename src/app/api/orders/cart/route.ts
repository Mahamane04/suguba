import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { OrderCreationError } from '@/lib/order-create';
import { creerPanier } from '@/lib/cart-create';
import { normaliserCodeLien } from '@/lib/reseau/codes';
import { apresCommande, corpsAvecReferent } from '@/lib/reseau/attribution-commande';

export const runtime = 'nodejs';

/**
 * Création d'un panier multi-articles — publique comme /api/orders/create
 * (le client n'a pas besoin de compte), avec clé de reprise `Idempotency-Key`.
 * Même attribution revendeur qu'une commande seule.
 */
export async function POST(req: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Panier invalide.' }, { status: 400, headers }); }

  const codeLien = normaliserCodeLien(req.cookies.get('suguba_via')?.value);
  const codeCookie = req.cookies.get('suguba_ref')?.value?.trim().toUpperCase() || null;
  body = await corpsAvecReferent(body, codeCookie);

  try {
    const resultat = await creerPanier(getSupabaseAdmin(), body, req.headers.get('Idempotency-Key'));
    if (resultat.created) {
      for (const commande of resultat.orders) await apresCommande(commande, codeLien);
    }
    return NextResponse.json({ success: true, ...resultat }, { status: resultat.created ? 201 : 200, headers });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof OrderCreationError ? error.message : 'Enregistrement indisponible. Réessayez.',
      definitive: error instanceof OrderCreationError && (error.status === 400 || error.status === 409),
    }, { status: error instanceof OrderCreationError ? error.status : 503, headers });
  }
}
