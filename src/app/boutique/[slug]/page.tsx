import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import ShopView, { type ProprietaireVitrine, type ReglagesVitrine, type SuiviProprietaire } from '@/components/shop/ShopView';
import BoutonSuivre from '@/components/shop/BoutonSuivre';
import GalerieBoutique from '@/components/shop/GalerieBoutique';
import { chargerBoutiqueFournisseur, chargerBoutiqueRevendeur, chargerProduitsDeLaBoutique, chargerProduitsSuguba, compterArticlesNonServis, URL_APP, type Boutique } from '@/lib/shop';
import { boutiqueParSlug } from '@/lib/reseau/boutiques';
import { badgesDuCompte } from '@/lib/reseau/verifications-db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { lireReglagesReseau } from '@/lib/reseau/recompenses';
import { appliquerPrioriteReseau } from '@/lib/presentation-fournisseur';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { estEnseigne, nomPublic, titreVitrine } from '@/lib/enseigne';
import { PANNEAUX_EDITION } from '@/lib/reseau/porte-boutique';
import type { PanneauBoutique } from '@/lib/reseau/etapes-boutique';
import { RAYON_COUPS_DE_COEUR, estCleRayon, normaliserCodeLien } from '@/lib/reseau/codes';
import { cleRayon, rayonMaisonDe, RAYON_SANS_CATEGORIE, type RayonChoisi } from '@/lib/partage-boutique';
import { annonceEnCours, type ReglagesBoutique } from '@/lib/boutique-reglages';
import { aUnLienDeBoutique, compterVisitesBoutique } from '@/lib/reseau/db';
import { debutPeriode } from '@/lib/reseau/stats';

/**
 * Boutique du réseau — /boutique/<adresse>.
 *
 * Adresse UNIQUE pour les trois types de boutiques (fournisseur, revendeur,
 * Suguba). Les anciennes adresses /s/<slug> et /r/<code> continuent de
 * fonctionner : elles circulent déjà dans des liens partagés et des QR codes
 * imprimés, on ne les casse pas.
 */
export const dynamic = 'force-dynamic';

type Recherche = { editer?: string | string[]; partager?: string | string[]; rayon?: string | string[]; via?: string | string[] };
type Params = { params: Promise<{ slug: string }>; searchParams?: Promise<Recherche> };
type ParamsPage = Params;

/** Un paramètre d'adresse seul (une valeur répétée est ignorée). */
const seul = (v: string | string[] | undefined) => (typeof v === 'string' ? v : null);

/**
 * ?rayon=<cle> (lot 4 du chantier boutique, 2026-10-03) : clé valide seulement
 * ([a-z0-9-], 40 caractères au plus) ; toute autre valeur est ignorée.
 */
const rayonDemande = (v: string | string[] | undefined) => {
  const cle = seul(v);
  return cle && estCleRayon(cle) ? cle : null;
};

/**
 * Nom du rayon visé par ?rayon=, s'il existe sur la vitrine : titre d'aperçu propre
 * au rayon. Lot 6 (2026-10-03) : un rayon maison l'emporte sur la catégorie.
 */
function nomDuRayon(vitrine: Boutique, cle: string | null, rayonsMaison: readonly RayonChoisi[] = []): string | null {
  if (!cle || vitrine.selectionVide) return null;
  if (cle === RAYON_COUPS_DE_COEUR) return vitrine.produits.some((p) => p.coupDeCoeur) ? 'Coups de cœur' : null;
  const maisonDe = rayonMaisonDe(rayonsMaison);
  const rayonDe = (p: { id: string; categorie: string }) => maisonDe(p) || p.categorie || RAYON_SANS_CATEGORIE;
  const produit = vitrine.produits.find((p) => !p.coupDeCoeur && cleRayon(rayonDe(p)) === cle);
  return produit ? rayonDe(produit) : null;
}

type Charge = {
  vitrine: Boutique; slugBoutique: string; abonnes: number; galerie: string[]; quartier: string | null;
  /** Identifiant de la boutique : sujet des visites mesurées (lot 4), stable si l'adresse change. */
  storeId: string;
  accroche: string | null; proprietaireId: string | null; typeProprietaire: string; principale: boolean;
  /** 'active', ou 'hidden' / 'suspended' quand Suguba l'a masquée (décidé dans la page). */
  statut: string;
  /**
   * Réglages de vitrine (lot 6, 2026-10-03) : rayons maison et annonce datée d'une
   * boutique revendeur, déjà lus avec la boutique (aucune requête de plus). null
   * pour les autres boutiques. `option` : la colonne stores.reglages existe.
   */
  reglages: (ReglagesBoutique & { option: boolean }) | null;
};

