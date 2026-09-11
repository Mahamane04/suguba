import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const LIBELLE_MOYEN: Record<string, string> = {
  orange_money: 'Orange Money',
  moov: 'Moov Money',
  mobi_cash: 'Mobi Cash',
  cash: 'Espèces au guichet',
  wave: 'Wave',
};

/**
 * Historique RÉEL des retraits du revendeur connecté (2026-09-11).
 *
 * La page des gains affichait les retraits des données de démonstration :
 * « Total déjà retiré & reçu : 184 000 FCFA » pour un compte qui n'avait
 * jamais rien vendu.
 */
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'reseller') {
    return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ retraits: [] });

  const { data, error } = await admin
    .from('payouts')
    .select('*')
    .eq('reseller_id', session.uid)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    retraits: (data || []).map((p) => ({
      id: p.id,
      montant: Number(p.amount) || 0,
      moyen: LIBELLE_MOYEN[p.payment_method] || p.payment_method || '—',
      telephone: p.phone_number || '',
      statut: p.status,
      reference: p.payment_transaction_id || null,
      creeLe: p.created_at,
    })),
  });
}
