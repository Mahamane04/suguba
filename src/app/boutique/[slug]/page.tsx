import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ShopView from '@/components/shop/ShopView';
import BoutonSuivre from '@/components/shop/BoutonSuivre';
import GalerieBoutique from '@/components/shop/GalerieBoutique';
import { chargerBoutiqueFournisseur, chargerBoutiqueRevendeur, chargerProduitsDeLaBoutique, chargerProduitsSuguba, URL_APP, type Boutique } from '@/lib/shop';
import { boutiqueParSlug } from '@/lib/reseau/boutiques';
import { badgesDuCompte } from '@/lib/reseau/verifications-db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session';

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

type Charge = {
  vitrine: Boutique; slugBoutique: string; abonnes: number; galerie: string[]; quartier: string | null;
  accroche: string | null; proprietaireId: string | null; typeProprietaire: string; principale: boolean;
};

async function charger(slug: string): Promise<Charge | null> {
  const boutique = await boutiqueParSlug(slug);
  if (!boutique || boutique.statut !== 'active') return null;
  const commun = {
    accroche: boutique.accroche,
    proprietaireId: boutique.proprietaireId,
    typeProprietaire: boutique.typeProprietaire,
    principale: boutique.principale !== false,
  };
  const enPlus = {
    couverture: boutique.couverture,
    badges: boutique.proprietaireId ? await badgesDuCompte(boutique.proprietaireId) : [],
  };

  if (boutique.typeProprietaire === 'reseller' && boutique.proprietaireId) {
    const admin = getSupabaseAdmin();
    const { data } = (await admin?.from('profiles').select('reseller_code').eq('id', boutique.proprietaireId).maybeSingle()) || { data: null };
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
    return {
      vitrine: { ...vitrine, ...enPlus, nom: boutique.nom || vitrine.nom, logo: boutique.logo, description: boutique.description },
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
    const vitrine = await chargerBoutiqueFournisseur(data.slug);
    if (!vitrine) return null;
    if (!boutique.principale) {
      vitrine.produits = await chargerProduitsDeLaBoutique(boutique.id);
      vitrine.selectionVide = false;
    }
    return {
      vitrine: { ...vitrine, ...enPlus, nom: boutique.nom || vitrine.nom, logo: boutique.logo || vitrine.logo, description: boutique.description || vitrine.description },
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
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const charge = await charger(slug);
  if (!charge) return { title: 'Boutique introuvable — Suguba' };

  const { vitrine } = charge;
  const titre = `${vitrine.nom} — Suguba`;
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

export default async function BoutiqueReseauPage({ params }: Params) {
  const { slug } = await params;
  const charge = await charger(slug);
  if (!charge) notFound();

  // Le propriétaire voit « Modifier la boutique » (et une invitation à ajouter
  // logo et couverture s'ils manquent) ; les visiteurs, jamais.
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE_NAME)?.value);
  const estProprietaire = Boolean(session && !session.apercu && charge.proprietaireId && session.uid === charge.proprietaireId);
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
