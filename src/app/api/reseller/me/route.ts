import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { libererCommissionsEchues } from '@/lib/commissions';
import { boutiqueDuProprietaire, realignerBoutiquesAvantNouveauNom } from '@/lib/reseau/boutiques';
import type { RayonMaison } from '@/lib/boutique-reglages';
import { compterVitrine } from '@/lib/shop';
import { estEnseigne, nomPublic, nomReserve } from '@/lib/enseigne';
import { etapesBoutique, type EtapeBoutique } from '@/lib/reseau/etapes-boutique';
import { aUnLienDeBoutique } from '@/lib/reseau/db';

/**
 * Fiche revendeur réelle du compte connecté.
 *
 * Contrairement à `suppliers` et `drivers`, aucune table dédiée n'est créée :
 * tout est déjà là et se déduit sans risque de désynchronisation.
 *   - le code de parrainage vit dans profiles.reseller_code
 *   - les soldes se calculent sur le grand-livre `commissions`
 *   - le nombre de ventes réussies se compte sur `orders` livrées
 *   - le palier se DÉDUIT de ce compte réel, il n'est jamais stocké
 * Dupliquer ces chiffres dans une table `resellers` créerait exactement le
 * problème déjà rencontré ailleurs : deux vérités qui divergent.
 *
 * ⚠️ Le code de parrainage est la donnée critique de ce rôle. L'interface le
 * lisait dans le store de démo, donc un vrai revendeur partageait des liens
 * portant le code d'un revendeur fictif (`MOUSSA123`) : la résolution
 * serveur (voir /api/orders/sync) ne trouvait aucun profil correspondant, et
 * il ne touchait donc AUCUNE commission sur les ventes qu'il générait.
 */

/** Aperçu de la boutique pour la carte « Ma boutique » de l'accueil (?avec=boutique). */
interface ApercuBoutique {
  slug: string; nom: string; logo: string | null; couverture: string | null;
  /** `nom` est une enseigne choisie (sinon « Awa D. ») : titre du message de partage (lot 4). */
  enseigne: boolean;
  /**
   * Articles choisis que la vitrine affiche (approuvés et partageables, même
   * filtre qu'elle) ; null si le compte est illisible : « — », jamais 0.
   */
  articles: number | null;
  abonnes: number; statut: string;
  /** « Ma boutique est prête à X % » (lot 2 du chantier boutique, 2026-10-03). */
  etapes: EtapeBoutique[];
  /**
   * Rayons maison (lot 6, 2026-10-03) : proposés par la feuille « Partager ma
   * boutique ». Présents seulement s'il y en a : avant le SQL, l'aperçu est
   * exactement celui du lot 5.
   */
  rayons?: RayonMaison[];
}

// Mêmes seuils que la règle appliquée jusqu'ici côté client.
function paliers(ventes: number): 'new' | 'verified' | 'vip' {
  if (ventes >= 30) return 'vip';
  if (ventes >= 10) return 'verified';
  return 'new';
}

