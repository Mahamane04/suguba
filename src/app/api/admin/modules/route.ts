import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { permissionsDuMembre } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { lireReglagesReseau } from '@/lib/reseau/recompenses';
import { chargerReglages } from '@/lib/platform-settings';
import { lireSecurite } from '@/lib/admin/securite';
import { MODULES } from '@/lib/admin/pilotage';

/**
 * Centre des modules (A5, 2026-09-27) : l'état de chaque fonctionnalité
 * ouvrable ou fermable, en un seul endroit. Chaque changement passe par la
 * route qui possède le réglage (et ses propres contrôles de droits).
 */
export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const { permissions } = await permissionsDuMembre(session.uid);
  if (!permissions.length) return NextResponse.json({ error: 'Aucun rôle d’équipe.' }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const [reseau, { reglages }, securite] = await Promise.all([lireReglagesReseau(), chargerReglages(), lireSecurite(admin)]);
  const etat: Record<string, { actif: boolean; detail?: string }> = {
    annuaireFournisseurs: { actif: reseau.annuaireFournisseurs },
    venteDirecteFournisseurs: { actif: reseau.venteDirecteFournisseurs, detail: reseau.fournisseursVenteDirecte.length ? `${reseau.fournisseursVenteDirecte.length} fournisseur(s) autorisé(s) un par un` : undefined },
    protectionPrixDeGros: { actif: reseau.protectionPrixDeGros },
    remunerationResultat: { actif: reseau.remunerationResultat },
    paiementCarte: { actif: reglages.paiementCarteVerifie === true },
    mfaObligatoire: { actif: securite.mfaObligatoire },
    doubleValidation: { actif: securite.seuilValidation > 0, detail: securite.seuilValidation > 0 ? `À partir de ${securite.seuilValidation.toLocaleString('fr-FR')} F` : undefined },
  };
  return NextResponse.json({
    modules: MODULES.map((m) => ({ ...m, ...etat[m.cle], peutChanger: permissions.includes(m.permission) })),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
