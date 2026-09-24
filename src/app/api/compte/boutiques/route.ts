import { NextRequest, NextResponse } from 'next/server';
import { sessionDeLaRequete } from '@/lib/reseau/route-session';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { majBoutique } from '@/lib/reseau/boutiques';
import {
  articlesDeLaBoutique, boutiqueDuCompte, boutiquesDuCompte, creerBoutiqueSupplementaire,
  definirArticlesDeLaBoutique, demanderFormule, formulesBoutiques, situationFormule,
  type TypeCompteBoutique,
} from '@/lib/reseau/boutiques-multiples';

/**
 * Mes boutiques (2026-09-24) — revendeur ou fournisseur, selon l'espace actif.
 *
 * GET  : boutiques du compte, formule en cours, limite, demande en attente,
 *        formules disponibles et articles sélectionnables.
 * POST : { action: 'creer' | 'articles' | 'modifier' | 'demander_formule', … }
 */

/** Numéro Mobile Money de Suguba affiché pour payer une formule. */
const NUMERO_PAIEMENT = '+223 89 46 00 00';

async function compte(req: NextRequest): Promise<{ type: TypeCompteBoutique; proprietaireId: string } | { erreur: string; statut: number }> {
  const session = await sessionDeLaRequete(req);
  if (!session) return { erreur: 'Connectez-vous.', statut: 401 };
  if (session.role === 'reseller') return { type: 'reseller', proprietaireId: session.uid };
  if (session.role === 'supplier') {
    const acces = await exigerDroitFournisseur(req, 'boutique');
    if (!acces.ok) return { erreur: acces.erreur, statut: acces.statut };
    return { type: 'supplier', proprietaireId: acces.contexte.fournisseurId };
  }
  return { erreur: 'Réservé aux revendeurs et fournisseurs.', statut: 403 };
}

export async function GET(req: NextRequest) {
  const c = await compte(req);
  if ('erreur' in c) return NextResponse.json({ error: c.erreur }, { status: c.statut });
  const admin = getSupabaseAdmin();

  const [boutiques, situation, formules] = await Promise.all([
    boutiquesDuCompte(c.type, c.proprietaireId),
    situationFormule(c.type, c.proprietaireId),
    formulesBoutiques(),
  ]);
  const articles = Object.fromEntries(await Promise.all(
    boutiques.filter((b) => !b.principale).map(async (b) => [b.id, await articlesDeLaBoutique(b.id)] as const),
  ));

  // Articles sélectionnables : ses produits pour un fournisseur, le catalogue en vente pour un revendeur.
  let catalogue: { id: string; nom: string; image: string | null; prix: number }[] = [];
  if (admin) {
    let requete = admin.from('products').select('id, name, images, public_price').eq('status', 'approved').gt('public_price', 0)
      .order('created_at', { ascending: false }).limit(300);
    if (c.type === 'supplier') requete = requete.eq('supplier_id', c.proprietaireId);
    const { data } = await requete;
    catalogue = (data || []).map((p: any) => ({
      id: p.id, nom: p.name, image: Array.isArray(p.images) ? p.images[0] || null : null, prix: Number(p.public_price) || 0,
    }));
  }

  return NextResponse.json({
    type: c.type, boutiques, articles, catalogue,
    limite: situation.limite, formule: situation.formule, planActif: situation.planActif,
    demande: situation.demande, disponible: situation.disponible, formules, numeroPaiement: NUMERO_PAIEMENT,
  });
}

export async function POST(req: NextRequest) {
  const c = await compte(req);
  if ('erreur' in c) return NextResponse.json({ error: c.erreur }, { status: c.statut });
  const corps = await req.json().catch(() => ({}));

  if (corps.action === 'creer') {
    const r = await creerBoutiqueSupplementaire({
      type: c.type, proprietaireId: c.proprietaireId,
      nom: typeof corps.nom === 'string' ? corps.nom : '', quartier: typeof corps.quartier === 'string' && corps.quartier ? corps.quartier : null,
    });
    return r.ok ? NextResponse.json({ boutique: r.boutique }) : NextResponse.json({ error: r.erreur }, { status: r.statut });
  }

  if (corps.action === 'demander_formule') {
    const r = await demanderFormule(c.type, c.proprietaireId, String(corps.formuleId || ''));
    return r.ok ? NextResponse.json({ plan: r.plan, numeroPaiement: NUMERO_PAIEMENT }) : NextResponse.json({ error: r.erreur }, { status: r.statut });
  }

  // Les actions suivantes portent sur une boutique qui doit appartenir au compte.
  const boutique = typeof corps.boutiqueId === 'string' ? await boutiqueDuCompte(c.type, c.proprietaireId, corps.boutiqueId) : null;
  if (!boutique) return NextResponse.json({ error: 'Boutique introuvable.' }, { status: 404 });

  if (corps.action === 'articles') {
    if (boutique.principale) return NextResponse.json({ error: 'Les articles de la boutique principale se gèrent dans « Ma boutique ».' }, { status: 400 });
    const r = await definirArticlesDeLaBoutique({
      type: c.type, proprietaireId: c.proprietaireId, boutiqueId: boutique.id,
      produits: Array.isArray(corps.produits) ? corps.produits : [],
    });
    return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: r.erreur }, { status: 400 });
  }

  if (corps.action === 'modifier') {
    const r = await majBoutique(boutique.id, c.proprietaireId, typeof corps.champs === 'object' && corps.champs ? corps.champs : {});
    return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: r.erreur }, { status: 400 });
  }

  return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
}
