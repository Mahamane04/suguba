import { NextRequest, NextResponse } from 'next/server';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { DevisError, listerDevisFournisseur, proposerDevis, refuserDemande } from '@/lib/devis';

/**
 * Devis côté fournisseur (2026-09-26, lot 1b) : ses demandes, et ses
 * réponses (proposer un prix, refuser avec un motif). Toujours au nom du
 * fournisseur PROPRIÉTAIRE, droit d'équipe « commandes ».
 */
export async function GET(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'commandes');
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ devis: [], migrationRequise: false });
  try {
    return NextResponse.json(await listerDevisFournisseur(admin, acces.contexte.fournisseurId), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const err = e as DevisError;
    return NextResponse.json({ error: err.message || 'Lecture impossible.' }, { status: err.status || 500 });
  }
}

export async function POST(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'commandes');
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  const corps = await req.json().catch(() => ({})) as Record<string, unknown>;
  try {
    if (corps.action === 'proposer') return NextResponse.json(await proposerDevis(admin, acces.contexte.fournisseurId, corps));
    if (corps.action === 'refuser') return NextResponse.json(await refuserDemande(admin, acces.contexte.fournisseurId, corps));
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  } catch (e) {
    const err = e as DevisError;
    return NextResponse.json({ error: err.message || 'Action impossible.' }, { status: err.status || 500 });
  }
}
