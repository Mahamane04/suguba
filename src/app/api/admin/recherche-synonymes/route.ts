import { avecJournal } from '@/lib/admin/journal-route';
import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { normaliserEquivalent, normaliserTerme } from '@/lib/recherche-texte';

/**
 * Dictionnaire de la recherche (R1, 2026-09-26) : les mots des clients
 * (« frigo ») reliés aux mots du catalogue (« refrigerateur »). La recherche
 * les utilise dans les deux sens. 300 synonymes au plus.
 */

const MIGRATION = ['42P01', 'PGRST205'];
const MAX = 300;

/** Session admin et base, une fois la permission vérifiée par chaque méthode. */
async function garde(req: NextRequest, refusPermission: NextResponse | null) {
  if (refusPermission) return { refus: refusPermission };
  if (!(await sessionAvecRole(req, 'admin'))) return { refus: NextResponse.json({ error: 'Session admin requise.' }, { status: 401 }) };
  const admin = getSupabaseAdmin();
  if (!admin) return { refus: NextResponse.json({ error: 'Base indisponible.' }, { status: 503 }) };
  return { admin };
}

export async function GET(req: NextRequest) {
  const { refus, admin } = await garde(req, await refusSansPermissionAdmin(req, 'GET /api/admin/recherche-synonymes'));
  if (refus) return refus;
  const { data, error } = await admin!.from('recherche_synonymes').select('id, terme, equivalent').order('terme').limit(MAX);
  if (error) {
    if (MIGRATION.includes(String(error.code))) return NextResponse.json({ synonymes: [], migrationRequise: true });
    return NextResponse.json({ error: 'Lecture impossible.' }, { status: 503 });
  }
  return NextResponse.json({ synonymes: data || [] });
}

export async function POST(req: NextRequest) {
  return avecJournal(req, 'POST /api/admin/recherche-synonymes', () => postInterne(req));
}

async function postInterne(req: NextRequest) {
  const { refus, admin } = await garde(req, await refusSansPermissionAdmin(req, 'POST /api/admin/recherche-synonymes'));
  if (refus) return refus;
  const corps = await req.json().catch(() => ({}));
  const terme = normaliserTerme(String(corps.terme || ''));
  const equivalent = normaliserEquivalent(String(corps.equivalent || ''));
  if (!terme) return NextResponse.json({ error: 'Le mot des clients doit être un seul mot de 2 à 30 lettres ou chiffres.' }, { status: 400 });
  if (!equivalent) return NextResponse.json({ error: 'Le mot du catalogue doit faire 2 à 60 lettres, chiffres, espaces ou tirets.' }, { status: 400 });
  if (terme === equivalent) return NextResponse.json({ error: 'Les deux mots sont identiques.' }, { status: 400 });

  const { count } = await admin!.from('recherche_synonymes').select('id', { count: 'exact', head: true });
  if ((count || 0) >= MAX) return NextResponse.json({ error: `${MAX} synonymes au plus.` }, { status: 409 });

  const { error } = await admin!.from('recherche_synonymes').insert({ terme, equivalent });
  if (error) {
    if (String(error.code) === '23505') return NextResponse.json({ error: 'Ce synonyme existe déjà.' }, { status: 409 });
    if (MIGRATION.includes(String(error.code))) return NextResponse.json({ error: 'Exécutez d’abord le SQL de la recherche.' }, { status: 409 });
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, terme, equivalent });
}

export async function DELETE(req: NextRequest) {
  return avecJournal(req, 'DELETE /api/admin/recherche-synonymes', () => deleteInterne(req));
}

async function deleteInterne(req: NextRequest) {
  const { refus, admin } = await garde(req, await refusSansPermissionAdmin(req, 'DELETE /api/admin/recherche-synonymes'));
  if (refus) return refus;
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Synonyme inconnu.' }, { status: 400 });
  const { error } = await admin!.from('recherche_synonymes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Suppression impossible.' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
