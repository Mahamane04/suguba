import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ecrireReglagesReseau, lireReglagesReseau } from '@/lib/reseau/recompenses';

/**
 * Profil « Priorité au réseau de revendeurs » (2026-09-26, lot C) :
 * annuaire des fournisseurs, vente directe depuis leur boutique (globale ou
 * fournisseur par fournisseur), protection des articles au prix de gros.
 * Stocké dans reseau_reglages, fusionné avec les primes de parrainage.
 */
const CLES = ['annuaireFournisseurs', 'venteDirecteFournisseurs', 'fournisseursVenteDirecte', 'protectionPrixDeGros'] as const;

export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/priorite-reseau');
  if (refus) return refus;
  if (!(await sessionAvecRole(req, 'admin'))) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  const { data: fournisseurs } = (await admin?.from('suppliers').select('profile_id, company_name, shop_display_name, slug').order('company_name').limit(500)) || { data: [] };
  return NextResponse.json({
    reglages: await lireReglagesReseau(),
    fournisseurs: (fournisseurs || []).map((f: any) => ({ id: f.profile_id, nom: f.shop_display_name || f.company_name || 'Fournisseur', slug: f.slug || null })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'POST /api/admin/priorite-reseau');
  if (refus) return refus;
  if (!(await sessionAvecRole(req, 'admin'))) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const corps = await req.json().catch(() => ({})) as Record<string, unknown>;
  // Seuls les réglages de ce profil : les primes restent sur leur propre page.
  const partiel = Object.fromEntries(CLES.filter((c) => c in corps).map((c) => [c, corps[c]]));
  const reglages = await ecrireReglagesReseau(partiel);
  if (!reglages) return NextResponse.json({ error: 'Enregistrement impossible. Réessayez.' }, { status: 503 });
  return NextResponse.json({ reglages });
}