/**
 * Lot 1 du chantier boutique (2026-10-03) :
 *  - cache() : generateMetadata et la page appelaient chacun charger(), soit
 *    deux fois la dizaine de requêtes d'une vitrine sur un réseau lent. Une
 *    seule fois par requête désormais ;
 *  - le statut est RENVOYÉ au lieu de donner null : le propriétaire d'une
 *    boutique masquée par Suguba voit sa vitrine avec la pastille « Masquée
 *    par Suguba » (il tombait sur une page introuvable sans explication) ; le
 *    visiteur, lui, obtient toujours la page introuvable (voir la page).
 */
const charger = cache(async (slug: string): Promise<Charge | null> => {
  const boutique = await boutiqueParSlug(slug);
  if (!boutique) return null;
  // Seule une boutique revendeur principale masquée reste visible (pour son
  // propriétaire) : les autres gardent la page introuvable, sans autre requête.
  if (boutique.statut !== 'active' && !(boutique.typeProprietaire === 'reseller' && boutique.principale !== false)) return null;
  const commun = {
    storeId: boutique.id,
    accroche: boutique.accroche,
    proprietaireId: boutique.proprietaireId,
    typeProprietaire: boutique.typeProprietaire,
    principale: boutique.principale !== false,
    statut: boutique.statut,
    // Boutiques revendeur seulement : le mode propriétaire côté fournisseur n'est
    // pas dans ce chantier, et rien n'écrit de réglages pour les autres boutiques.
    reglages: boutique.typeProprietaire === 'reseller' ? { ...boutique.reglages, option: boutique.options.reglages } : null,
  };
  const enPlus = {
    couverture: boutique.couverture,
    badges: boutique.proprietaireId ? await badgesDuCompte(boutique.proprietaireId) : [],
  };

  if (boutique.typeProprietaire === 'reseller' && boutique.proprietaireId) {
    const admin = getSupabaseAdmin();
    const { data } = (await admin?.from('profiles').select('reseller_code, full_name').eq('id', boutique.proprietaireId).maybeSingle()) || { data: null };
    if (!data?.reseller_code) return null;
    const vitrine = await chargerBoutiqueRevendeur(data.reseller_code);
    if (!vitrine) return null;
    // Boutique supplémentaire (formule Pro) : sa propre sélection d'articles.
    if (!boutique.principale) {
      vitrine.produits = await chargerProduitsDeLaBoutique(boutique.id, boutique.proprietaireId);
      vitrine.selectionVide = false;
    }
    // Le nom et le logo choisis dans « Ma boutique » l'emportent sur le nom
    // du compte : c'est bien l'enseigne que le revendeur a décidé d'afficher.
    // Lot 2 du chantier boutique (2026-10-03) : seulement si c'est une vraie
    // enseigne. Un nom de boutique égal au nom du compte (premières boutiques,
    // créées au nom complet) donne « Awa D. » : le nom complet ne quitte pas le serveur.
    const enseigne = estEnseigne(boutique.nom, data.full_name);
    return {
      vitrine: {
        ...vitrine, ...enPlus,
        nom: enseigne ? boutique.nom : nomPublic(data.full_name || null), enseigne,
        logo: boutique.logo, description: boutique.description,
      },
      slugBoutique: boutique.slug,
      abonnes: boutique.abonnes,
      galerie: boutique.galerie,
      quartier: boutique.quartier,
      ...commun,
    };
  }

  if (boutique.typeProprietaire === 'supplier' && boutique.proprietaireId) {
    const admin = getSupabaseAdmin();
    const { data } = (await admin?.from('suppliers').select('slug, warehouse_neighborhood').eq('profile_id', boutique.proprietaireId).maybeSingle()) || { data: null };
    if (!data?.slug) return null;
    const vitrine = await chargerBoutiqueFournisseur(data.slug, { name: boutique.nom, logo_url: boutique.logo, description: boutique.description, cover_url: boutique.couverture, status: boutique.statut });
    if (!vitrine) return null;
    if (!boutique.principale) {
      vitrine.produits = await chargerProduitsDeLaBoutique(boutique.id);
      vitrine.selectionVide = false;
    }
    // Profil « Priorité au réseau » (lot C) : présentation sans prix ni achat
    // tant que la vente directe n'est pas ouverte pour ce fournisseur.
    const presentee = admin ? await appliquerPrioriteReseau(admin, vitrine, boutique.proprietaireId, await lireReglagesReseau()) : vitrine;
    return {
      vitrine: { ...presentee, ...enPlus, nom: boutique.nom || vitrine.nom, logo: boutique.logo, description: boutique.description },
      slugBoutique: boutique.slug,
      abonnes: boutique.abonnes,
      galerie: boutique.galerie,
      // Sans quartier choisi pour la boutique, celui de l'entrepôt (même règle que la recherche).
      quartier: boutique.quartier || data.warehouse_neighborhood || null,
      ...commun,
    };
  }

  if (boutique.typeProprietaire === 'suguba') {
    const produits = await chargerProduitsSuguba();
    return {
      vitrine: {
        type: 'fournisseur', nom: boutique.nom, categorie: null, logo: boutique.logo, description: boutique.description,
        produits, livraisons: 0, selectionVide: false, code: null, ...enPlus,
      },
      slugBoutique: boutique.slug,
      abonnes: boutique.abonnes,
      galerie: boutique.galerie,
      quartier: boutique.quartier,
      ...commun,
    };
  }

  return null;
});

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { slug } = await params;
  const charge = await charger(slug);
  if (!charge) return { title: 'Boutique introuvable — Suguba' };
  // Boutique masquée par Suguba : seul son propriétaire la voit. Titre neutre
  // (rien d'elle dans un aperçu de lien) et jamais indexée.
  if (charge.statut !== 'active') return { title: 'Boutique — Suguba', robots: { index: false, follow: false } };

  const { vitrine } = charge;
  // Même titre que la vitrine : l'enseigne, ou « La sélection de Awa D. » (lot 2).
  // Lot 4 (2026-10-03) : un lien de rayon (?rayon=) annonce son rayon dans l'aperçu
  // WhatsApp (« Pagnes · Awa Mode — Suguba »).
  const rayon = nomDuRayon(vitrine, rayonDemande((await searchParams)?.rayon), charge.reglages?.rayons);
  const titre = `${rayon ? `${rayon} · ` : ''}${titreVitrine(vitrine)} — Suguba`;
  // Description de partage = le mot d'accueil choisi par le propriétaire (lot 4),
  // sinon le nombre d'articles.
  const description = charge.accroche?.trim()
    || `${vitrine.produits.length} article${vitrine.produits.length > 1 ? 's' : ''} livrés à Bamako. Vous payez à la livraison.`;
  // Aperçu WhatsApp/Facebook : la couverture, puis le logo de la boutique ;
  // une photo d'article seulement si le revendeur n'a rien personnalisé.
  const image = vitrine.couverture || vitrine.logo || vitrine.produits.find((p) => p.image)?.image;
  // Adresse de référence (lot 4) : la boutique elle-même, sans ?ref, ?via ni ?rayon.
  const canonique = `${URL_APP}/boutique/${charge.slugBoutique}`;

  return {
    title: titre,
    description,
    alternates: { canonical: canonique },
    openGraph: {
      title: titre, description, url: canonique,
      siteName: 'Suguba', locale: 'fr_FR', type: 'website',
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: titre, description },
  };
}

