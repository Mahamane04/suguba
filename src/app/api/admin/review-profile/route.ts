import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Approuve ou rejette un dossier d'inscription (revendeur/fournisseur/
 * livreur/diaspora) — réservé aux sessions admin. Le compte concerné ne
 * devient exploitable qu'après ce passage, jamais automatiquement.
 */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase non configuré sur cet environnement.' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { profileId, decision } = body as { profileId?: string; decision?: 'approve' | 'reject' };

    if (!profileId || !['approve', 'reject'].includes(decision || '')) {
      return NextResponse.json({ error: 'profileId et decision (approve|reject) requis.' }, { status: 400 });
    }

    const nextStatus = decision === 'approve' ? 'active' : 'rejected';
    const { error } = await admin.from('profiles').update({ status: nextStatus }).eq('id', profileId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: nextStatus });
  } catch (error: any) {
    console.error('[API review-profile ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur.' }, { status: 500 });
  }
}
