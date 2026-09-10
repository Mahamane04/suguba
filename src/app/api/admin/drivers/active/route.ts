import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Livreurs réellement actifs, pour peupler le sélecteur de dispatch admin.
 * Remplace l'ancienne liste tirée de INITIAL_DRIVERS (mock-data.ts) — un
 * dispatch sur un faux livreur n'atteignait jamais personne, la commande
 * n'était même jamais poussée vers Supabase (voir sugubaStore.assignDriver,
 * corrigé le 2026-08-26 pour appeler /api/orders/sync).
 */
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ drivers: [] });
  }

  const { data: activeRoles, error: rolesErr } = await admin
    .from('profile_roles')
    .select('profile_id')
    .eq('role', 'driver')
    .eq('status', 'active');

  if (rolesErr) {
    return NextResponse.json({ error: rolesErr.message }, { status: 500 });
  }
  if (!activeRoles || activeRoles.length === 0) {
    return NextResponse.json({ drivers: [] });
  }

  const ids = activeRoles.map((r) => r.profile_id);

  // Le verrou du dispatch est `drivers.active_status`, pas le statut du rôle.
  // Un compte livreur fonctionne dès l'inscription — il peut se connecter et
  // voir son espace — mais il ne reçoit aucune course tant qu'un agent ne l'a
  // pas vu, lui et sa moto, au guichet de Bamako.
  const [{ data: profileRows }, { data: driverRows }] = await Promise.all([
    admin.from('profiles').select('id, full_name, phone').in('id', ids),
    admin
      .from('drivers')
      .select('profile_id, vehicle_type')
      .in('profile_id', ids)
      .eq('active_status', true),
  ]);

  const vehicleById = new Map((driverRows || []).map((d) => [d.profile_id, d.vehicle_type]));
  // Seuls les profils ayant une ligne `drivers` vérifiée sont proposés : un
  // compte sans fiche livreur, ou non vérifié, ne doit jamais apparaître ici.
  const verifies = new Set((driverRows || []).map((d) => d.profile_id));
  const drivers = (profileRows || [])
    .filter((p) => verifies.has(p.id))
    .map((p) => ({
      id: p.id,
      fullName: p.full_name,
      phone: p.phone,
      vehicleType: vehicleById.get(p.id) || null,
    }));

  return NextResponse.json({ drivers });
}
