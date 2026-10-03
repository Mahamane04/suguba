import { NextRequest, NextResponse } from 'next/server';
import { sessionDeLaRequete } from '@/lib/reseau/route-session';
import { exigerDroitFournisseur } from '@/lib/reseau/contexte-fournisseur';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { boutiqueParSlug, majBoutique } from '@/lib/reseau/boutiques';
import { champsBoutiqueRevendeur } from '@/lib/reseau/champs-boutique-revendeur';
import { estEnseigne, nomPublicBoutique, nomReserve } from '@/lib/enseigne';
import { partageable } from '@/lib/shop';
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
 *
 * Lot 7 du chantier boutique (2026-10-03), boutiques Pro au même niveau :
 *  - le catalogue proposé à un REVENDEUR ne contient que des articles qui lui
 *    rapportent quelque chose (`partageable`) : il pouvait cocher un article à
 *    commission nulle, que sa vitrine affichait ;
 *  - 'articles' n'efface plus la sélection avant de la réécrire (voir
 *    definirArticlesDeLaBoutique) : ordre et coups de cœur sont gardés ;
 *  - 'modifier' sert aussi aux crayons de la vitrine d'une boutique Pro
 *    (couverture, logo, nom et mot d'accueil). Pour un revendeur, la réponse porte
 *    `boutique` et `vitrine` {nom, enseigne} — le nom que voient les clients,
 *    calculé ICI — et son propre nom est enregistré en « Prénom I. », comme le
 *    fait PATCH /api/reseller/boutique pour la boutique principale.
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

  // Articles sélectionnables : ses produits pour un fournisseur ; pour un revendeur,
  // le catalogue en vente QUI LUI RAPPORTE quelque chose (lot 7) — la commission et
  // l'état du prix sont lus pour filtrer, jamais renvoyés.
  let catalogue: { id: string; nom: string; image: string | null; prix: number }[] = [];
  if (admin) {
    let requete = admin.from('products').select('id, name, images, public_price, reseller_commission, pricing_status').eq('status', 'approved').gt('public_price', 0)
      .order('created_at', { ascending: false }).limit(300);
    if (c.type === 'supplier') requete = requete.eq('supplier_id', c.proprietaireId);
    const { data } = await requete;
    catalogue = (data || []).filter((p: any) => c.type !== 'reseller' || partageable(p)).map((p: any) => ({
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
    // Relecture du lot 2 (2026-10-03) : même règle que la boutique principale,
    // un revendeur ne prend pas le nom de Suguba (son titre public est l'enseigne seule).
    if (c.type === 'reseller' && nomReserve(typeof corps.nom === 'string' ? corps.nom : '')) {
      return NextResponse.json({ error: 'Ce nom est réservé à Suguba. Choisissez le nom de votre boutique.' }, { status: 400 });
    }
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
      // Transmis tel quel : une liste absente ou illisible est REFUSÉE (lot 7). La
      // remplacer par une liste vide, comme avant, vidait la boutique.
      produits: corps.produits,
    });
    // `refuses` : nouveaux articles écartés (plus en vente, ou sans gain pour un revendeur).
    return r.ok ? NextResponse.json({ success: true, refuses: r.refuses || 0 }) : NextResponse.json({ error: r.erreur }, { status: r.statut || 400 });
  }

  if (corps.action === 'modifier') {
    const brut = typeof corps.champs === 'object' && corps.champs ? corps.champs : {};
    // Relecture du lot 2 (2026-10-03) : pour un revendeur, la liste blanche de
    // PATCH /api/reseller/boutique (images de son dossier, ni recrutement ni
    // WhatsApp, familles de l'annuaire, nom 60 et accueil 90, noms réservés).
    // Les champs bruts passaient ici, principale comprise : le durcissement du
    // lot 2 se contournait par cette action.
    let champs: Record<string, unknown> = brut;
    // Nom complet du compte (revendeur seulement) : il sert à calculer le nom
    // public et ne quitte jamais le serveur.
    let nomComplet: string | null | undefined;
    if (c.type === 'reseller') {
      const filtre = champsBoutiqueRevendeur(brut, { uid: c.proprietaireId, baseSupabase: process.env.NEXT_PUBLIC_SUPABASE_URL, boutique });
      if (!filtre.ok) return NextResponse.json({ error: filtre.erreur }, { status: 400 });
      champs = filtre.champs;
      const admin = getSupabaseAdmin();
      const { data: profil, error } = admin
        ? await admin.from('profiles').select('full_name').eq('id', c.proprietaireId).maybeSingle()
        : { data: null, error: { code: 'indisponible' } };
      if (!error && profil) {
        nomComplet = profil.full_name ?? null;
        // Son propre nom n'est pas une enseigne : enregistré en « Prénom I. » (lot 7,
        // même règle que la boutique principale).
        if (typeof champs.nom === 'string' && champs.nom.trim()) {
          champs.nom = nomPublicBoutique(champs.nom.trim().replace(/\s+/g, ' '), nomComplet);
        }
      }
    }
    const r = await majBoutique(boutique.id, c.proprietaireId, champs);
    if (!r.ok) return NextResponse.json({ error: r.erreur }, { status: 400 });
    if (c.type !== 'reseller') return NextResponse.json({ success: true });
    // Crayons de la vitrine (lot 7) : l'écran se met à jour sur place avec ce que
    // la base a gardé. Profil illisible : pas de nom public plutôt qu'un nom non vérifié.
    // L'adresse ne change jamais ici : une seule lecture suffit pour la relire.
    const apres = await boutiqueParSlug(boutique.slug);
    return NextResponse.json({
      success: true,
      boutique: apres,
      vitrine: apres && nomComplet !== undefined
        ? { nom: nomPublicBoutique(apres.nom, nomComplet), enseigne: estEnseigne(apres.nom, nomComplet) }
        : null,
    });
  }

  return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
}
