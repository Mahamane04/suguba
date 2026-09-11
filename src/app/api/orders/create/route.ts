import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { creerCommande, OrderCreationError } from '@/lib/order-create';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Commande invalide.' }, { status: 400, headers }); }
  try {
    const result = await creerCommande(getSupabaseAdmin(), body, req.headers.get('Idempotency-Key'));
    return NextResponse.json({ success: true, ...result }, { status: result.created ? 201 : 200, headers });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof OrderCreationError ? error.message : 'Enregistrement indisponible. Réessayez.',
      definitive: error instanceof OrderCreationError && (error.status === 400 || error.status === 409),
    }, { status: error instanceof OrderCreationError ? error.status : 503, headers });
  }
}
