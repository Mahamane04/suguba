import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { libererCommissionsEchues } from '@/lib/commissions';

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

  // Libère d'abord les commissions dont le délai de sécurité est écoulé,
  // sinon le solde affiché serait en retard sur ce qui est réellement
  // retirable (voir src/lib/commissions.ts).
  await libererCommissionsEchues(admin);

  const { data, error } = await admin
    .from('commissions')
    .select('amount, status')
    .eq('reseller_id', session.uid)
    .in('status', ['pending', 'locked', 'available', 'reserved']);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const availableBalance = (data || [])
    .filter((c) => c.status === 'available')
    .reduce((sum, c) => sum + Number(c.amount), 0);
  // `locked` compte comme en attente du point de vue du revendeur : la vente
  // est faite, l'argent est acquis, mais le délai de sécurité court encore.
  const pendingBalance = (data || [])
    .filter((c) => c.status === 'pending' || c.status === 'locked')
    .reduce((sum, c) => sum + Number(c.amount), 0);
  const reservedBalance = (data || [])
    .filter((c) => c.status === 'reserved')
    .reduce((sum, c) => sum + Number(c.amount), 0);

  return NextResponse.json({ availableBalance, pendingBalance, reservedBalance, cloud: true });
}
