import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';

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
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || !['admin', 'driver', 'reseller'].includes(session.role)) {
    return NextResponse.json({ error: 'Authentification interne requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ orders: [], cloud: false });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Le code de livraison ne sort que pour l'admin : ni le livreur (qui le
  // fait saisir au client puis vérifier par le serveur) ni le revendeur
  // (qui n'a rien à voir avec la remise du colis) n'ont à le connaître.
  const orders = (data || []).map((o) => {
    if (session.role === 'admin') return o;
    const { delivery_otp, ...sansOtp } = o;
    return sansOtp;
  });

  return NextResponse.json({ orders, cloud: true });
}
