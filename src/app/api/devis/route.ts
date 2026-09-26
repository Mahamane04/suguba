import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { creerDemandeDevis, DevisError } from '@/lib/devis';
import { corpsAvecReferent } from '@/lib/reseau/attribution-commande';
import { verifyActiveSession } from '@/lib/active-session';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { rattacherDevis } from '@/lib/compte-client';

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
    // Même règle que la commande (lot B) : code du lien, sinon revendeur déjà
    // rattaché au téléphone, sinon provenance gardée sur l'appareil.
    const codeCookie = req.cookies.get('suguba_ref')?.value?.trim().toUpperCase() || null;
    const r = await creerDemandeDevis(admin, await corpsAvecReferent(demande, codeCookie), accessKey);
    // Compte client (C1) : la demande rejoint le compte de l'acheteur connecté.
    if (r.created) {
      const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value).catch(() => null);
      await rattacherDevis(admin, session, r.quoteNumber);
    }
    return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const err = e as DevisError;
    return NextResponse.json({ error: err.message || 'Service indisponible.' }, { status: err.status || 500 });
  }
}
