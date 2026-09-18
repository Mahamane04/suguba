import { NextRequest, NextResponse } from 'next/server';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { listerMissions } from '@/lib/reseau/missions-db';

/**
 * Campagnes du fournisseur (§ page 24) — des missions financées par lui.
 *
 * Une campagne naît en BROUILLON : Suguba ne l'ouvre aux revendeurs qu'après
 * règlement du budget (récompense × nombre de revendeurs). Sans cette étape,
 * Suguba verserait des récompenses qu'aucun fournisseur n'a payées.
 */

const TYPES = ['share', 'click', 'sale'] as const;

export async function GET(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'sponsorisation');
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const fournisseurId = acces.contexte.fournisseurId;

  const admin = getSupabaseAdmin();
  const { data: produits } = (await admin?.from('products').select('id, name').eq('supplier_id', fournisseurId).eq('status', 'approved').limit(200)) || { data: [] as any[] };
  const campagnes = await listerMissions({ supplierId: fournisseurId });

  // Progression cumulée par campagne, pour l'écran de suivi.
  const avancement = new Map<string, number>();
  if (admin && campagnes.length) {
    const { data } = await admin.from('mission_participants').select('mission_id, progress').in('mission_id', campagnes.map((c) => c.id));
    for (const p of data || []) avancement.set(p.mission_id, (avancement.get(p.mission_id) || 0) + (Number(p.progress) || 0));
  }

  return NextResponse.json({
    produits: (produits || []).map((p: any) => ({ id: p.id, nom: p.name })),
    campagnes: campagnes.map((c) => ({
      ...c,
      budget: c.recompense * (c.maxParticipants || 0),
      avancementTotal: avancement.get(c.id) || 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'sponsorisation');
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const { fournisseurId, personneId } = acces.contexte;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const c = await req.json().catch(() => ({}));
  const titre = typeof c.titre === 'string' ? c.titre.trim() : '';
  if (titre.length < 3) return NextResponse.json({ error: 'Donnez un titre à la campagne.' }, { status: 400 });
  if (!TYPES.includes(c.type)) return NextResponse.json({ error: 'Objectif de campagne inconnu.' }, { status: 400 });

  // Le produit doit appartenir au fournisseur : on ne finance pas la
  // promotion du catalogue d'un concurrent.
  if (typeof c.produitId !== 'string') return NextResponse.json({ error: 'Choisissez le produit.' }, { status: 400 });
  const { data: produit } = await admin.from('products').select('id').eq('id', c.produitId).eq('supplier_id', fournisseurId).maybeSingle();
  if (!produit) return NextResponse.json({ error: 'Ce produit ne fait pas partie de votre catalogue.' }, { status: 403 });

  const objectif = Math.max(1, Math.min(1000, Math.round(Number(c.objectif) || 0)));
  const recompense = Math.max(0, Math.min(100000, Math.round((Number(c.recompense) || 0) / 50) * 50));
  const maxRevendeurs = Math.max(1, Math.min(500, Math.round(Number(c.maxRevendeurs) || 0)));
  if (!(recompense > 0)) return NextResponse.json({ error: 'Indiquez la récompense par revendeur.' }, { status: 400 });

  let finitLe: string | null = null;
  if (typeof c.finitLe === 'string' && c.finitLe) {
    const d = new Date(`${c.finitLe}T23:59:59Z`);
    if (!Number.isFinite(d.getTime()) || d.getTime() < Date.now()) return NextResponse.json({ error: 'La date de fin doit être à venir.' }, { status: 400 });
    finitLe = d.toISOString();
  }

  const { data, error } = await admin.from('missions').insert({
    title: titre.slice(0, 120),
    description: typeof c.description === 'string' ? c.description.slice(0, 600) : null,
    mission_type: c.type,
    objective: objectif,
    reward_amount: recompense,
    supplier_id: fournisseurId,
    product_id: c.produitId,
    created_by: personneId,
    ends_at: finitLe,
    max_participants: maxRevendeurs,
    status: 'draft',
  }).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: 'Campagnes indisponibles pour le moment.' }, { status: 503 });

  return NextResponse.json({ id: data?.id, budget: recompense * maxRevendeurs });
}
