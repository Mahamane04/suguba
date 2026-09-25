import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerReglages } from '@/lib/platform-settings';
import { chargerCaisses, migrationManquante, remunerationRetenue } from '@/lib/caisse-livreur';

/**
 * Caisse livreurs (2026-09-25) — espèces encaissées par chaque livreur et
 * versements reçus à la caisse Suguba.
 *
 * Le montant dû n'est JAMAIS pris dans la requête : il est recalculé par
 * record_driver_remittance à partir des commandes et de la rémunération en
 * vigueur. L'admin ne saisit que ce qu'il a réellement reçu.
 */

async function exigerAdmin(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') return null;
  return session;
}

export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/caisse-livreurs');
  if (refus) return refus;
  if (!(await exigerAdmin(req))) return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ caisses: [], migrationRequise: false });

  const { reglages } = await chargerReglages();
  const { caisses, migrationRequise, error } = await chargerCaisses(admin, reglages, null);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({
    caisses,
    migrationRequise,
    remunerationParCourse: remunerationRetenue(reglages),
    livreurGardeRemuneration: reglages.livreurGardeRemuneration !== false,
    delaiHeures: reglages.delaiVersementEspecesHeures || 24,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'POST /api/admin/caisse-livreurs');
  if (refus) return refus;
  const session = await exigerAdmin(req);
  if (!session) return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });

  const corps = await req.json().catch(() => null) as {
    driverId?: unknown; orderIds?: unknown; montantRecu?: unknown; note?: unknown;
  } | null;
  const driverId = typeof corps?.driverId === 'string' ? corps.driverId.trim() : '';
  const orderIds = Array.isArray(corps?.orderIds) ? corps.orderIds.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, 500) : [];
  const montantRecu = Number(corps?.montantRecu);
  const note = typeof corps?.note === 'string' ? corps.note.slice(0, 300) : '';

  if (!driverId) return NextResponse.json({ error: 'Livreur manquant.' }, { status: 400 });
  if (!Number.isFinite(montantRecu) || montantRecu < 0 || montantRecu > 100_000_000) {
    return NextResponse.json({ error: 'Saisissez le montant reçu.' }, { status: 400 });
  }

  let reglages;
  try {
    ({ reglages } = await chargerReglages(true));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }

  const { data: moi } = await admin.from('profiles').select('full_name').eq('id', session.uid).maybeSingle();

  const { data, error } = await admin.rpc('record_driver_remittance', {
    p_driver_id: driverId,
    p_order_ids: orderIds,
    p_remuneration_par_course: remunerationRetenue(reglages),
    p_amount_received: Math.round(montantRecu),
    p_received_by: session.uid,
    p_received_by_name: moi?.full_name || null,
    p_note: note,
  });

  if (error) {
    if (migrationManquante(error) || error.code === '42883' || error.code === 'PGRST202') {
      return NextResponse.json({ error: 'La caisse livreurs n’est pas encore installée (SQL à exécuter).' }, { status: 503 });
    }
    console.error('[API admin/caisse-livreurs POST]', error.message);
    return NextResponse.json({ error: 'Enregistrement impossible. Réessayez.' }, { status: 500 });
  }
  const r = data as { success?: boolean; error?: string; http?: number; id?: string; remittanceNumber?: string };
  if (!r?.success) return NextResponse.json({ error: r?.error || 'Enregistrement impossible.' }, { status: r?.http || 400 });

  return NextResponse.json({ id: r.id, remittanceNumber: r.remittanceNumber });
}
