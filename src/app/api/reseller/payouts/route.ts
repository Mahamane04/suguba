import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { retraitAffiche } from '@/lib/retraits-affichage';
import { lotCAbsent } from '@/lib/gains-fournisseur';

/**
 * Historique RÉEL des retraits du revendeur connecté (2026-09-11).
 *
 * La page des gains affichait les retraits des données de démonstration :
 * « Total déjà retiré & reçu : 184 000 FCFA » pour un compte qui n'avait
 * jamais rien vendu.
 *
 * Lot C (2026-09-27) : une même personne peut être revendeur ET fournisseur.
 * Seuls ses retraits de revendeur apparaissent ici.
 */
export async function GET(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'reseller') {
    return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ retraits: [] });

  const lire = (seulementRevendeur: boolean) => {
    let q = admin.from('payouts').select('*').eq('reseller_id', session.uid);
    if (seulementRevendeur) q = q.eq('beneficiaire', 'revendeur');
    return q.order('created_at', { ascending: false }).limit(50);
  };
  let { data, error } = await lire(true);
  // SQL du lot C pas encore exécuté : pas de colonne, donc aucun retrait fournisseur à écarter.
  if (error && lotCAbsent(error)) ({ data, error } = await lire(false));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ retraits: (data || []).map(retraitAffiche) });
}
