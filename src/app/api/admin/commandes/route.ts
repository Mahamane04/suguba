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
  if (!admin) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });

  const statut = req.nextUrl.searchParams.get('statut') || '';
  const q = (req.nextUrl.searchParams.get('q') || '').trim().toLowerCase();

  const page = Math.max(1, Math.min(100000, Number(req.nextUrl.searchParams.get('page')) || 1));
  if (!Number.isInteger(page) || q.length > 100) return NextResponse.json({ error: 'Recherche invalide.' }, { status: 400 });
  const { data, error } = await admin.rpc('search_admin_orders', { p_status: statut, p_query: q, p_page: page });
  if (error || !data) return NextResponse.json({ error: 'Recherche indisponible. Réessayez.' }, { status: 503 });
  const commandes = (data.orders || [])
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
  return NextResponse.json({ commandes, compteurs: data.counts, total: Number(data.total), page, taillePage: 50 });
}
