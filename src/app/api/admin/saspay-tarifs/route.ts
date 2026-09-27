import { NextRequest, NextResponse } from 'next/server';
import { verifyActiveSession } from '@/lib/active-session';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { actualiserTarifsSasPay } from '@/lib/tarifs-saspay';

/** SasPay met jusqu'à 30 secondes à renvoyer ses tarifs. */
export const maxDuration = 60;

/**
 * Relecture immédiate des tarifs SasPay (2026-09-27), à la demande de l'équipe.
 *
 * Les tarifs sont déjà relus seuls en arrière-plan dès que le relevé a plus de
 * 6 heures (tarifs-saspay.ts). Ce bouton force la relecture et enregistre le
 * résultat dans `platform_settings.tarifs_saspay` : les tarifs relus des
 * opérateurs de paiement ne sont pas un réglage de l'équipe, rien d'autre
 * n'est modifié.
 */
export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/saspay-tarifs');
  if (refus) return refus;
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }
  const resultat = await actualiserTarifsSasPay();
  if (!resultat.ok) return NextResponse.json({ error: resultat.erreur }, { status: 502 });
  return NextResponse.json({ tarifs: resultat.tarifs, enregistre: resultat.enregistre });
}
