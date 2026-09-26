import { NextRequest, NextResponse } from 'next/server';
import { sessionDeLaRequete } from '@/lib/reseau/route-session';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { envoyer, lireFil, mesFils, MessageError, ouvrirFilDevis, ouvrirFilOffre, type Auteur } from '@/lib/messagerie';

/**
 * Messagerie interne (2026-09-26, Protection Suguba — lot 3), côté revendeur
 * et fournisseur.
 *
 * GET              → mes conversations sur les offres
 * GET  ?c=<id>     → messages d'une conversation
 * POST { action: 'ouvrir_offre', produitId }  (revendeur)
 * POST { action: 'ouvrir_devis', quoteId }    (fournisseur)
 * POST { action: 'envoyer', c, texte }
 */
async function auteur(req: NextRequest): Promise<Auteur | NextResponse> {
  const session = await sessionDeLaRequete(req);
  if (!session) return NextResponse.json({ error: 'Connectez-vous.' }, { status: 401 });
  if (session.role === 'reseller') return { type: 'revendeur', id: session.uid };
  if (session.role === 'supplier') {
    const acces = await exigerDroitFournisseur(req, 'commandes');
    if (!acces.ok) return NextResponse.json({ error: acces.erreur }, { status: acces.statut });
    return { type: 'fournisseur', id: acces.contexte.fournisseurId };
  }
  return NextResponse.json({ error: 'Messagerie réservée aux revendeurs et aux fournisseurs.' }, { status: 403 });
}

const repondre = (e: unknown) => e instanceof MessageError
  ? NextResponse.json({ error: e.message }, { status: e.status })
  : NextResponse.json({ error: 'Messagerie indisponible. Réessayez.' }, { status: 500 });

export async function GET(req: NextRequest) {
  const qui = await auteur(req);
  if (qui instanceof NextResponse) return qui;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ conversations: [] });
  try {
    const c = req.nextUrl.searchParams.get('c');
    if (c) return NextResponse.json(await lireFil(admin, c, qui), { headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ conversations: await mesFils(admin, qui) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return repondre(e); }
}

export async function POST(req: NextRequest) {
  const qui = await auteur(req);
  if (qui instanceof NextResponse) return qui;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  const corps = await req.json().catch(() => ({}));
  try {
    if (corps.action === 'ouvrir_offre') {
      if (qui.type !== 'revendeur') return NextResponse.json({ error: 'Réservé aux revendeurs.' }, { status: 403 });
      return NextResponse.json(await ouvrirFilOffre(admin, qui.id!, corps.produitId));
    }
    if (corps.action === 'ouvrir_devis') {
      if (qui.type !== 'fournisseur' || typeof corps.quoteId !== 'string') return NextResponse.json({ error: 'Action impossible.' }, { status: 403 });
      const { data: q } = await admin.from('quote_requests').select('id, supplier_id').eq('id', corps.quoteId).maybeSingle();
      if (!q || q.supplier_id !== qui.id) return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 });
      return NextResponse.json(await ouvrirFilDevis(admin, q));
    }
    if (corps.action === 'envoyer') return NextResponse.json(await envoyer(admin, corps.c, qui, corps.texte));
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  } catch (e) { return repondre(e); }
}
