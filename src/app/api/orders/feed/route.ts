import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { refusSansPermissionAdmin } from '@/lib/reseau/permission-admin';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { commandePourLivreur, commandePourRevendeur, courseEnCours, journaliserAcces } from '@/lib/acces-contacts';

/**
 * Remplace l'ancien `fetchOrdersFromCloud` qui lisait la table `orders`
 * (noms, téléphones, adresses de clients) directement depuis le navigateur
 * avec la clé anon — exactement le chemin qui permettait la fuite décrite
 * en BUG-006/BUG-007. Le schéma corrigé ne donne plus aucun accès public en
 * lecture sur `orders` ; cette route l'expose uniquement aux comptes admin
 * et livreur authentifiés (session signée), via service_role.
 *
 * Corrigé le 2026-08-26, maintenant que les comptes livreur sont de vraies
 * lignes `profiles` (voir migration-drivers.sql) : un livreur ne voit plus
 * que ses propres courses assignées (`assigned_driver_id = session.uid`),
 * jamais l'ensemble des commandes — la limite documentait auparavant
 * l'inverse. Sans cette restriction, n'importe quel livreur pouvait lire
 * les noms/téléphones/adresses de TOUS les clients, plus le code secret de
 * livraison de commandes qui ne lui étaient pas assignées.
 *
 * `delivery_otp` n'est de toute façon plus jamais renvoyé ici : la
 * vérification se fait désormais côté serveur (voir
 * /api/driver/verify-delivery-otp), le livreur n'a plus besoin de le lire.
 */
export async function GET(req: NextRequest) {
  const refusEquipe = await refusSansPermissionAdmin(req, 'GET /api/orders/feed');
  if (refusEquipe) return refusEquipe;
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || !['admin', 'driver', 'reseller'].includes(session.role)) {
    return NextResponse.json({ error: 'Authentification interne requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Commandes indisponibles. Réessayez.' }, { status: 503 });
  }

  let query = admin.from('orders').select('*').order('created_at', { ascending: false });
  if (session.role === 'driver') {
    query = query.eq('assigned_driver_id', session.uid);
  }
  // Le revendeur était absent de cette route (401) : ses « ventes récentes »
  // affichaient donc les commandes de démonstration du store local au lieu
  // des siennes. Il ne voit que les ventes qu'il a lui-même apportées.
  if (session.role === 'reseller') {
    query = query.eq('reseller_id', session.uid);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Commandes indisponibles. Réessayez.' }, { status: 503 });
  }

  // Le code de remise est exclusivement transmis au téléphone du destinataire.
  // Point de retrait pour le livreur (2026-09-24) : le dépôt du fournisseur
  // de chaque produit — il affichait seulement « Chez <nom> », sans adresse.
  const retraits = new Map<string, Record<string, unknown>>();
  if (session.role === 'driver' && data && data.length) {
    const idsProduits = Array.from(new Set(data.map((o: any) => o.product_id).filter(Boolean)));
    const { data: produits } = await admin.from('products').select('id, supplier_id').in('id', idsProduits);
    const idsFournisseurs = Array.from(new Set((produits || []).map((p: any) => p.supplier_id).filter(Boolean)));
    const { data: fournisseurs } = idsFournisseurs.length
      ? await admin.from('suppliers').select('*').in('profile_id', idsFournisseurs)
      : { data: [] as any[] };
    const parFournisseur = new Map((fournisseurs || []).map((f: any) => [f.profile_id, f]));
    for (const p of produits || []) {
      const f: any = parFournisseur.get((p as any).supplier_id);
      if (!f) continue;
      retraits.set((p as any).id, {
        nom: f.shop_display_name || f.company_name || null,
        quartier: f.warehouse_neighborhood || null,
        adresse: f.warehouse_address || null,
        telephone: f.contact_phone || null,
        lat: typeof f.warehouse_lat === 'number' ? f.warehouse_lat : null,
        lng: typeof f.warehouse_lng === 'number' ? f.warehouse_lng : null,
      });
    }
  }

  // Coordonnées par dossier (Protection Suguba, lot 2) : le livreur ne
  // reçoit client et point de retrait que pour ses courses EN COURS ; son
  // historique est masqué. Le code de ramassage appartient au fournisseur,
  // la marge Suguba et le détail des prix ne sortent pas.
  const orders = (data || []).map((o) => {
    // Aucun rôle navigateur ne reçoit le secret de remise.
    if (session.role === 'admin') { const { delivery_otp, ...safe } = o; return safe; }
    if (session.role === 'reseller') return commandePourRevendeur(o);
    return commandePourLivreur(o, {
      pickup_location: retraits.get(o.product_id) || null,
      client_position: o.pricing_snapshot?.livraison?.position || null,
    });
  });
  if (session.role === 'driver') {
    await journaliserAcces(admin, session.uid, 'driver', 'course', (data || []).filter((o: any) => courseEnCours(o.status)).map((o: any) => o.id));
  }

  return NextResponse.json({ orders, cloud: true });
}
