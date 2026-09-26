import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { deciderMessage, messagesAVerifier, MessageError } from '@/lib/messagerie';

/**
 * Messages à vérifier (2026-09-26, Protection Suguba — lot 3) : un numéro, un
 * lien, une adresse e-mail ou une invitation à traiter hors Suguba. L'équipe
 * les remet (« Publier ») ou les refuse avec un motif que l'auteur voit.
 */
export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/messages');
  if (refus) return refus;
  if (!(await sessionAvecRole(req, 'admin'))) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ messages: [] });
  try {
    return NextResponse.json(await messagesAVerifier(admin), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof MessageError ? e.status : 500 });
  }
}

export async function POST(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'POST /api/admin/messages');
  if (refus) return refus;
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  const corps = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await deciderMessage(admin, session.uid, corps));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof MessageError ? e.status : 500 });
  }
}
