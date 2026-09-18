import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { EMPLACEMENTS, sponsorisationActive } from '@/lib/reseau/sponsoring';

/**
 * Produits sponsorisés d'un emplacement (§ 17) — route PUBLIQUE : les
 * visiteurs de l'accueil doivent les voir.
 *
 * GET  ?emplacement=home_products → [{ id, productId }] des sponsorisations
 *      de produits ACTIVES et dans leur période. Aucun effet de bord.
 * POST { evenement: 'vue' | 'clic', ids } → compteurs, pour les seules
 *      cartes réellement affichées ou cliquées (le client les envoie).
 */

export async function GET(req: NextRequest) {
  const emplacement = req.nextUrl.searchParams.get('emplacement') || '';
  if (!EMPLACEMENTS.some((e) => e.valeur === emplacement)) return NextResponse.json({ sponsorises: [] });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ sponsorises: [] });
  const { data, error } = await admin
    .from('sponsorships')
    .select('id, subject_type, subject_ref, slot, status, starts_at, ends_at, created_at')
    .eq('slot', emplacement)
    .eq('status', 'active')
    .eq('subject_type', 'product')
    .order('created_at', { ascending: true })
    .limit(20);
  if (error || !data) return NextResponse.json({ sponsorises: [] });

  const maintenant = new Date();
  const sponsorises = data
    .filter((s: any) => s.subject_ref && sponsorisationActive(
      { id: s.id, sujetRef: s.subject_ref, emplacement: s.slot, statut: s.status, commenceLe: s.starts_at, finitLe: s.ends_at },
      maintenant,
    ))
    .map((s: any) => ({ id: s.id as string, productId: s.subject_ref as string }));

  return NextResponse.json(
    { sponsorises },
    // Une minute de cache : une sponsorisation qui expire disparaît vite,
    // sans interroger la base à chaque affichage de l'accueil.
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
}

export async function POST(req: NextRequest) {
  const { evenement, ids } = await req.json().catch(() => ({}));
  if (!['vue', 'clic'].includes(evenement) || !Array.isArray(ids)) return NextResponse.json({ ok: false }, { status: 400 });
  const propres = ids.filter((x: unknown) => typeof x === 'string' && x.length <= 64).slice(0, 30);
  if (propres.length === 0) return NextResponse.json({ ok: true });
  const admin = getSupabaseAdmin();
  await admin?.rpc('compter_sponsorisation', { p_ids: propres, p_evenement: evenement });
  return NextResponse.json({ ok: true });
}
