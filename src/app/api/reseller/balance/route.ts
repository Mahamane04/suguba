import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Solde réel du revendeur authentifié — somme des commissions au statut
 * "available" dans le grand-livre serveur (voir supabase/schema.sql). Sert
 * de vérité pour /api/payouts/create ; exposée ici séparément pour que
 * l'interface puisse un jour afficher ce chiffre réel au lieu du solde de
 * démo actuellement calculé côté client (sugubaStore).
 */
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'reseller') {
    return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ availableBalance: 0, pendingBalance: 0, cloud: false });
  }

  const { data, error } = await admin
    .from('commissions')
    .select('amount, status')
    .eq('reseller_id', session.uid)
    .in('status', ['pending', 'available', 'reserved']);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const availableBalance = (data || [])
    .filter((c) => c.status === 'available')
    .reduce((sum, c) => sum + Number(c.amount), 0);
  const pendingBalance = (data || [])
    .filter((c) => c.status === 'pending')
    .reduce((sum, c) => sum + Number(c.amount), 0);
  const reservedBalance = (data || [])
    .filter((c) => c.status === 'reserved')
    .reduce((sum, c) => sum + Number(c.amount), 0);

  return NextResponse.json({ availableBalance, pendingBalance, reservedBalance, cloud: true });
}
