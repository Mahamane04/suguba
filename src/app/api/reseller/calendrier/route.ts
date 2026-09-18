import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { estCanal } from '@/lib/reseau/codes';

/**
 * Calendrier de publication du revendeur (§ 13 des écrans).
 *
 * Suguba planifie et rappelle ; elle ne publie jamais à la place du
 * revendeur (voir migration-reseau-v2.sql) — un envoi automatique depuis son
 * numéro WhatsApp le ferait bannir.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ publications: [], missions: [] });

  const depuis = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const { data: publications, error } = await admin
    .from('scheduled_posts')
    .select('*')
    .eq('reseller_id', session.uid)
    .gte('planned_for', depuis)
    .order('planned_for', { ascending: true })
    .limit(200);

  // Les échéances des missions suivies apparaissent dans le même calendrier.
  const { data: participations } = await admin
    .from('mission_participants')
    .select('mission_id')
    .eq('reseller_id', session.uid)
    .eq('status', 'joined');
  const ids = (participations || []).map((p: any) => p.mission_id);
  const { data: missions } = ids.length
    ? await admin.from('missions').select('id, title, ends_at').in('id', ids).not('ends_at', 'is', null)
    : { data: [] as any[] };

  return NextResponse.json({
    disponible: !error,
    publications: (publications || []).map((p: any) => ({
      id: p.id, date: p.planned_for, canal: p.channel, produit: p.product_slug,
      titre: p.title, note: p.note, statut: p.status,
    })),
    missions: (missions || []).map((m: any) => ({ id: m.id, titre: m.title, date: String(m.ends_at).slice(0, 10) })),
  });
}

export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const corps = await req.json().catch(() => ({}));

  // Changement d'état d'une publication existante (publiée / ignorée).
  if (typeof corps.id === 'string') {
    if (!['published', 'skipped', 'planned'].includes(corps.statut)) {
      return NextResponse.json({ error: 'Statut inconnu.' }, { status: 400 });
    }
    const { error } = await admin
      .from('scheduled_posts')
      .update({ status: corps.statut, published_at: corps.statut === 'published' ? new Date().toISOString() : null })
      .eq('id', corps.id)
      .eq('reseller_id', session.uid);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  const titre = typeof corps.titre === 'string' ? corps.titre.trim() : '';
  if (titre.length < 2) return NextResponse.json({ error: 'Donnez un titre à la publication.' }, { status: 400 });
  if (typeof corps.date !== 'string' || !DATE.test(corps.date)) {
    return NextResponse.json({ error: 'Date invalide.' }, { status: 400 });
  }
  const canal = estCanal(corps.canal) ? corps.canal : 'whatsapp';

  const { data, error } = await admin
    .from('scheduled_posts')
    .insert({
      reseller_id: session.uid,
      planned_for: corps.date,
      channel: canal,
      product_slug: typeof corps.produit === 'string' && corps.produit ? corps.produit.slice(0, 120) : null,
      title: titre.slice(0, 120),
      note: typeof corps.note === 'string' ? corps.note.slice(0, 400) : null,
    })
    .select('id')
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: 'Calendrier indisponible (migration réseau V2 appliquée ?).' }, { status: 503 });
  }
  return NextResponse.json({ id: data?.id });
}
