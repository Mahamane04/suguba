import { NextRequest, NextResponse } from 'next/server';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Commandes à préparer côté fournisseur (2026-09-24).
 *
 * Le fournisseur ne voyait AUCUNE commande de ses produits. Il voit
 * désormais ce qu'il doit préparer, qui vient le chercher, et le code de
 * ramassage à donner au livreur — la preuve que le colis a quitté son dépôt.
 *
 * Volontairement absents : nom et téléphone du client (le fournisseur n'en a
 * pas besoin, la livraison passe par Suguba) et le code de livraison du client.
 */

const LIMITE = 200;
const COLONNES = 'id, order_number, product_id, product_name, product_image, quantity, status, created_at, delivered_at, neighborhood, city, assigned_driver_name, pricing_snapshot';

export async function GET(req: NextRequest) {
  const acces = await exigerDroitFournisseur(req, 'commandes');
  if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ commandes: [] });

  const { data: produits } = await admin.from('products')
    .select('id, supplier_price').eq('supplier_id', acces.contexte.fournisseurId).limit(2000);
  const ids = (produits || []).map((p: any) => p.id);
  if (ids.length === 0) return NextResponse.json({ commandes: [], ramassageActif: true });
  const prixFournisseur = new Map((produits || []).map((p: any) => [p.id, Number(p.supplier_price) || 0]));

  let ramassageActif = true;
  let { data, error }: { data: any[] | null; error: { code?: string } | null } = await admin.from('orders')
    .select(`${COLONNES}, pickup_code, picked_up_at`)
    .in('product_id', ids).order('created_at', { ascending: false }).limit(LIMITE);
  if (error?.code === '42703') {
    ramassageActif = false;
    ({ data, error } = await admin.from('orders').select(COLONNES)
      .in('product_id', ids).order('created_at', { ascending: false }).limit(LIMITE));
  }
  if (error) return NextResponse.json({ error: 'Lecture des commandes impossible.' }, { status: 500 });

  const commandes = (data || []).map((o: any) => {
    const tarif = o.pricing_snapshot?.devis?.tarif;
    const unitaire = typeof tarif?.prixFournisseur === 'number' ? tarif.prixFournisseur : prixFournisseur.get(o.product_id) || 0;
    // Le code ne sert qu'entre la confirmation et le ramassage : ensuite il ne
    // doit plus circuler.
    const codeUtile = ['confirmed', 'dispatched'].includes(o.status) && !o.picked_up_at;
    return {
      id: o.id,
      numero: o.order_number,
      produit: o.product_name,
      image: o.product_image || null,
      quantite: Number(o.quantity) || 1,
      montantFournisseur: unitaire * (Number(o.quantity) || 1),
      statut: o.status,
      creeLe: o.created_at,
      livreeLe: o.delivered_at || null,
      recupereeLe: o.picked_up_at || null,
      quartierClient: o.neighborhood || null,
      ville: o.city || null,
      livreur: o.assigned_driver_name || null,
      codeRamassage: codeUtile ? o.pickup_code || null : null,
    };
  });
  return NextResponse.json({ commandes, ramassageActif });
}
