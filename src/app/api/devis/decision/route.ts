import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { deciderDevisClient, DevisError } from '@/lib/devis';

/**
 * Le client accepte ou refuse son devis (2026-09-26). Accepter crée la
 * commande au prix figé du devis ; la clé du devis devient celle du reçu.
 */
export async function POST(req: NextRequest) {
  const { numero, accessKey, decision } = await req.json().catch(() => ({}));
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible. Réessayez.' }, { status: 503 });
  try {
    return NextResponse.json(await deciderDevisClient(admin, numero, accessKey, decision), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const err = e as DevisError;
    return NextResponse.json({ error: err.message || 'Service indisponible.' }, { status: err.status || 500 });
  }
}
