import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Clients acquis par le revendeur (§ 15 des écrans).
 *
 * Le téléphone n'est renvoyé que MASQUÉ (`•• 34 56`) : le revendeur n'a pas
 * besoin du numéro complet de ses clients, Suguba livre et rappelle. Publier
 * un fichier de numéros exploitable hors plateforme serait à la fois un risque
 * pour les clients et une invitation à vendre à côté.
 */

function masquer(telephone: string | null): string {
  const chiffres = String(telephone || '').replace(/\D/g, '');
  if (chiffres.length < 4) return '••';
  return `•• ${chiffres.slice(-4, -2)} ${chiffres.slice(-2)}`;
}

export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ clients: [] });

  const { data, error } = await admin
    .from('customer_attributions')
    .select('customer_phone, customer_name, source, first_seen_at, last_seen_at, orders_count, revenue')
    .eq('reseller_id', session.uid)
    .order('last_seen_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ clients: [] });

  return NextResponse.json({
    clients: (data || []).map((c) => ({
      prenom: (c.customer_name || '').trim().split(/\s+/)[0] || 'Client',
      telephoneMasque: masquer(c.customer_phone),
      source: c.source,
      depuis: c.first_seen_at,
      dernierPassage: c.last_seen_at,
      commandes: Number(c.orders_count) || 0,
      chiffreAffaires: Number(c.revenue) || 0,
    })),
  });
}