/**
 * Mesures du propriétaire (lot 4, 2026-10-03) : visites des 7 derniers jours
 * (bouton « Stats » du bandeau) et premier partage (étape « Partager ma
 * boutique »). Calculées ici, pour lui seul : deux requêtes de plus pour lui,
 * aucune pour un visiteur. Une lecture en échec donne « — » et une étape à faire.
 */
async function suiviDuProprietaire(storeId: string, proprietaireId: string): Promise<SuiviProprietaire> {
  const [visites7j, dejaPartage] = await Promise.all([
    compterVisitesBoutique(storeId, debutPeriode(7, new Date()).toISOString()).catch(() => null),
    aUnLienDeBoutique(proprietaireId).catch(() => null),
  ]);
  return { visites7j, dejaPartage: dejaPartage === true };
}

export default async function BoutiqueReseauPage({ params, searchParams }: ParamsPage) {
  const { slug } = await params;
  const charge = await charger(slug);
  if (!charge) notFound();

  // Le propriétaire voit « Modifier la boutique » (et une invitation à ajouter
  // logo et couverture s'ils manquent) ; les visiteurs, jamais.
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE_NAME)?.value);
  const estProprietaire = Boolean(session && !session.apercu && charge.proprietaireId && session.uid === charge.proprietaireId);
  // Vue du propriétaire (lot 1 du chantier boutique, 2026-10-03) : sa boutique
  // revendeur principale, celle qu'ouvre la porte « Ma boutique ». Le mode
  // propriétaire côté fournisseur n'est pas dans ce chantier, les boutiques
  // supplémentaires (formules Pro) viendront au lot 7 : leur rendu ne change pas.
  // `gestion` : son profil actif est revendeur ; sinon, un bandeau « Gérer » le
  // ramène à la porte unique, qui rebascule le profil.
  const proprietaire: ProprietaireVitrine | null =
    estProprietaire && charge.typeProprietaire === 'reseller' && charge.principale
      ? { statut: charge.statut, abonnes: charge.abonnes, gestion: session?.role === 'reseller' }
      : null;
  // Lot 3 (2026-10-03) : « N articles de votre sélection ne s'affichent plus ».
  // Calculé ici, pour le propriétaire seulement (une requête de plus pour lui,
  // aucune pour un visiteur) : sa sélection moins les articles réellement servis.
  if (proprietaire && charge.proprietaireId) {
    const servis = charge.vitrine.selectionVide ? [] : charge.vitrine.produits.map((p) => p.id);
    const masques = await compterArticlesNonServis(charge.proprietaireId, servis);
    if (masques > 0) proprietaire.articlesMasques = masques;
  }
  // Boutique masquée par Suguba : page introuvable pour tout autre visiteur.
  if (charge.statut !== 'active' && !proprietaire) notFound();
  // ?editer=logo|couverture|nom (porte « Ma boutique », lot 2) : ouvre le panneau,
  // seulement pour le propriétaire qui gère sa vitrine. Toute autre valeur est ignorée.
  const recherche = (await searchParams) || {};
  const demande = recherche.editer;
  const editer = proprietaire?.gestion && typeof demande === 'string' && (PANNEAUX_EDITION as readonly string[]).includes(demande)
    ? demande as PanneauBoutique
    : null;
  // Lot 4 (2026-10-03) : ?partager=1 (porte « Ma boutique », Mes clients) ouvre la
  // feuille de partage du propriétaire qui gère ; ?rayon=<cle> ouvre ce rayon.
  const partager = Boolean(proprietaire?.gestion) && seul(recherche.partager) === '1';
  const rayon = rayonDemande(recherche.rayon);
  const suiviProprietaire = proprietaire?.gestion && charge.proprietaireId
    ? await suiviDuProprietaire(charge.storeId, charge.proprietaireId)
    : null;
  // Visite mesurée (lot 4) : seulement un visiteur d'une boutique en ligne. Le
  // propriétaire n'est jamais compté, même sous un autre profil ou en vue client.
  const visite = !estProprietaire && charge.statut === 'active'
    ? { slug: charge.slugBoutique, via: normaliserCodeLien(seul(recherche.via)) }
    : null;
  // Lot 6 (2026-10-03) : rayons maison et annonce. L'annonce n'est transmise que
  // jusqu'à sa date de fin : passé ce jour, son texte ne figure plus dans la page.
  // Le propriétaire qui gère voit la tuile « Rayons » quand la base le permet.
  const reglages: ReglagesVitrine | null = charge.reglages
    ? {
      rayons: charge.reglages.rayons,
      annonce: annonceEnCours(charge.reglages.annonce)?.texte ?? null,
      option: charge.reglages.option && Boolean(proprietaire?.gestion),
    }
    : null;
  const lienModifier = !estProprietaire ? null
    : !charge.principale ? '/compte/boutiques'
      : charge.typeProprietaire === 'supplier' ? '/supplier/boutique'
        : charge.typeProprietaire === 'reseller' ? '/reseller/boutique'
          : null;

  return (
    <ShopView
      boutique={charge.vitrine}
      urlPartage={`${URL_APP}/boutique/${charge.slugBoutique}`}
      refCode={charge.vitrine.code}
      quartier={charge.quartier}
      accroche={charge.accroche}
      lienModifier={lienModifier}
      proprietaire={proprietaire}
      editer={editer}
      partager={partager}
      rayon={rayon}
      visite={visite}
      suiviProprietaire={suiviProprietaire}
      reglages={reglages}
      suivre={<BoutonSuivre slug={charge.slugBoutique} abonnesInitial={charge.abonnes} />}
      galerie={charge.galerie.length > 0 ? (
        <section className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Photos de la boutique</h2>
          <GalerieBoutique images={charge.galerie} nom={charge.vitrine.nom} />
        </section>
      ) : null}
    />
  );
}
