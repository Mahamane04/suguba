import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/** Toutes les boutiques (§ page 44) : lecture et modération (masquer, suspendre). */

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'boutique.lire'))) return NextResponse.json({ error: 'Votre rôle ne donne pas accès aux boutiques.' }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ boutiques: [] });
  const { data, error } = await admin.from('stores')
    .select('id, slug, name, owner_type, status, followers_count, is_recruiting, logo_url, created_at')
    .order('created_at', { ascending: false }).limit(500);
  if (error) return NextResponse.json({ boutiques: [], disponible: false });
  return NextResponse.json({
    disponible: true,
    boutiques: (data || []).map((b: any) => ({
      id: b.id, slug: b.slug, nom: b.name, type: b.owner_type, statut: b.status,
      abonnes: Number(b.followers_count) || 0, recrute: Boolean(b.is_recruiting), logo: b.logo_url, creeLe: b.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'boutique.moderer'))) return NextResponse.json({ error: 'Votre rôle ne permet pas de modérer une boutique.' }, { status: 403 });
  const { id, statut } = await req.json().catch(() => ({}));
  if (typeof id !== 'string' || !['active', 'hidden', 'suspended'].includes(statut)) return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { error } = (await admin?.from('stores').update({ status: statut, updated_at: new Date().toISOString() }).eq('id', id)) || { error: { message: 'Base indisponible.' } };
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
