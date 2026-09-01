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
  if (!session || !['admin', 'driver'].includes(session.role)) {
    return NextResponse.json({ error: 'Authentification admin ou livreur requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ orders: [], cloud: false });
  }

  let query = admin.from('orders').select('*').order('created_at', { ascending: false });
  if (session.role === 'driver') {
    query = query.eq('assigned_driver_id', session.uid);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orders = (data || []).map((o) => {
    if (session.role === 'driver') {
      const { delivery_otp, ...sansOtp } = o;
      return sansOtp;
    }
    return o;
  });

  return NextResponse.json({ orders, cloud: true });
}
