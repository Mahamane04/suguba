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
 * Limite connue : sans un vrai système d'identifiants livreur persistés
 * (hors périmètre de ce correctif), un livreur voit ici l'ensemble des
 * commandes plutôt que ses seules courses assignées — à restreindre par
 * `assigned_driver_id = session.uid` dès que les comptes livreur seront
 * réellement liés à des lignes `profiles`.
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

  const { data, error } = await admin.from('orders').select('*').order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data || [], cloud: true });
}
