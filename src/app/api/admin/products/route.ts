import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Tous les produits (hors archivés), quel que soit leur statut — admin seul.
 * La clé anon ne lit que les produits approuvés : sans cette route, l'admin
 * n'avait aucune liste complète de son catalogue.
 */
export async function GET(req: NextRequest) {
  const refusEquipe = await refusSansPermissionAdmin(req, 'GET /api/admin/products');
  if (refusEquipe) return refusEquipe;
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Authentification admin requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const { data, error } = await admin
    .from('products')
    .select('id, name, slug, category, status, images, public_price, supplier_price, stock, supplier_name, supplier_id, created_at, commission_proposee, reseller_commission')
    .neq('status', 'archived')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Unité de vente (V2, 2026-09-27) : lue à part, pour que la liste reste
  // disponible tant que le SQL de l'unité n'est pas exécuté.
  const unites = new Map<string, { unite: string | null; contenu: number | null; mesure: string | null; min: number | null }>();
  const lectureUnites = await admin.from('products').select('id, unite_vente, contenu_valeur, contenu_mesure, quantite_min').neq('status', 'archived');
  for (const u of lectureUnites.error ? [] : lectureUnites.data || []) {
    unites.set(u.id, { unite: u.unite_vente ?? null, contenu: u.contenu_valeur == null ? null : Number(u.contenu_valeur), mesure: u.contenu_mesure ?? null, min: u.quantite_min ?? null });
  }

  return NextResponse.json({
    produits: (data || []).map((p) => ({
      id: p.id,
      nom: p.name,
      slug: p.slug,
      categorie: p.category || '',
      statut: p.status,
      images: Array.isArray(p.images) ? p.images.filter(Boolean) : [],
      prix: Number(p.public_price) || 0,
      stock: Number(p.stock) || 0,
      fournisseur: p.supplier_name || 'Suguba',
      prixFournisseur: Number(p.supplier_price) || 0,
      // Part revendeur choisie par le fournisseur (0 = calculée par Suguba) et commission en vigueur.
      partProposee: Number(p.commission_proposee) || 0,
      commission: Number(p.reseller_commission) || 0,
      // Déposé par un compte fournisseur (et non créé par l'admin) : sert à la
      // liste « Nouveautés fournisseurs », publiées automatiquement.
      fournisseurId: p.supplier_id || null,
      creeLe: p.created_at,
      uniteVente: unites.get(p.id)?.unite ?? null,
      contenuValeur: unites.get(p.id)?.contenu ?? null,
      contenuMesure: unites.get(p.id)?.mesure ?? null,
      quantiteMin: unites.get(p.id)?.min ?? null,
    })),
    uniteDisponible: !lectureUnites.error,
  });
}
