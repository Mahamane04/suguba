import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { normaliserUniteVente } from '@/lib/unite-vente';

/**
 * Unité de vente d'un produit existant (V2, 2026-09-27) : l'admin précise à
 * quoi correspond le prix (« lot de 4 »…) des produits publiés avant que le
 * champ existe. Le prix ne change pas : pas de nouvelle tarification.
 */
export async function POST(req: NextRequest) {
  const refus = await refusSansPermissionAdmin(req, 'POST /api/admin/products/unite');
  if (refus) return refus;
  if (!(await sessionAvecRole(req, 'admin'))) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const corps = await req.json().catch(() => ({}));
  const productId = typeof corps.productId === 'string' ? corps.productId.slice(0, 80) : '';
  if (!productId) return NextResponse.json({ error: 'Produit inconnu.' }, { status: 400 });
  const u = normaliserUniteVente(corps.uniteVente, corps.contenuValeur, corps.contenuMesure, corps.quantiteMin);
  if (!u.ok) return NextResponse.json({ error: u.erreur }, { status: 400 });

  const { data, error } = await admin.from('products')
    .update({ unite_vente: u.unite, contenu_valeur: u.contenu, contenu_mesure: u.mesure, quantite_min: u.quantiteMin })
    .eq('id', productId).select('id').maybeSingle();
  if (error) {
    if (String(error.code) === '42703' || /unite_vente|contenu_|quantite_min/.test(error.message)) {
      return NextResponse.json({ error: 'Exécutez d’abord le SQL de l’unité de vente.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 503 });
  }
  if (!data) return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 });
  return NextResponse.json({ ok: true, uniteVente: u.unite, contenuValeur: u.contenu, contenuMesure: u.mesure, quantiteMin: u.quantiteMin });
}
