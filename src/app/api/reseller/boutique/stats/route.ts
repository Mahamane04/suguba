import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { boutiqueDuProprietaire } from '@/lib/reseau/boutiques';
import { compterVitrine } from '@/lib/shop';
import { estEnseigne, nomPublic } from '@/lib/enseigne';
import { conseilBoutique, debutPeriode, plusVus, resumeVisites, PERIODES_STATS, type OrigineVisite, type PointJour } from '@/lib/reseau/stats';

/**
 * Statistiques de MA boutique (lot 4 du chantier boutique, 2026-10-03) — ROUTE PRIVÉE.
 *
 * GET ?jours=7|30, sur le modèle de /api/supplier/analyses. Identité TOUJOURS
 * tirée de la session (boutique principale du revendeur connecté).
 *
 * Chaque chiffre vient d'une source réelle ; une source qui manque (table
 * absente, lecture en échec) donne null, affiché « — » : jamais un 0 inventé,
 * jamais un taux calculé sans source.
 *  - visites, visiteurs, série par jour, origine : événements STORE_VIEW de la
 *    boutique (/api/reseau/visite-boutique) ;
 *  - clics : clics des liens suivis de la boutique (tracking_clicks) ;
 *  - commandes, livrées, gains : commandes à son nom (orders.reseller_id, hors
 *    annulées), TOUS ses liens confondus : le premier revendeur garde son client
 *    30 jours (cookie suguba_ref), on ne prétend pas savoir lesquelles viennent
 *    de la boutique. Gains = commission des commandes livrées ;
 *  - abonnés et nouveaux abonnés (store_follows) ;
 *  - 3 articles les plus vus (visites_mesurees ; table absente : null) ;
 *  - mesuré depuis : date de la première visite mesurée de la boutique.
 */

const tableAbsente = (code: unknown) => ['42P01', 'PGRST205'].includes(String(code));

