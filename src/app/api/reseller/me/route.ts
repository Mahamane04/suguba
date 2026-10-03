import { verifyActiveSession } from '@/lib/active-session';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { libererCommissionsEchues } from '@/lib/commissions';
import { boutiqueDuProprietaire } from '@/lib/reseau/boutiques';

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
  /** Articles choisis (reseller_shop_items) ; null si le compte est illisible : « — », jamais 0. */
  articles: number | null;
  abonnes: number; statut: string;
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
        const { count, error } = await admin.from('reseller_shop_items')
          .select('product_id', { count: 'exact', head: true }).eq('reseller_id', session.uid);
        boutique = {
          slug: b.slug, nom: b.nom, logo: b.logo, couverture: b.couverture,
          articles: error || count == null ? null : count,
          abonnes: b.abonnes, statut: b.statut,
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
 */
export async function PATCH(req: NextRequest) {
  const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'reseller') {
    return NextResponse.json({ error: 'Session revendeur requise.' }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });

  const corps = await req.json().catch(() => ({}));
  const { data: profil } = await admin.from('profiles').select('metadata').eq('id', session.uid).maybeSingle();
  const metadata = { ...((profil?.metadata || {}) as Record<string, unknown>) };
  const ligne: Record<string, unknown> = {};

  if (typeof corps.fullName === 'string') {
    const nom = corps.fullName.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (nom.length < 2) return NextResponse.json({ error: 'Nom trop court.' }, { status: 400 });
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

  const { error } = await admin.from('profiles').update(ligne).eq('id', session.uid);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
