import { NextRequest, NextResponse } from 'next/server';
import { avecJournal } from '@/lib/admin/journal-route';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { permissionsDuMembre } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Vues enregistrées d'un membre (A4, 2026-09-27) : filtres, tri et colonnes
 * d'une liste, sous un nom. Propres à chaque membre ; ne donnent aucun droit.
 */
const PAGE = /^[a-z-]{2,40}$/;
const MAX_VUES = 20;

async function garde(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return { refus: NextResponse.json({ error: 'Session admin requise.' }, { status: 401 }) };
  const { permissions } = await permissionsDuMembre(session.uid);
  if (!permissions.length) return { refus: NextResponse.json({ error: 'Aucun rôle d’équipe.' }, { status: 403 }) };
  const admin = getSupabaseAdmin();
  if (!admin) return { refus: NextResponse.json({ error: 'Base indisponible.' }, { status: 503 }) };
  return { session, admin };
}
const migration = (e: { code?: string } | null) => Boolean(e && ['42P01', 'PGRST205'].includes(String(e.code)));

export async function GET(req: NextRequest) {
  const { refus, session, admin } = await garde(req);
  if (refus) return refus;
  const page = req.nextUrl.searchParams.get('page') || '';
  if (!PAGE.test(page)) return NextResponse.json({ error: 'Page inconnue.' }, { status: 400 });
  const { data, error } = await admin!.from('vues_admin').select('id, nom, config').eq('membre_id', session!.uid).eq('page', page).order('nom');
  if (error) return migration(error) ? NextResponse.json({ vues: [], migrationRequise: true }) : NextResponse.json({ error: 'Lecture impossible.' }, { status: 503 });
  return NextResponse.json({ vues: data || [] }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: NextRequest) {
  return avecJournal(req, 'POST /api/admin/vues', () => postInterne(req));
}

async function postInterne(req: NextRequest) {
  const { refus, session, admin } = await garde(req);
  if (refus) return refus;
  const corps = await req.json().catch(() => ({}));
  const page = String(corps.page || '');
  const nom = String(corps.nom || '').trim().slice(0, 60);
  if (!PAGE.test(page) || !nom) return NextResponse.json({ error: 'Donnez un nom à la vue.' }, { status: 400 });
  const config = corps.config && typeof corps.config === 'object' ? corps.config : {};
  if (JSON.stringify(config).length > 4000) return NextResponse.json({ error: 'Vue trop volumineuse.' }, { status: 400 });
  const { count } = await admin!.from('vues_admin').select('id', { count: 'exact', head: true }).eq('membre_id', session!.uid).eq('page', page);
  if ((count || 0) >= MAX_VUES) return NextResponse.json({ error: `${MAX_VUES} vues au plus par liste.` }, { status: 409 });
  const { error } = await admin!.from('vues_admin').upsert({ membre_id: session!.uid, page, nom, config }, { onConflict: 'membre_id,page,nom' });
  if (error) return migration(error) ? NextResponse.json({ error: 'Exécutez d’abord le SQL des listes (A4).' }, { status: 409 }) : NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 503 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  return avecJournal(req, 'DELETE /api/admin/vues', () => deleteInterne(req));
}

async function deleteInterne(req: NextRequest) {
  const { refus, session, admin } = await garde(req);
  if (refus) return refus;
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Vue inconnue.' }, { status: 400 });
  // Seulement ses propres vues.
  const { error } = await admin!.from('vues_admin').delete().eq('id', id).eq('membre_id', session!.uid);
  if (error) return NextResponse.json({ error: 'Suppression impossible.' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
