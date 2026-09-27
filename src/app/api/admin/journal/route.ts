import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Journal des actions de l'équipe (A2, 2026-09-27) : lecture filtrée par
 * dossier, auteur ou action, 50 par page (curseur `avant` = id). Réservé à
 * qui gère l'équipe. Le journal ne se modifie pas (la base le refuse).
 */
export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/journal');
  if (refus) return refus;
  if (!(await sessionAvecRole(req, 'admin'))) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const p = req.nextUrl.searchParams;
  const nettoyer = (v: string | null) => (v || '').trim().slice(0, 120).replace(/[\\%_,()]/g, '');
  let q = admin.from('journal_admin').select('id, cree_le, auteur_id, action, dossier, motif, avant, apres').order('id', { ascending: false }).limit(50);
  const dossier = nettoyer(p.get('dossier'));
  const action = nettoyer(p.get('action'));
  const auteur = nettoyer(p.get('auteur'));
  const avant = Number(p.get('avant'));
  if (dossier) q = q.ilike('dossier', `%${dossier}%`);
  if (action) q = q.ilike('action', `%${action}%`);
  if (auteur) q = q.eq('auteur_id', auteur);
  if (Number.isInteger(avant) && avant > 0) q = q.lt('id', avant);

  const { data, error } = await q;
  if (error) {
    if (['42P01', 'PGRST205'].includes(String(error.code))) return NextResponse.json({ entrees: [], migrationRequise: true });
    return NextResponse.json({ error: 'Lecture impossible.' }, { status: 503 });
  }
  const ids = [...new Set((data || []).map((e: any) => e.auteur_id))];
  const { data: profils } = ids.length ? await admin.from('profiles').select('id, full_name').in('id', ids) : { data: [] as any[] };
  const noms = new Map((profils || []).map((x: any) => [x.id, x.full_name || 'Membre']));
  return NextResponse.json({
    entrees: (data || []).map((e: any) => ({ ...e, auteur: noms.get(e.auteur_id) || 'Membre' })),
    suivant: data && data.length === 50 ? data[data.length - 1].id : null,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
