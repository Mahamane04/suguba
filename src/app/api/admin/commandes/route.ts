import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Vision globale des commandes (§ page 45) : filtres par statut, recherche
 * (numéro, client, téléphone), regroupement des articles d'un même panier.
 * Lecture seule : les changements de statut restent sur la vue globale, qui
 * applique déjà les règles (code de livraison, commissions).
 */
export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'commande.lire'))) return NextResponse.json({ error: 'Votre rôle ne donne pas accès aux commandes.' }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ commandes: [], compteurs: {} });

  const statut = req.nextUrl.searchParams.get('statut') || '';
  const q = (req.nextUrl.searchParams.get('q') || '').trim().toLowerCase();

  let requete = admin.from('orders').select('*').order('created_at', { ascending: false }).limit(300);
  if (statut) requete = requete.eq('status', statut);
  const { data } = await requete;

  const { data: tous } = await admin.from('orders').select('status').limit(20000);
  const compteurs: Record<string, number> = {};
  for (const o of tous || []) compteurs[o.status] = (compteurs[o.status] || 0) + 1;

  const commandes = (data || [])
    .filter((o: any) => !q || [o.order_number, o.customer_name, o.customer_phone, o.product_name, o.reseller_code].some((v) => String(v || '').toLowerCase().includes(q)))
    .map((o: any) => ({
      id: o.id, numero: o.order_number, produit: o.product_name, quantite: Number(o.quantity) || 1,
      total: Number(o.total_amount) || 0, livraison: Number(o.delivery_fee) || 0, statut: o.status,
      client: o.customer_name, telephone: o.customer_phone, ville: o.city, quartier: o.neighborhood,
      revendeur: o.reseller_name || null, livreur: o.assigned_driver_name || null,
      panier: o.cart_id || null, lien: o.link_code || null, creeLe: o.created_at,
      // Ramassage (2026-09-24) : l'admin peut donner le code pour le stock Suguba.
      codeRamassage: ['confirmed', 'dispatched'].includes(o.status) && !o.picked_up_at ? o.pickup_code || null : null,
      recupereeLe: o.picked_up_at || null,
    }));
  return NextResponse.json({ commandes, compteurs });
}
