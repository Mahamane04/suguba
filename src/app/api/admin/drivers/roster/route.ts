import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Tous les livreurs inscrits, vérifiés ou non, pour le panneau du guichet.
 *
 * Distinct de /api/admin/drivers/active, qui ne sert qu'au dispatch et ne
 * renvoie donc que les livreurs déjà vus au guichet.
 */
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ livreurs: [], cloud: false });

  const { data: roles } = await admin
    .from('profile_roles')
    .select('profile_id')
    .eq('role', 'driver');

  const ids = (roles || []).map((r) => r.profile_id);
  if (ids.length === 0) return NextResponse.json({ livreurs: [], cloud: true });

  const [{ data: profils }, { data: fiches }] = await Promise.all([
    admin.from('profiles').select('id, full_name, phone, city, created_at').in('id', ids),
    admin
      .from('drivers')
      .select('profile_id, vehicle_type, license_plate, zone, id_document_number, active_status, verified_at, verified_note, total_deliveries')
      .in('profile_id', ids),
  ]);

  const ficheParId = new Map((fiches || []).map((f) => [f.profile_id, f]));

  const livreurs = (profils || []).map((p) => {
    const f: any = ficheParId.get(p.id);
    return {
      id: p.id,
      fullName: p.full_name,
      phone: p.phone,
      city: p.city,
      inscritLe: p.created_at,
      // Sans fiche, le candidat n'a pas terminé /register/complete : il n'y a
      // pas encore de véhicule ni de zone, donc rien à vérifier au guichet.
      dossierComplet: Boolean(f),
      vehicleType: f?.vehicle_type || null,
      licensePlate: f?.license_plate || null,
      zone: f?.zone || null,
      pieceDeclaree: f?.id_document_number || null,
      verifie: Boolean(f?.active_status),
      verifieLe: f?.verified_at || null,
      constat: f?.verified_note || null,
      livraisons: f?.total_deliveries ?? 0,
    };
  });

  // Les non vérifiés d'abord : ce sont eux qui attendent une action.
  livreurs.sort((a, b) => Number(a.verifie) - Number(b.verifie));

  return NextResponse.json({ livreurs, cloud: true });
}
