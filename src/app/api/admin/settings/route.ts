import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { chargerReglages } from '@/lib/platform-settings';
import {
  tarifProduit,
  completerReglages,
  coutFixeParCommande,
  totalCoutsFixes,
  validerReglages,
  type ReglagesPlateforme,
} from '@/lib/pricing';

/**
 * Réglages économiques de la plateforme — lecture et modification, admin seul.
 *
 * Enregistrer de nouveaux réglages recalcule AUTOMATIQUEMENT la commission de
 * tous les produits approuvés. En revanche, le prix de vente n'est jamais
 * modifié ici : des liens déjà partagés sur WhatsApp afficheraient un prix
 * faux. La route renvoie la liste des produits qui passent sous le plancher,
 * avec leur prix minimal, pour que l'admin décide lui-même.
 */

async function exigerAdmin(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  return session && session.role === 'admin' ? session : null;
}

export async function GET(req: NextRequest) {
  const refusEquipe = await refusSansPermissionAdmin(req, 'GET /api/admin/settings');
  if (refusEquipe) return refusEquipe;
  if (!(await exigerAdmin(req))) {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }
  const etat = await chargerReglages();
  // Produits en ligne (2026-09-24) : le panneau calcule en direct l'effet des
  // réglages en cours d'édition sur chacun, AVANT d'enregistrer.
  const admin = getSupabaseAdmin();
  const { data: produits } = admin
    ? await admin
      .from('products')
      // `*` : inclut mode_prix dès que la base l'a (articles au prix de gros).
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(300)
    : { data: [] };
  return NextResponse.json({
    ...etat,
    produits: produits || [],
    totalCoutsFixes: totalCoutsFixes(etat.reglages),
    coutFixeParCommande: Math.round(coutFixeParCommande(etat.reglages)),
  });
}

export async function PUT(req: NextRequest) {
  const refusEquipe = await refusSansPermissionAdmin(req, 'PUT /api/admin/settings');
  if (refusEquipe) return refusEquipe;
  const session = await exigerAdmin(req);
  if (!session) {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const reglages = completerReglages(body.reglages as Partial<ReglagesPlateforme>);

  const erreurs = validerReglages(reglages);
  if (erreurs.length > 0) {
    return NextResponse.json({ error: erreurs.join(' '), erreurs }, { status: 400 });
  }

  const { error } = await admin.from('platform_settings').upsert({
    id: 1,
    valeurs: reglages,
    confirme: true,
    updated_at: new Date().toISOString(),
    updated_by: session.uid,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Recalcul des commissions de tous les produits approuvés ─────────────
  const { data: produits } = await admin
    .from('products')
    .select('*')
    .eq('status', 'approved');

  const alertes: { id: string; nom: string; statut: string; prixVente: number; prixMinimal: number }[] = [];
  let recalcules = 0;
  const maintenant = new Date().toISOString();

  for (const p of produits || []) {
    // La part revendeur choisie par le fournisseur est conservée (sauf en mode automatique).
    // Prix de gros : commission indicative au prix conseillé (le revendeur
    // fixe ensuite son propre prix).
    const t = tarifProduit({
      prixFournisseur: Number(p.supplier_price), prixVente: Number(p.public_price),
      commissionProposee: p.commission_proposee, modePrix: p.mode_prix,
    }, reglages);
    if (t.statut !== 'ok') {
      alertes.push({ id: p.id, nom: p.name, statut: t.statut, prixVente: t.prixVente, prixMinimal: t.prixMinimal });
    }
    const { error: majErr } = await admin
      .from('products')
      .update({ reseller_commission: t.commission, pricing_status: t.statut, pricing_computed_at: maintenant })
      .eq('id', p.id);
    if (!majErr) recalcules++;
  }

  return NextResponse.json({
    success: true,
    recalcules,
    alertes,
    totalCoutsFixes: totalCoutsFixes(reglages),
    coutFixeParCommande: Math.round(coutFixeParCommande(reglages)),
  });
}
