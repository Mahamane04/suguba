import { NextRequest, NextResponse } from 'next/server';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { etapesCommande, modeRemiseCommande } from '@/lib/offre';
import { lireEtapes } from '@/lib/etapes';

/**
 * Commandes à préparer côté fournisseur (2026-09-24).
 *
 * Le fournisseur ne voyait AUCUNE commande de ses produits. Il voit
 * désormais ce qu'il doit préparer, qui vient le chercher, et le code de
 * ramassage à donner au livreur — la preuve que le colis a quitté son dépôt.
 *
 * Volontairement absents : nom et téléphone du client (le fournisseur n'en a
 * pas besoin, la livraison passe par Suguba) et le code de livraison du client.
 *
 * Exception (2026-09-26) : une offre que le fournisseur remet LUI-MÊME
 * (véhicule, installation, retrait chez lui). Il doit pouvoir joindre le
 * client pour fixer le rendez-vous : nom, téléphone et repère sont fournis,
 * seulement tant que la remise est à faire (confirmée ou en cours). Le code
 * de remise, lui, n'est jamais fourni : le client le présente sur son reçu.
 */

const LIMITE = 200;
const COLONNES = 'id, order_number, product_id, product_name, product_image, quantity, status, created_at, delivered_at, neighborhood, city, assigned_driver_name, pricing_snapshot, assigned_driver_id, customer_name, customer_phone, landmark, total_amount, payment_method, payment_collected';

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

  // Prestations à étapes (lot 1c) : le parcours des commandes qui en ont un.
  const avecEtapes = (data || []).filter((o: any) => etapesCommande(o.pricing_snapshot).length > 0).map((o: any) => o.id);
  const etapes = await lireEtapes(admin, avecEtapes).catch(() => new Map());

  const commandes = (data || []).map((o: any) => {
    const tarif = o.pricing_snapshot?.devis?.tarif;
    const unitaire = typeof tarif?.prixFournisseur === 'number' ? tarif.prixFournisseur : prixFournisseur.get(o.product_id) || 0;
    // Le code ne sert qu'entre la confirmation et le ramassage : ensuite il ne
    // doit plus circuler.
    const modeRemise = modeRemiseCommande(o.pricing_snapshot);
    const parMoi = modeRemise !== 'livreur';
    const codeUtile = !parMoi && ['confirmed', 'dispatched'].includes(o.status) && !o.picked_up_at;
    const remiseAFaire = parMoi && ['confirmed', 'in_transit'].includes(o.status);
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
      // Remise par le fournisseur (2026-09-26)
      modeRemise,
      remisePriseEnCharge: parMoi && o.assigned_driver_id === acces.contexte.fournisseurId,
      client: remiseAFaire ? { nom: o.customer_name || '', telephone: o.customer_phone || '', repere: o.landmark || null } : null,
      montantClient: parMoi ? Math.round(Number(o.total_amount) || 0) : null,
      payeEnLigne: o.payment_method === 'mobile_money' && Boolean(o.payment_collected),
      // Étapes prévues (créées à la prise en charge) et leur avancement.
      etapesPrevues: etapesCommande(o.pricing_snapshot),
      etapes: etapes.get(o.id) || [],
    };
  });
  return NextResponse.json({ commandes, ramassageActif });
}
