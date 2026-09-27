import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { permissionsDuMembre } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { TACHES, type TypeTache } from '@/lib/admin/poste';
import { journaliserAction } from '@/lib/admin/journal';

/**
 * Notes internes d'un dossier (A2, 2026-09-27) : réservées à l'équipe, jamais
 * montrées au client. Ajout seulement (la base refuse modification et
 * suppression). Pour un dossier de la file « À traiter », il faut le droit de
 * traiter ce type de dossier.
 */
const DOSSIER = /^[a-z_/-]{2,60}:[A-Za-z0-9_.:,-]{1,120}$/;

async function garde(req: NextRequest, dossier: string) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return { refus: NextResponse.json({ error: 'Session admin requise.' }, { status: 401 }) };
  if (!DOSSIER.test(dossier)) return { refus: NextResponse.json({ error: 'Dossier inconnu.' }, { status: 400 }) };
  const { permissions } = await permissionsDuMembre(session.uid);
  const type = dossier.split(':')[0] as TypeTache;
  const requise = TACHES[type]?.permission;
  if (!permissions.length || (requise && !permissions.includes(requise))) {
    return { refus: NextResponse.json({ error: 'Votre rôle ne donne pas accès à ce dossier.' }, { status: 403 }) };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { refus: NextResponse.json({ error: 'Base indisponible.' }, { status: 503 }) };
  return { session, admin };
}

export async function GET(req: NextRequest) {
  const dossier = req.nextUrl.searchParams.get('dossier') || '';
  const { refus, admin } = await garde(req, dossier);
  if (refus) return refus;
  const { data, error } = await admin!.from('notes_internes').select('id, cree_le, auteur_id, texte').eq('dossier', dossier).order('id', { ascending: false }).limit(100);
  if (error) {
    if (['42P01', 'PGRST205'].includes(String(error.code))) return NextResponse.json({ notes: [], migrationRequise: true });
    return NextResponse.json({ error: 'Lecture impossible.' }, { status: 503 });
  }
  const ids = [...new Set((data || []).map((n: any) => n.auteur_id))];
  const { data: profils } = ids.length ? await admin!.from('profiles').select('id, full_name').in('id', ids) : { data: [] as any[] };
  const noms = new Map((profils || []).map((x: any) => [x.id, x.full_name || 'Membre']));
  return NextResponse.json({ notes: (data || []).map((n: any) => ({ id: n.id, le: n.cree_le, auteur: noms.get(n.auteur_id) || 'Membre', texte: n.texte })) },
    { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: NextRequest) {
  const corps = await req.json().catch(() => ({}));
  const dossier = typeof corps.dossier === 'string' ? corps.dossier : '';
  const { refus, admin, session } = await garde(req, dossier);
  if (refus) return refus;
  const texte = typeof corps.texte === 'string' ? corps.texte.trim().slice(0, 2000) : '';
  if (!texte) return NextResponse.json({ error: 'Écrivez la note.' }, { status: 400 });
  const { error } = await admin!.from('notes_internes').insert({ dossier, auteur_id: session!.uid, texte });
  if (error) {
    if (['42P01', 'PGRST205'].includes(String(error.code))) return NextResponse.json({ error: 'Exécutez d’abord le SQL du journal (A2).' }, { status: 409 });
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 503 });
  }
  await journaliserAction(admin!, { auteurId: session!.uid, action: 'note.ajouter', dossier });
  return NextResponse.json({ ok: true });
}
