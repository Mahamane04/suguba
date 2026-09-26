import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { offresRevendeurs, protectionPrixDeGros } from '@/lib/offres-revendeurs';

/**
 * GET /api/products/offres?slug=… (2026-09-26, lot C) — offres des
 * revendeurs pour un article au prix de gros : prénom et initiale, code de
 * boutique (déjà public) et prix de vente. Jamais le prix fournisseur.
 *
 * `achatDirect` : faux quand la protection est active et qu'au moins un
 * revendeur propose l'article — la fiche affiche alors les offres à la place
 * du bouton « Commander » (le serveur refuse aussi l'achat direct).
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim().slice(0, 200);
  const admin = getSupabaseAdmin();
  const vide = { offres: [], achatDirect: true };
  if (!slug || !admin) return NextResponse.json(vide);

  const { data: produit } = await admin.from('products').select('id, public_price, mode_prix, status').eq('slug', slug).maybeSingle();
  if (!produit || produit.status !== 'approved' || produit.mode_prix !== 'gros') return NextResponse.json(vide);

  const [offres, protection] = await Promise.all([offresRevendeurs(admin, produit), protectionPrixDeGros(admin)]);
  return NextResponse.json(
    { offres, achatDirect: !(protection && offres.length > 0) },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
}
