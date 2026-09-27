import { NextRequest, NextResponse } from 'next/server';
import { avecJournal } from '@/lib/admin/journal-route';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { appliquerMajCommande, COLONNES_COMMANDE_EXISTANTE, majPourAction } from '@/lib/commande-admin';
import { modeRemiseCommande } from '@/lib/offre';

/**
 * Vision globale des commandes (§ page 45) : filtres par statut, recherche
 * (numéro, client, téléphone), regroupement des articles d'un même panier.
 *
 * POST (lot U2, 2026-09-27) : « Confirmer » après l'appel au client et
 * « Attribuer un livreur » — ces actions n'existaient que sur l'ancienne vue
 * d'ensemble, que le Support ne voyait même pas dans son menu. Mêmes règles
 * que /api/orders/sync (voir src/lib/commande-admin.ts).
 */

/** Attribution groupée : une tournée, pas tout le catalogue. */
const MAX_ATTRIBUTION_GROUPEE = 20;
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
      // Pour agir sans quitter la liste (U2) : repère, paiement, mode de remise.
      repere: o.landmark || null, paiement: o.payment_method || null,
      livreurId: o.assigned_driver_id || null, remise: modeRemiseCommande(o.pricing_snapshot),
    }));
  return NextResponse.json({ commandes, compteurs: data.counts, total: Number(data.total), page, taillePage: 50 });
}

export async function POST(req: NextRequest) {
  return avecJournal(req, 'POST /api/admin/commandes', () => postInterne(req));
}

async function postInterne(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const corps = await req.json().catch(() => ({}));
  const action = corps.action === 'confirmer' || corps.action === 'attribuer' ? corps.action : null;
  if (!action) return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });

  // Confirmer : modifier les commandes. Attribuer : gérer les livraisons, ou
  // modifier les commandes (le Support attribuait déjà depuis la vue d'ensemble).
  const permis = action === 'confirmer'
    ? await adminPeut(session.uid, 'commande.modifier')
    : (await adminPeut(session.uid, 'livraison.gerer')) || (await adminPeut(session.uid, 'commande.modifier'));
  if (!permis) return NextResponse.json({ error: 'Votre rôle ne permet pas cette action sur les commandes.' }, { status: 403 });

  const ids: string[] = Array.isArray(corps.orderIds) ? corps.orderIds.filter((x: unknown) => typeof x === 'string' && x) : typeof corps.orderId === 'string' && corps.orderId ? [corps.orderId] : [];
  if (!ids.length) return NextResponse.json({ error: 'Commande requise.' }, { status: 400 });
  if (ids.length > (action === 'attribuer' ? MAX_ATTRIBUTION_GROUPEE : 1)) {
    return NextResponse.json({ error: `Au plus ${MAX_ATTRIBUTION_GROUPEE} commandes à la fois.` }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });

  let livreur: { id: string; nom: string } | null = null;
  if (action === 'attribuer') {
    if (typeof corps.driverId !== 'string' || !corps.driverId) return NextResponse.json({ error: 'Choisissez un livreur.' }, { status: 400 });
    // Le nom vient de la base, jamais du navigateur.
    const { data: p } = await admin.from('profiles').select('id, full_name').eq('id', corps.driverId).maybeSingle();
    if (!p) return NextResponse.json({ error: 'Livreur introuvable.' }, { status: 404 });
    livreur = { id: p.id, nom: p.full_name || 'Livreur' };
  }

  const resultats: { id: string; numero: string | null; ok: boolean; error?: string }[] = [];
  for (const id of ids) {
    const { data: existing, error } = await admin.from('orders').select(COLONNES_COMMANDE_EXISTANTE).eq('id', id).maybeSingle();
    if (error) { resultats.push({ id, numero: null, ok: false, error: 'Lecture indisponible.' }); continue; }
    if (!existing) { resultats.push({ id, numero: null, ok: false, error: 'Commande introuvable.' }); continue; }
    const demande = majPourAction(action, existing.status, livreur);
    if ('erreur' in demande) { resultats.push({ id, numero: existing.order_number, ok: false, error: demande.erreur }); continue; }
    const r = await appliquerMajCommande(admin, existing as any, demande.maj);
    resultats.push(r.ok ? { id, numero: existing.order_number, ok: true } : { id, numero: existing.order_number, ok: false, error: r.error });
  }

  const reussies = resultats.filter((r) => r.ok).length;
  if (ids.length === 1) {
    const r = resultats[0];
    return r.ok
      ? NextResponse.json({ success: true, resultats, message: action === 'confirmer' ? `Commande ${r.numero} confirmée.` : `Commande ${r.numero} attribuée à ${livreur?.nom}.` })
      : NextResponse.json({ error: r.error, resultats }, { status: 409 });
  }
  // Groupée : 200 dès qu'au moins une passe, le détail dit lesquelles ont échoué.
  return NextResponse.json(
    { success: reussies > 0, resultats, message: `${reussies} commande${reussies > 1 ? 's' : ''} sur ${ids.length} attribuée${reussies > 1 ? 's' : ''} à ${livreur?.nom}.` },
    { status: reussies > 0 ? 200 : 409 },
  );
}
