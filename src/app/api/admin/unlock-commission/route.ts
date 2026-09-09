import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Déblocage anticipé d'une commission par un admin — avant la fin du délai
 * de sécurité (voir supabase/migration-commission-safety-window.sql).
 *
 * L'action existait côté navigateur uniquement : l'admin voyait la commission
 * passer en « disponible » chez lui, pendant que le revendeur, lui, ne
 * pouvait toujours pas la retirer.
 */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  }

  const { commissionId } = await req.json().catch(() => ({}));
  if (!commissionId) {
    return NextResponse.json({ error: 'Commission requise.' }, { status: 400 });
  }

  // Seule une commission encore bloquée peut être débloquée : ne jamais
  // « re-débloquer » une commission déjà réservée pour un retrait ou payée,
  // ce qui la rendrait retirable une seconde fois.
  const { data, error } = await admin
    .from('commissions')
    .update({ status: 'available', available_at: new Date().toISOString(), unlock_at: null })
    .eq('id', commissionId)
    .eq('status', 'locked')
    .select('id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Commission introuvable ou déjà débloquée.' }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
