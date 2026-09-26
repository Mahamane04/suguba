import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Journal des coordonnées remises (2026-09-26, Protection Suguba lot 2) :
 * qui a reçu les coordonnées de combien de dossiers sur 30 jours. Pour les
 * devis, combien de demandes consultées sont restées sans réponse — le signe
 * possible d'un fournisseur qui récupère des contacts sans passer par Suguba.
 */
export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/acces-coordonnees');
  if (refus) return refus;
  if (!(await sessionAvecRole(req, 'admin'))) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ personnes: [] });

  const depuis = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await admin.from('acces_coordonnees').select('personne_id, role, raison, dossier')
    .gte('jour', depuis).limit(20000);
  if (error) {
    if (['42P01', 'PGRST205'].includes(String(error.code))) return NextResponse.json({ personnes: [], migrationRequise: true });
    return NextResponse.json({ error: 'Journal indisponible.' }, { status: 503 });
  }

  type Ligne = { role: string; course: Set<string>; remise: Set<string>; devis: Set<string> };
  const par = new Map<string, Ligne>();
  for (const a of data || []) {
    const l = par.get(a.personne_id) || { role: a.role, course: new Set<string>(), remise: new Set<string>(), devis: new Set<string>() };
    if (a.raison === 'course' || a.raison === 'remise' || a.raison === 'devis') l[a.raison as 'course' | 'remise' | 'devis'].add(a.dossier);
    par.set(a.personne_id, l);
  }

  // Devis consultés restés sans réponse du fournisseur depuis plus de 24 h.
  const idsDevis = [...new Set([...par.values()].flatMap((l) => [...l.devis]))];
  const sansReponse = new Set<string>();
  if (idsDevis.length) {
    const { data: devis } = await admin.from('quote_requests').select('id, status, created_at').in('id', idsDevis.slice(0, 2000));
    for (const q of devis || []) {
      if (q.status === 'demande' && Date.now() - Date.parse(q.created_at) > 24 * 3_600_000) sansReponse.add(q.id);
    }
  }

  const ids = [...par.keys()];
  const { data: profils } = ids.length
    ? await admin.from('profiles').select('id, full_name').in('id', ids.slice(0, 500))
    : { data: [] as any[] };
  const noms = new Map((profils || []).map((p: any) => [p.id, p.full_name || '']));

  const personnes = [...par.entries()].map(([id, l]) => ({
    id, nom: noms.get(id) || (l.role === 'driver' ? 'Livreur' : 'Fournisseur'), role: l.role,
    courses: l.course.size, remises: l.remise.size, devis: l.devis.size,
    devisSansReponse: [...l.devis].filter((d) => sansReponse.has(d)).length,
  })).sort((a, b) => b.devisSansReponse - a.devisSansReponse || (b.courses + b.remises + b.devis) - (a.courses + a.remises + a.devis));

  return NextResponse.json({ personnes: personnes.slice(0, 200), migrationRequise: false }, { headers: { 'Cache-Control': 'no-store' } });
}
