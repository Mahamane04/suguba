import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import ShopView, { type ProprietaireVitrine } from '@/components/shop/ShopView';
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

/**
 * Boutique du réseau — /boutique/<adresse>.
 *
 * Adresse UNIQUE pour les trois types de boutiques (fournisseur, revendeur,
 * Suguba). Les anciennes adresses /s/<slug> et /r/<code> continuent de
 * fonctionner : elles circulent déjà dans des liens partagés et des QR codes
 * imprimés, on ne les casse pas.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };
type ParamsPage = Params & { searchParams: Promise<{ editer?: string | string[] }> };

type Charge = {
  vitrine: Boutique; slugBoutique: string; abonnes: number; galerie: string[]; quartier: string | null;
  accroche: string | null; proprietaireId: string | null; typeProprietaire: string; principale: boolean;
  /** 'active', ou 'hidden' / 'suspended' quand Suguba l'a masquée (décidé dans la page). */
  statut: string;
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
    accroche: boutique.accroche,
    proprietaireId: boutique.proprietaireId,
    typeProprietaire: boutique.typeProprietaire,
    principale: boutique.principale !== false,
    statut: boutique.statut,
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

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const charge = await charger(slug);
  if (!charge) return { title: 'Boutique introuvable — Suguba' };
  // Boutique masquée par Suguba : seul son propriétaire la voit. Titre neutre
  // (rien d'elle dans un aperçu de lien) et jamais indexée.
  if (charge.statut !== 'active') return { title: 'Boutique — Suguba', robots: { index: false, follow: false } };

  const { vitrine } = charge;
  // Même titre que la vitrine : l'enseigne, ou « La sélection de Awa D. » (lot 2).
  const titre = `${titreVitrine(vitrine)} — Suguba`;
  const description = `${vitrine.produits.length} article${vitrine.produits.length > 1 ? 's' : ''} livrés à Bamako. Vous payez à la livraison.`;
  // Aperçu WhatsApp/Facebook : la couverture, puis le logo de la boutique ;
  // une photo d'article seulement si le revendeur n'a rien personnalisé.
  const image = vitrine.couverture || vitrine.logo || vitrine.produits.find((p) => p.image)?.image;

  return {
    title: titre,
    description,
    openGraph: {
      title: titre, description, url: `${URL_APP}/boutique/${slug}`,
      siteName: 'Suguba', locale: 'fr_FR', type: 'website',
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: titre, description },
  };
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
  const demande = (await searchParams)?.editer;
  const editer = proprietaire?.gestion && typeof demande === 'string' && (PANNEAUX_EDITION as readonly string[]).includes(demande)
    ? demande as PanneauBoutique
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
