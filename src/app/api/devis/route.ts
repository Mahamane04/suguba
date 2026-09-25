import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { creerDemandeDevis, DevisError } from '@/lib/devis';

/**
 * Demande de devis d'un client, sans compte (2026-09-26, lot 1b). Publique,
 * comme la création de commande : l'accès ultérieur passe par la clé secrète
 * générée par le téléphone du client (seul son hash est stocké). Anti-abus :
 * une demande ouverte par offre et par numéro, cinq au total.
 */
export async function POST(req: NextRequest) {
  const { demande, accessKey } = await req.json().catch(() => ({}));
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible. Réessayez.' }, { status: 503 });
  try {
    const r = await creerDemandeDevis(admin, demande, accessKey);
    return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const err = e as DevisError;
    return NextResponse.json({ error: err.message || 'Service indisponible.' }, { status: err.status || 500 });
  }
}