export async function GET(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'reseller') {
    return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Votre solde est indisponible. Réessayez.' }, { status: 503 });
  }

  // Les commissions dont le délai de sécurité est écoulé deviennent
  // retirables ici, à la lecture — pas de tâche planifiée à maintenir, et
  // aucun décalage entre le solde affiché et le solde réellement retirable.
  await libererCommissionsEchues(admin);

  const results = await Promise.all([
    admin.from('profiles').select('reseller_code, full_name, phone, metadata, city').eq('id', session.uid).maybeSingle(),
    admin.from('commissions').select('amount, status, unlock_at, order_id').eq('reseller_id', session.uid),
    admin.from('orders').select('id', { count: 'exact', head: true })
      .eq('reseller_id', session.uid).eq('status', 'delivered'),
  ]);

  if (results.some(result => result.error) || !results[0].data || !Array.isArray(results[1].data) || results[2].count == null) {
    return NextResponse.json({ error: 'Votre solde et votre palier sont indisponibles. Réessayez.' }, { status: 503 });
  }
  const [{ data: profil }, { data: commissions }, { count: ventesLivrees }] = results;
  const lignes = commissions || [];
  const somme = (statut: string) =>
    lignes.filter((c) => c.status === statut).reduce((total, c) => total + Number(c.amount), 0);

  const ventes = ventesLivrees || 0;
  const metadata = (profil?.metadata || {}) as Record<string, unknown>;

  // Carte « Ma boutique » de l'accueil (lot 1 du chantier boutique, 2026-10-03).
  // Lue seulement sur demande : le catalogue et le démarrage, qui appellent
  // aussi cette route, ne paient aucune requête de plus. Lue APRÈS les soldes
  // et dans un try : une boutique illisible donne boutique: null, jamais un
  // 503 qui rendrait le solde « indisponible ». Rien n'est créé ici.
  let boutique: ApercuBoutique | null = null;
  if (req.nextUrl.searchParams.get('avec') === 'boutique') {
    try {
      const b = await boutiqueDuProprietaire('reseller', session.uid);
      if (b) {
        // Même filtre que la vitrine (relecture du lot 1, 2026-10-03) : un article
        // retiré ou refusé n'y apparaît pas, il ne doit pas compter ici. Lot 3 :
        // + les coups de cœur parmi eux (étape « 1 coup de cœur »), même lecture.
        const { articles, coupsDeCoeur } = await compterVitrine(admin, session.uid);
        // Lot 2 (2026-10-03) : le nom que voient les clients (l'enseigne, ou
        // « Awa D. »), comme sur la vitrine ; le nom complet reste ici.
        const enseigne = estEnseigne(b.nom, profil?.full_name);
        // Lot 4 (2026-10-03) : étape « Partager ma boutique » (un lien suivi existe).
        const partage = await aUnLienDeBoutique(session.uid);
        boutique = {
          slug: b.slug, nom: enseigne ? b.nom : nomPublic(profil?.full_name || null), enseigne, logo: b.logo, couverture: b.couverture,
          articles,
          abonnes: b.abonnes, statut: b.statut,
          etapes: etapesBoutique({ enseigne, logo: b.logo, couverture: b.couverture, accueil: b.accroche, articles, coupsDeCoeur, partage }),
          ...(b.reglages.rayons.length > 0 ? { rayons: b.reglages.rayons } : {}),
        };
      }
    } catch {
      boutique = null;
    }
  }

  return NextResponse.json({
    ...(req.nextUrl.searchParams.get('avec') === 'boutique' ? { boutique } : {}),
    reseller: {
      referralCode: profil?.reseller_code || null,
      fullName: profil?.full_name || null,
      phone: profil?.phone || null,
      tier: paliers(ventes),
      successfulOrdersCount: ventes,
      availableBalance: somme('available'),
      // `locked` = vente acquise mais délai de sécurité en cours.
      pendingBalance: somme('pending') + somme('locked'),
      // Délai passé mais toujours bloqué : vente payée en espèces dont
      // l'argent n'est pas encore reversé à Suguba (Protection Suguba).
      attenteFondsBalance: lignes
        .filter((c) => c.status === 'locked' && c.order_id && c.unlock_at && Date.parse(c.unlock_at) <= Date.now())
        .reduce((total, c) => total + Number(c.amount), 0),
      reservedBalance: somme('reserved'),
      commissionsEnAttente: lignes.filter(c => ['pending', 'locked'].includes(c.status)).map(c => ({
        commande: c.order_id || null, montant: Number(c.amount), statut: c.status,
        debloquagePrevu: c.status === 'locked' ? c.unlock_at || null : null,
      })),
      // Toutes les commissions rattachées à une vente (REV-01, audit UI/UX du
      // 2026-10-02) : « Mes ventes » dit enfin, vente par vente, quand
      // l'argent devient retirable, ou s'il est déjà versé.
      commissionsParVente: lignes.filter((c) => c.order_id).map((c) => ({
        commande: c.order_id, montant: Number(c.amount), statut: c.status, debloquagePrevu: c.unlock_at || null,
      })),
      totalEarned: somme('paid'),
      momoNumber: metadata.momoNumber ? String(metadata.momoNumber) : null,
      momoProvider: metadata.momoProvider ? String(metadata.momoProvider) : null,
      neighborhood: metadata.neighborhood ? String(metadata.neighborhood) : null,
      city: profil?.city || null,
      address: metadata.address ? String(metadata.address) : null,
      categories: Array.isArray(metadata.categories) ? metadata.categories.map(String) : [],
      onboardingDone: Boolean(metadata.onboardingDone),
    },
  });
}

