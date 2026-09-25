import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { DevisError, lireDevisClient } from '@/lib/devis';

/** Devis du client (2026-09-26) : seulement avec la clé gardée sur son téléphone. */
export async function POST(req: NextRequest) {
  const { numero, accessKey } = await req.json().catch(() => ({}));
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible. Réessayez.' }, { status: 503 });
  try {
    return NextResponse.json({ devis: await lireDevisClient(admin, numero, accessKey) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const err = e as DevisError;
    return NextResponse.json({ error: err.message || 'Service indisponible.' }, { status: err.status || 500 });
  }
}
