import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { tauxConversion } from '@/lib/reseau/codes';

/**
 * Vision consolidée du réseau pour l'admin (§ 21, dashboard admin) : ce que
 * /admin/analytics ne couvrait pas — partages, attribution, missions,
 * sponsorisations, vérifications en attente.
 */

async function compter(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, table: string, filtre?: (q: any) => any) {
  let q = admin.from(table).select('*', { count: 'exact', head: true });
  if (filtre) q = filtre(q);
  const { count, error } = await q;
  return error ? null : count ?? 0;
}

export async function GET(req: NextRequest) {
  const refusEquipe = await refusSansPermissionAdmin(req, 'GET /api/admin/reseau-stats');
  if (refusEquipe) return refusEquipe;
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ disponible: false });

  const [liens, clientsAttribues, missionsActives, aValider, sponsoActives, sponsoEnAttente, verifications, boutiques] = await Promise.all([
    compter(admin, 'tracking_links'),
    compter(admin, 'customer_attributions', (q) => q.not('reseller_id', 'is', null)),
    compter(admin, 'missions', (q) => q.eq('status', 'active')),
    compter(admin, 'mission_participants', (q) => q.eq('status', 'completed')),
    compter(admin, 'sponsorships', (q) => q.eq('status', 'active')),
    compter(admin, 'sponsorships', (q) => q.eq('status', 'pending')),
    compter(admin, 'verification_requests', (q) => q.eq('status', 'pending')),
    compter(admin, 'stores'),
  ]);

  const { data: agregat } = await admin.from('tracking_links').select('clicks, orders_count, revenue').limit(10000);
  const clics = (agregat || []).reduce((s: number, l: any) => s + (Number(l.clicks) || 0), 0);
  const commandes = (agregat || []).reduce((s: number, l: any) => s + (Number(l.orders_count) || 0), 0);
  const caPartages = (agregat || []).reduce((s: number, l: any) => s + (Number(l.revenue) || 0), 0);

  return NextResponse.json({
    disponible: liens !== null,
    liens, clics, commandes, conversion: tauxConversion(clics, commandes), caPartages,
    clientsAttribues, missionsActives, aValider, sponsoActives, sponsoEnAttente, verifications, boutiques,
  });
}