export async function GET(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'reseller') {
    return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  }
  const brut = req.nextUrl.searchParams.get('jours') || '7';
  const jours = Number(brut);
  if (!(PERIODES_STATS as readonly number[]).includes(jours)) {
    return NextResponse.json({ error: 'Période inconnue (7 ou 30 jours).' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Statistiques indisponibles. Réessayez.' }, { status: 503 });

  const maintenant = new Date();
  const debut = debutPeriode(jours, maintenant);
  const depuis = debut.toISOString();
  const uid = session.uid;

  const boutique = await boutiqueDuProprietaire('reseller', uid).catch(() => null);

  // ── Identité affichée (nom public, jamais le nom complet) ─────────────────
  let identite: { slug: string; nom: string; enseigne: boolean; statut: string } | null = null;
  if (boutique) {
    const { data: profil, error } = await admin.from('profiles').select('full_name').eq('id', uid).maybeSingle();
    const nomComplet = error ? null : (profil?.full_name ?? null);
    const enseigne = !error && estEnseigne(boutique.nom, nomComplet);
    identite = { slug: boutique.slug, nom: enseigne ? boutique.nom : nomPublic(nomComplet), enseigne, statut: boutique.statut };
  }

  // ── Visites de la boutique ────────────────────────────────────────────────
  let visites: number | null = null;
  let visiteurs: number | null = null;
  let serie: PointJour[] | null = null;
  let origine: Record<OrigineVisite, number> | null = null;
  let mesureDepuis: string | null = null;
  if (boutique) {
    const { data, error } = await admin
      .from('analytics_events')
      .select('occurred_at, meta')
      .eq('event', 'STORE_VIEW')
      .eq('subject_ref', boutique.id)
      .gte('occurred_at', depuis)
      .limit(20000);
    if (!error && Array.isArray(data)) {
      const r = resumeVisites(data as { occurred_at: string; meta?: Record<string, unknown> | null }[], jours, maintenant);
      ({ visites, visiteurs, serie, origine } = r);
      const { data: premiere, error: erreurPremiere } = await admin
        .from('analytics_events')
        .select('occurred_at')
        .eq('event', 'STORE_VIEW')
        .eq('subject_ref', boutique.id)
        .order('occurred_at', { ascending: true })
        .limit(1);
      if (!erreurPremiere && Array.isArray(premiere) && premiere[0]?.occurred_at) mesureDepuis = String(premiere[0].occurred_at);
    }
  }

  // ── Clics des liens suivis de la boutique ────────────────────────────────
  let clics: number | null = null;
  {
    const { data: liens, error } = await admin.from('tracking_links').select('code').eq('owner_id', uid).eq('target_type', 'store');
    if (!error && Array.isArray(liens)) {
      const codes = liens.map((l: any) => l.code).filter(Boolean);
      if (codes.length === 0) clics = 0;
      else {
        const { data: lus, error: erreurClics } = await admin
          .from('tracking_clicks').select('occurred_at').in('link_code', codes).gte('occurred_at', depuis).limit(20000);
        if (!erreurClics && Array.isArray(lus)) clics = lus.length;
      }
    }
  }

  // ── Commandes à son nom (tous ses liens) ──────────────────────────────────
  let commandes: number | null = null;
  let livrees: number | null = null;
  let gains: number | null = null;
  {
    const { data, error } = await admin
      .from('orders')
      .select('status, reseller_commission, created_at')
      .eq('reseller_id', uid)
      .gte('created_at', depuis)
      .limit(5000);
    if (!error && Array.isArray(data)) {
      const valides = data.filter((c: any) => c.status !== 'cancelled');
      const livreesListe = valides.filter((c: any) => c.status === 'delivered');
      commandes = valides.length;
      livrees = livreesListe.length;
      gains = livreesListe.reduce((s: number, c: any) => s + (Number(c.reseller_commission) || 0), 0);
    }
  }

  // ── Abonnés ───────────────────────────────────────────────────────────────
  const abonnes: number | null = boutique ? boutique.abonnes : null;
  let nouveauxAbonnes: number | null = null;
  if (boutique) {
    const { count, error } = await admin
      .from('store_follows')
      .select('store_id', { count: 'exact', head: true })
      .eq('store_id', boutique.id)
      .gte('created_at', depuis);
    if (!error && typeof count === 'number') nouveauxAbonnes = count;
  }

  // ── Articles les plus vus (visites mesurées des fiches produit) ───────────
  let articlesVus: { nom: string; vues: number }[] | null = null;
  {
    const { data, error } = await admin
      .from('visites_mesurees')
      .select('product_id, etat')
      .eq('reseller_id', uid)
      .gte('jour', depuis.slice(0, 10))
      .limit(20000);
    if (!error && Array.isArray(data)) {
      const top = plusVus(data.filter((l: any) => l.etat !== 'robot'));
      if (top.length === 0) articlesVus = [];
      else {
        const { data: produits, error: erreurProduits } = await admin.from('products').select('id, name').in('id', top.map((t) => t.id));
        if (!erreurProduits && Array.isArray(produits)) {
          const noms = new Map(produits.map((p: any) => [p.id, p.name]));
          articlesVus = top.map((t) => ({ nom: String(noms.get(t.id) || 'Article'), vues: t.vues }));
        }
      }
    } else if (error && !tableAbsente(error.code)) {
      console.error('[STATS BOUTIQUE] visites_mesurees:', error.code);
    }
  }

  const coupsDeCoeur = boutique ? (await compterVitrine(admin, uid).catch(() => ({ coupsDeCoeur: null }))).coupsDeCoeur : null;

  return NextResponse.json({
    jours,
    boutique: identite,
    visites, visiteurs, serie, origine, clics,
    commandes, livrees, gains,
    abonnes, nouveauxAbonnes,
    articlesVus,
    mesureDepuis,
    conseil: conseilBoutique({ visites, commandes, coupsDeCoeur, origine }),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