/**
 * Mise à jour de la fiche par l'assistant de démarrage (/reseller/demarrer).
 *
 * Liste blanche stricte. `metadata` est FUSIONNÉ, jamais remplacé : il porte
 * aussi le numéro Mobile Money de versement — l'écraser couperait les retraits
 * du revendeur sans qu'il s'en aperçoive.
 *
 * Relecture finale du chantier boutique (2026-10-04), changement du nom du compte :
 *  - le profil est LU avant toute écriture, et un profil illisible arrête tout
 *    (503) : l'ancien nom sert à réaligner les boutiques, et `metadata` fusionné
 *    sur une lecture ratée perdait le numéro Mobile Money ;
 *  - un nom réservé à Suguba (« Suguba », « Admin »…) est refusé : il s'affichait
 *    « La sélection de Suguba », « Nouveautés chez Suguba » ;
 *  - les boutiques du compte sont réalignées AVANT le profil
 *    (realignerBoutiquesAvantNouveauNom) : une ancienne boutique au nom complet
 *    (« Awa Traore Dialo ») passait pour une enseigne dès que le compte était
 *    corrigé en « Awa Traoré Diallo », et s'affichait en clair. Réalignement
 *    impossible : le nom n'est pas changé, rien d'autre n'est écrit.
 */
export async function PATCH(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'reseller') {
    return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  }
  // Aperçu d'un administrateur : identité fictive, aucun profil à lire ni à écrire.
  if (session.apercu) return NextResponse.json({ error: 'Aperçu : rien n’est enregistré.' }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const corps = await req.json().catch(() => ({}));
  const { data: profil, error: lecture } = await admin.from('profiles').select('full_name, metadata').eq('id', session.uid).maybeSingle();
  if (lecture || !profil) return NextResponse.json({ error: 'Votre profil est indisponible. Réessayez.' }, { status: 503 });
  const metadata = { ...((profil.metadata || {}) as Record<string, unknown>) };
  const ligne: Record<string, unknown> = {};

  if (typeof corps.fullName === 'string') {
    const nom = corps.fullName.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (nom.length < 2) return NextResponse.json({ error: 'Nom trop court.' }, { status: 400 });
    if (nomReserve(nom)) return NextResponse.json({ error: 'Ce nom est réservé à Suguba. Indiquez votre nom.' }, { status: 400 });
    ligne.full_name = nom;
  }
  if (typeof corps.city === 'string' && corps.city.trim()) ligne.city = corps.city.trim().slice(0, 60);
  if (typeof corps.neighborhood === 'string') metadata.neighborhood = corps.neighborhood.trim().slice(0, 80) || null;
  if (typeof corps.address === 'string') metadata.address = corps.address.trim().slice(0, 200) || null;
  if (Array.isArray(corps.categories)) {
    metadata.categories = corps.categories.filter((c: unknown) => typeof c === 'string').slice(0, 12);
  }
  if (corps.onboardingDone === true) metadata.onboardingDone = true;
  ligne.metadata = metadata;

  // Nom changé : les boutiques d'abord. Aucun état intermédiaire où l'ancien nom
  // complet d'une boutique deviendrait public.
  let annulerBoutiques: (() => Promise<void>) | null = null;
  if (typeof ligne.full_name === 'string') {
    const boutiques = await realignerBoutiquesAvantNouveauNom(admin, session.uid, profil.full_name ?? null, ligne.full_name);
    if (!boutiques.ok) return NextResponse.json({ error: 'Votre nom n’a pas pu être changé pour le moment. Réessayez.' }, { status: 503 });
    annulerBoutiques = boutiques.annuler;
  }

  const { error } = await admin.from('profiles').update(ligne).eq('id', session.uid);
  if (error) {
    // Le nom n'a pas changé : les boutiques reprennent le leur.
    await annulerBoutiques?.();
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
