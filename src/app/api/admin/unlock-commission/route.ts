import { avecJournal } from '@/lib/admin/journal-route';
import { exigerValidation, marquerExecutee } from '@/lib/admin/securite';
import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Déblocage anticipé d'une commission par un admin — avant la fin du délai
 * de sécurité (voir supabase/migration-commission-safety-window.sql).
 *
 * L'action existait côté navigateur uniquement : l'admin voyait la commission
 * passer en « disponible » chez lui, pendant que le revendeur, lui, ne
 * pouvait toujours pas la retirer.
 */
export async function POST(req: NextRequest) {
  return avecJournal(req, 'POST /api/admin/unlock-commission', () => postInterne(req));
}

async function postInterne(req: NextRequest) {
  const refusEquipe = await refusSansPermissionAdmin(req, 'POST /api/admin/unlock-commission');
  if (refusEquipe) return refusEquipe;
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  }

  const { commissionId, motif: motifBrut } = await req.json().catch(() => ({}));
  if (!commissionId) {
    return NextResponse.json({ error: 'Commission requise.' }, { status: 400 });
  }
  const motif = typeof motifBrut === 'string' ? motifBrut.trim().slice(0, 300) : '';

  // Vente payée en espèces dont l'argent n'est pas encore chez Suguba
  // (Protection Suguba, 2026-09-26) : débloquer = AVANCER le gain sur la
  // trésorerie de Suguba. Permis, mais jamais sans motif, et tracé.
  const { data: com } = await admin.from('commissions').select('order_id, amount, reseller_id').eq('id', commissionId).maybeSingle();
  let avance = false;
  if (com?.order_id) {
    const { data: recus, error: e } = await admin.rpc('fonds_recus', { p_order_id: com.order_id });
    // État des fonds illisible : on refuse plutôt que de débloquer sans motif (2026-10-01).
    if (e) return NextResponse.json({ error: 'Impossible de vérifier si l’argent de la vente est reçu. Réessayez.' }, { status: 503 });
    avance = recus === false;
  }
  if (avance && motif.length < 5) {
    return NextResponse.json({ error: 'Les espèces de cette vente ne sont pas encore reversées à Suguba : indiquez le motif de l’avance.', motifRequis: true }, { status: 409 });
  }

  // Double validation (A3) : une grosse avance sur la trésorerie de Suguba
  // exige l'approbation d'un autre membre.
  const validation = avance
    ? await exigerValidation(admin, {
      type: 'avance_commission', dossier: `commission:${commissionId}`, montant: Number(com?.amount) || 0,
      resume: { beneficiaire: com?.reseller_id || null, commande: com?.order_id || null },
      demandeurId: session.uid,
    })
    : { ok: true as const, validationId: null };
  if (!validation.ok) return NextResponse.json(validation.corps, { status: validation.status });

  // Seule une commission encore bloquée peut être débloquée : ne jamais
  // « re-débloquer » une commission déjà réservée pour un retrait ou payée,
  // ce qui la rendrait retirable une seconde fois.
  const { data, error } = await admin
    .from('commissions')
    .update({
      status: 'available', available_at: new Date().toISOString(), unlock_at: null,
      ...(motif ? { avance_motif: motif, avance_par: session.uid, avance_le: new Date().toISOString() } : {}),
    })
    .eq('id', commissionId)
    .eq('status', 'locked')
    .select('id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Commission introuvable ou déjà débloquée.' }, { status: 409 });
  }

  await marquerExecutee(admin, validation.validationId);
  return NextResponse.json({ success: true });
}
