import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Fiche livreur réelle du compte connecté. Voir /api/supplier/me pour le
 * même principe côté fournisseur.
 */
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'driver') {
    return NextResponse.json({ error: 'Authentification livreur requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ driver: null });
  }

  const { data: driverRow, error } = await admin
    .from('drivers')
    .select('*')
    .eq('profile_id', session.uid)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    driver: driverRow
      ? {
          vehicleType: driverRow.vehicle_type,
          licensePlate: driverRow.license_plate,
          zone: driverRow.zone,
          totalDeliveries: driverRow.total_deliveries,
        }
      : null,
  });
}
