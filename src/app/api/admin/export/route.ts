import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { construireCsv, lireFiltres } from '@/lib/admin/tableau';
import { idsDuFiltre, listerCatalogue } from '@/lib/admin/catalogue-admin';
import { journaliserAction } from '@/lib/admin/journal';

/**
 * Export CSV (A4, 2026-09-27) — droit dédié « donnees.exporter », chaque
 * export est journalisé (qui, quoi, combien de lignes, quels filtres).
 * Jamais de téléphone ni d'adresse de client : l'export sert au pilotage,
 * pas à copier la base. 5 000 lignes au plus.
 */
const MAX = 5000;

export async function GET(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'GET /api/admin/export');
  if (refus) return refus;
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  const type = req.nextUrl.searchParams.get('type');
  const jour = new Date().toISOString().slice(0, 10);

  try {
    let csv = '';
    let lignes = 0;
    if (type === 'catalogue') {
      const filtres = lireFiltres(req.nextUrl.searchParams);
      const ids = await idsDuFiltre(admin, filtres, MAX);
      const pages = Math.min(Math.ceil(Math.min(ids.length, MAX) / 50), MAX / 50);
      const toutes: any[] = [];
      for (let p = 1; p <= pages; p++) toutes.push(...(await listerCatalogue(admin, filtres, p)).lignes);
      lignes = toutes.length;
      csv = construireCsv(['Identifiant', 'Produit', 'Catégorie', 'Fournisseur', 'Prix (F)', 'Unité', 'Stock', 'Statut', 'Photos', 'Créé le'],
        toutes.map((l) => [l.id, l.nom, l.categorie, l.fournisseur, l.prix, l.unite, l.stock, l.statut, l.photos, String(l.creeLe || '').slice(0, 10)]));
    } else if (type === 'commandes') {
      const statut = (req.nextUrl.searchParams.get('statut') || '').replace(/[^a-z_]/g, '').slice(0, 30);
      let q = admin.from('orders').select('order_number, created_at, status, product_name, quantity, total_amount, delivery_fee, city, neighborhood, reseller_name, assigned_driver_name, payment_method')
        .order('created_at', { ascending: false }).limit(MAX);
      if (statut) q = q.eq('status', statut);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      lignes = (data || []).length;
      csv = construireCsv(['Commande', 'Date', 'Statut', 'Produit', 'Quantité', 'Total (F)', 'Livraison (F)', 'Ville', 'Quartier', 'Revendeur', 'Livreur', 'Paiement'],
        (data || []).map((o: any) => [o.order_number, String(o.created_at || '').slice(0, 16).replace('T', ' '), o.status, o.product_name, o.quantity, o.total_amount, o.delivery_fee, o.city, o.neighborhood, o.reseller_name, o.assigned_driver_name, o.payment_method]));
    } else {
      return NextResponse.json({ error: 'Export inconnu.' }, { status: 400 });
    }

    await journaliserAction(admin, {
      auteurId: session.uid, action: `export.${type}`, dossier: `export:${type}`,
      apres: { lignes, filtres: Object.fromEntries(req.nextUrl.searchParams.entries()) },
    });
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="suguba-${type}-${jour}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Export impossible. Réessayez.' }, { status: 503 });
  }
}
