import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { creerCommande, OrderCreationError } from '@/lib/order-create';
import { normaliserCodeLien } from '@/lib/reseau/codes';
import { apresCommande, corpsAvecReferent } from '@/lib/reseau/attribution-commande';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * Attribution (§ 9 du cahier des charges) — appliquée AUTOUR de la création,
 * jamais dedans : `creerCommande` est une transaction commande + commission,
 * testée telle quelle, et l'attribution ne doit pas pouvoir la faire échouer.
 *
 * Deux moments :
 *   AVANT — si le client n'arrive avec aucun code revendeur mais qu'il a déjà
 *   un référent (il a cliqué sur le lien d'un revendeur la semaine dernière),
 *   la vente revient à ce référent. C'est tout l'intérêt de l'attribution :
 *   sans cela, le revendeur n'est payé que si le client commande dans la
 *   foulée du clic, ce qui n'arrive presque jamais à Bamako.
 *   APRÈS — on enregistre la conversion (compteurs du lien, du client, et
 *   progression des missions de vente).
 */

export async function POST(req: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Commande invalide.' }, { status: 400, headers }); }

  const codeLien = normaliserCodeLien(req.cookies.get('suguba_via')?.value);
  const codeCookie = req.cookies.get('suguba_ref')?.value?.trim().toUpperCase() || null;
  body = await corpsAvecReferent(body, codeCookie);

  try {
    // Qui est connecté : un prix négocié n'est accepté que du revendeur lui-même.
    const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
    const result = await creerCommande(getSupabaseAdmin(), body, req.headers.get('Idempotency-Key'), session?.uid || null);

    if (result.created) await apresCommande(result.order, codeLien);

    return NextResponse.json({ success: true, ...result }, { status: result.created ? 201 : 200, headers });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof OrderCreationError ? error.message : 'Enregistrement indisponible. Réessayez.',
      definitive: error instanceof OrderCreationError && (error.status === 400 || error.status === 409),
    }, { status: error instanceof OrderCreationError ? error.status : 503, headers });
  }
}
