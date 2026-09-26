import { NextRequest, NextResponse } from 'next/server';
import { sessionDeLaRequete } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { CompteError, gererDestinataire, mesDestinataires } from '@/lib/compte-client';

/**
 * Destinataires enregistrés (2026-09-26, compte client — C2) : « Pour moi »
 * (coordonnées du compte) et les proches pour qui le client commande.
 * GET → { moi, destinataires } ; POST { action: 'ajouter' | 'modifier' | 'supprimer', id?, destinataire? }
 */
export async function GET(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ error: 'Connectez-vous.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ destinataires: [] });
  try {
    return NextResponse.json(await mesDestinataires(admin, session.uid), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof CompteError ? e.status : 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ error: 'Connectez-vous.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  const corps = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await gererDestinataire(admin, session.uid, corps));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof CompteError ? e.status : 500 });
  }
}
