import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { adminPeut } from '@/lib/reseau/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { CATALOGUE_BADGES } from '@/lib/reseau/badges';
import { reactiver, suspendre, suspensionsEnCours, SuspensionError } from '@/lib/suspensions';

/**
 * Annuaire admin (§ pages 38 à 41) : clients, revendeurs, fournisseurs,
 * livreurs — avec les chiffres utiles à chacun, et deux actions : suspendre /
 * réactiver un rôle, attribuer / retirer un badge manuel.
 *
 * Les CLIENTS sont surtout des invités sans compte : ils sont reconstitués à
 * partir des commandes (par téléphone), pas de la table des profils.
 */

type Onglet = 'clients' | 'revendeurs' | 'fournisseurs' | 'livreurs';
const ROLE: Record<Exclude<Onglet, 'clients'>, string> = { revendeurs: 'reseller', fournisseurs: 'supplier', livreurs: 'driver' };

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  if (!(await adminPeut(session.uid, 'utilisateur.lire'))) {
    return NextResponse.json({ error: 'Votre rôle ne donne pas accès aux utilisateurs.' }, { status: 403 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ lignes: [] });

  const onglet = (req.nextUrl.searchParams.get('onglet') || 'revendeurs') as Onglet;
  const q = (req.nextUrl.searchParams.get('q') || '').trim().toLowerCase();

  if (onglet === 'clients') {
    const { data: commandes } = await admin.from('orders')
      .select('customer_name, customer_phone, total_amount, status, created_at, reseller_name')
      .order('created_at', { ascending: false }).limit(5000);
    const parTel = new Map<string, any>();
    for (const c of commandes || []) {
      const x = parTel.get(c.customer_phone) || { nom: c.customer_name, telephone: c.customer_phone, commandes: 0, livrees: 0, montant: 0, derniere: c.created_at, referent: c.reseller_name || null };
      x.commandes += 1;
      if (c.status === 'delivered') { x.livrees += 1; x.montant += Number(c.total_amount) || 0; }
      parTel.set(c.customer_phone, x);
    }
    const lignes = [...parTel.values()]
      .filter((c) => !q || String(c.nom).toLowerCase().includes(q) || String(c.telephone).includes(q))
      .slice(0, 200);
    return NextResponse.json({ lignes, badges: [] });
  }

  const role = ROLE[onglet];
  if (!role) return NextResponse.json({ error: 'Onglet inconnu.' }, { status: 400 });
  const { data: roles } = await admin.from('profile_roles').select('profile_id, status, created_at').eq('role', role).limit(2000);
  const ids = (roles || []).map((r: any) => r.profile_id);
  if (ids.length === 0) return NextResponse.json({ lignes: [], badges: CATALOGUE_BADGES });

  const [{ data: profils }, { data: badges }] = await Promise.all([
    admin.from('profiles').select('id, full_name, phone, email, city, reseller_code, created_at').in('id', ids),
    admin.from('user_badges').select('profile_id, badge').in('profile_id', ids),
  ]);

  // Chiffres par rôle, en un aller-retour chacun.
  const stats = new Map<string, Record<string, number>>();
  const ajouter = (id: string, cle: string, v: number) => {
    const x = stats.get(id) || {};
    x[cle] = (x[cle] || 0) + v;
    stats.set(id, x);
  };
  if (role === 'reseller') {
    const { data } = await admin.from('orders').select('reseller_id, status, reseller_commission').in('reseller_id', ids).limit(10000);
    for (const o of data || []) {
      ajouter(o.reseller_id, 'ventes', 1);
      if (o.status === 'delivered') ajouter(o.reseller_id, 'commissions', Number(o.reseller_commission) || 0);
    }
  } else if (role === 'supplier') {
    const { data } = await admin.from('products').select('supplier_id, status').in('supplier_id', ids).limit(10000);
    for (const p of data || []) { ajouter(p.supplier_id, 'produits', 1); if (p.status === 'approved') ajouter(p.supplier_id, 'enVente', 1); }
  } else if (role === 'driver') {
    const { data } = await admin.from('orders').select('assigned_driver_id, status').in('assigned_driver_id', ids).limit(10000);
    for (const o of data || []) if (o.status === 'delivered') ajouter(o.assigned_driver_id, 'livraisons', 1);
  }

  const statut = new Map((roles || []).map((r: any) => [r.profile_id, r.status]));
  // Suspension motivée en cours (Protection Suguba, lot 3), et sa contestation.
  const suspensions = await suspensionsEnCours(admin, ids, role);
  const lignes = (profils || [])
    .map((p: any) => ({
      id: p.id, nom: p.full_name, telephone: p.phone, email: p.email, ville: p.city, code: p.reseller_code,
      statut: statut.get(p.id), inscritLe: p.created_at,
      badges: (badges || []).filter((b: any) => b.profile_id === p.id).map((b: any) => b.badge),
      stats: stats.get(p.id) || {},
      suspension: suspensions.get(p.id) || null,
    }))
    .filter((p) => !q || [p.nom, p.telephone, p.email, p.code].some((v) => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => String(b.inscritLe).localeCompare(String(a.inscritLe)))
    .slice(0, 200);

  return NextResponse.json({ lignes, badges: CATALOGUE_BADGES.filter((b) => !b.automatique) });
}

export async function POST(req: NextRequest) {
  const session = await sessionAvecRole(req, 'admin');
  if (!session) return NextResponse.json({ error: 'Session admin requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  const c = await req.json().catch(() => ({}));
  if (typeof c.profileId !== 'string') return NextResponse.json({ error: 'Compte requis.' }, { status: 400 });
  if (c.profileId === session.uid) return NextResponse.json({ error: 'Action impossible sur votre propre compte.' }, { status: 403 });

  if (c.action === 'statut') {
    if (!(await adminPeut(session.uid, 'utilisateur.moderer'))) return NextResponse.json({ error: 'Votre rôle ne permet pas de suspendre un compte.' }, { status: 403 });
    const role = ROLE[c.onglet as keyof typeof ROLE];
    if (!role || !['active', 'suspended'].includes(c.statut)) return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
    // Suspension motivée et contestable ; les engagements en cours restent
    // (commandes, gains) et sont renvoyés à l'admin pour qu'il les traite.
    try {
      if (c.statut === 'suspended') return NextResponse.json({ success: true, ...(await suspendre(admin, session.uid, c.profileId, role, c.motif)) });
      return NextResponse.json({ success: true, ...(await reactiver(admin, session.uid, c.profileId, role, c.decision)) });
    } catch (e) {
      if (e instanceof SuspensionError) return NextResponse.json({ error: e.message }, { status: e.status });
      return NextResponse.json({ error: 'Action impossible. Réessayez.' }, { status: 500 });
    }
  }

  if (c.action === 'badge') {
    if (!(await adminPeut(session.uid, 'verification.decider'))) return NextResponse.json({ error: 'Votre rôle ne permet pas d’attribuer un badge.' }, { status: 403 });
    // Badges MANUELS seulement : les automatiques sont recalculés par des
    // règles, un ajout à la main serait effacé ou contredit au prochain calcul.
    if (!CATALOGUE_BADGES.some((b) => b.cle === c.badge && !b.automatique)) return NextResponse.json({ error: 'Badge inconnu.' }, { status: 400 });
    const r = c.retirer
      ? await admin.from('user_badges').delete().eq('profile_id', c.profileId).eq('badge', c.badge)
      : await admin.from('user_badges').upsert({ profile_id: c.profileId, badge: c.badge, granted_by: session.uid }, { onConflict: 'profile_id,badge' });
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
}
