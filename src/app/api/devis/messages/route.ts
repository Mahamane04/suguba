import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { envoyer, filDuClient, lireFil, MessageError } from '@/lib/messagerie';

/**
 * Messages du devis, côté client sans compte (2026-09-26, Protection Suguba
 * — lot 3) : seulement avec la clé gardée sur le téléphone qui a demandé le
 * devis. La clé voyage dans le corps de la requête, jamais dans l'adresse.
 *
 * POST { numero, accessKey, action: 'lire' | 'envoyer', texte? }
 */
export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible. Réessayez.' }, { status: 503 });
  const { numero, accessKey, action, texte } = await req.json().catch(() => ({}));
  try {
    const { id } = await filDuClient(admin, numero, accessKey);
    const client = { type: 'client' as const, id: null };
    if (action === 'envoyer') return NextResponse.json(await envoyer(admin, id, client, texte, true));
    return NextResponse.json(await lireFil(admin, id, client, true), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof MessageError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Messagerie indisponible. Réessayez.' }, { status: 500 });
  }
}
