import { NextRequest, NextResponse } from 'next/server';
import { verifyActiveSession } from '@/lib/active-session';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { contexteFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { produitPourLecteur, type AccesCatalogue } from '@/lib/catalogue';
import { prixCataloguePrixDeGros } from '@/lib/offres-revendeurs';
import { normaliserCodeRevendeur } from '@/lib/ancrage-revendeur';

/**
 * Catalogue des produits approuvés (2026-09-26, lot A) — remplace la lecture
 * directe de la table `products` depuis le navigateur. Chaque lecteur ne
 * reçoit que les colonnes de son rôle (voir src/lib/catalogue.ts) : le prix
 * fournisseur n'est plus jamais envoyé à un visiteur ni à un revendeur.
 */
export async function GET(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Catalogue indisponible.' }, { status: 503 });

  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value).catch(() => null);
  let acces: AccesCatalogue = { role: 'public' };
  if (session?.role === 'admin') acces = { role: 'admin' };
  else if (session?.role === 'reseller') acces = { role: 'reseller' };
  else if (session?.role === 'supplier') {
    const ctx = await contexteFournisseur(session.uid).catch(() => null);
    if (ctx) acces = { role: 'supplier', fournisseurId: ctx.fournisseurId, voitPrix: ctx.role === 'proprietaire' || ctx.droits.includes('catalogue') };
  }

  const { data, error } = await admin.from('products').select('*').eq('status', 'approved').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Catalogue indisponible.' }, { status: 503 });

  // Visiteur : les articles au prix de gros affichent le prix des revendeurs
  // (celui de son revendeur d'origine, sinon « dès » le moins cher), comme la
  // fiche. Revendeurs, fournisseurs et admin gardent le prix conseillé.
  const prixGros = acces.role === 'public'
    ? await prixCataloguePrixDeGros(admin, data || [], normaliserCodeRevendeur(req.cookies.get('suguba_ref')?.value)).catch(() => new Map())
    : new Map();

  return NextResponse.json(
    { products: (data || []).map((p) => ({ ...produitPourLecteur(p, acces), ...(prixGros.has(p.id) ? { prix_catalogue: prixGros.get(p.id) } : {}) })) },
    // Réponse propre à chaque lecteur : jamais mise en cache partagé.
    { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } },
  );
}
