import { NextRequest, NextResponse } from 'next/server';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { evolution, retourSurInvestissement, serieParJour } from '@/lib/reseau/stats';
import { tauxConversion } from '@/lib/reseau/codes';

/**
 * Analytics fournisseur (§ 26 des écrans) sur 30 jours : ventes, chiffre
 * d'affaires, visites des liens partagés vers ses produits, conversion, top
 * produits, retour des sponsorisations.
 *
 * Aucun nom de client, aucun téléphone : un fournisseur voit des volumes,
 * jamais la clientèle de Suguba.
 */

const JOURS = 30;

export async function GET(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'analyses');
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const fournisseurId = acces.contexte.fournisseurId;

  const admin = getSupabaseAdmin();
  const vide = { commandes: [], ca: [], visites: [], totaux: null, topProduits: [], sponsorisations: [] };
  if (!admin) return NextResponse.json(vide);

  const maintenant = new Date();
  const debut = new Date(maintenant.getTime() - 2 * JOURS * 86400000).toISOString();

  const { data: produits } = await admin.from('products').select('id, name, slug').eq('supplier_id', fournisseurId);
  const ids = (produits || []).map((p: any) => p.id);
  if (ids.length === 0) return NextResponse.json(vide);

  const { data: commandes } = await admin
    .from('orders')
    .select('product_id, total_amount, status, created_at, reseller_id')
    .in('product_id', ids)
    .gte('created_at', debut)
    .limit(5000);

  const limite = new Date(maintenant.getTime() - JOURS * 86400000);
  const recentes = (commandes || []).filter((c: any) => new Date(c.created_at) >= limite && c.status !== 'cancelled');
  const anciennes = (commandes || []).filter((c: any) => new Date(c.created_at) < limite && c.status !== 'cancelled');
  const livrees = recentes.filter((c: any) => c.status === 'delivered');

  // Visites : clics des liens trackés qui pointent vers ses produits.
  const slugs = (produits || []).map((p: any) => p.slug);
  const { data: liens } = await admin.from('tracking_links').select('code').eq('target_type', 'product').in('target_ref', slugs);
  const codes = (liens || []).map((l: any) => l.code);
  const { data: clics } = codes.length
    ? await admin.from('tracking_clicks').select('occurred_at').in('link_code', codes).gte('occurred_at', limite.toISOString()).limit(20000)
    : { data: [] as any[] };

  const nom = new Map((produits || []).map((p: any) => [p.id, p.name]));
  const parProduit = new Map<string, { commandes: number; ca: number }>();
  for (const c of recentes) {
    const x = parProduit.get(c.product_id) || { commandes: 0, ca: 0 };
    parProduit.set(c.product_id, { commandes: x.commandes + 1, ca: x.ca + (c.status === 'delivered' ? Number(c.total_amount) || 0 : 0) });
  }

  const { data: sponsos } = await admin
    .from('sponsorships')
    .select('id, label, subject_ref, budget, clicks, impressions, status')
    .eq('supplier_id', fournisseurId)
    .limit(50);

  const ca = livrees.reduce((s: number, c: any) => s + (Number(c.total_amount) || 0), 0);
  const nbVisites = (clics || []).length;

  return NextResponse.json({
    commandes: serieParJour(recentes.map((c: any) => ({ date: c.created_at })), JOURS, maintenant),
    ca: serieParJour(livrees.map((c: any) => ({ date: c.created_at, valeur: Number(c.total_amount) || 0 })), JOURS, maintenant),
    visites: serieParJour((clics || []).map((c: any) => ({ date: c.occurred_at })), JOURS, maintenant),
    totaux: {
      commandes: recentes.length,
      evolutionCommandes: evolution(recentes.length, anciennes.length),
      chiffreAffaires: ca,
      visites: nbVisites,
      conversion: tauxConversion(nbVisites, recentes.length),
      revendeursActifs: new Set(recentes.map((c: any) => c.reseller_id).filter(Boolean)).size,
    },
    topProduits: [...parProduit.entries()]
      .sort((a, b) => b[1].commandes - a[1].commandes)
      .slice(0, 5)
      .map(([id, v]) => ({ nom: nom.get(id) || 'Produit', ...v })),
    sponsorisations: (sponsos || []).map((s: any) => {
      const caSponso = parProduit.get(s.subject_ref)?.ca || 0;
      return {
        libelle: s.label || 'Sponsorisation', statut: s.status, budget: Number(s.budget) || 0,
        clics: Number(s.clicks) || 0, chiffreAffaires: caSponso,
        roi: retourSurInvestissement(caSponso, Number(s.budget) || 0),
      };
    }),
  });
}
