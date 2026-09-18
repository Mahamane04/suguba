import { NextRequest, NextResponse } from 'next/server';
import { sessionAvecRole } from '@/lib/reseau/route-session';
import { liensDuProprietaire } from '@/lib/reseau/db';
import { tauxConversion } from '@/lib/reseau/codes';
import { serieParJour } from '@/lib/reseau/stats';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Historique de partage (§ 12 des écrans) : ce qui a été partagé, sur quel
 * canal, combien de clics, combien de commandes, combien d'argent.
 */
export async function GET(req: NextRequest) {
  const session = await sessionAvecRole(req, 'reseller');
  if (!session) return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });

  const liens = await liensDuProprietaire(session.uid, 200);
  const totaux = liens.reduce(
    (acc, l) => ({
      liens: acc.liens + 1,
      clics: acc.clics + l.clics,
      visiteurs: acc.visiteurs + l.visiteurs,
      commandes: acc.commandes + l.commandes,
      chiffreAffaires: acc.chiffreAffaires + l.chiffreAffaires,
    }),
    { liens: 0, clics: 0, visiteurs: 0, commandes: 0, chiffreAffaires: 0 },
  );

  let visitesParJour = serieParJour([], 14, new Date());
  const admin = getSupabaseAdmin();
  if (admin && liens.length > 0) {
    const depuis = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data: clics } = await admin
      .from('tracking_clicks')
      .select('occurred_at')
      .in('link_code', liens.map((l) => l.code))
      .gte('occurred_at', depuis)
      .limit(20000);
    visitesParJour = serieParJour((clics || []).map((c: any) => ({ date: c.occurred_at })), 14, new Date());
  }

  return NextResponse.json({
    visitesParJour,
    liens: liens.map((l) => ({ ...l, tauxConversion: tauxConversion(l.clics, l.commandes) })),
    totaux: { ...totaux, tauxConversion: tauxConversion(totaux.clics, totaux.commandes) },
  });
}
