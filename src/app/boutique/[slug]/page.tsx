import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ShopView from '@/components/shop/ShopView';
import BoutonSuivre from '@/components/shop/BoutonSuivre';
import GalerieBoutique from '@/components/shop/GalerieBoutique';
import { chargerBoutiqueFournisseur, chargerBoutiqueRevendeur, chargerProduitsSuguba, URL_APP, type Boutique } from '@/lib/shop';
import { boutiqueParSlug } from '@/lib/reseau/boutiques';
import { badgesDuCompte } from '@/lib/reseau/verifications-db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { quartierReconnu } from '@/lib/reseau/proximite';

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

async function charger(slug: string): Promise<{ vitrine: Boutique; slugBoutique: string; abonnes: number; galerie: string[]; quartier: string | null } | null> {
  const boutique = await boutiqueParSlug(slug);
  if (!boutique || boutique.statut !== 'active') return null;
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
    // Le nom et le logo choisis dans « Ma boutique » l'emportent sur le nom
    // du compte : c'est bien l'enseigne que le revendeur a décidé d'afficher.
    return {
      vitrine: { ...vitrine, ...enPlus, nom: boutique.nom || vitrine.nom, logo: boutique.logo, description: boutique.description },
      slugBoutique: boutique.slug,
      abonnes: boutique.abonnes,
      galerie: boutique.galerie,
      quartier: boutique.quartier,
    };
  }

  if (boutique.typeProprietaire === 'supplier' && boutique.proprietaireId) {
    const admin = getSupabaseAdmin();
    const { data } = (await admin?.from('suppliers').select('slug, warehouse_neighborhood').eq('profile_id', boutique.proprietaireId).maybeSingle()) || { data: null };
    if (!data?.slug) return null;
    const vitrine = await chargerBoutiqueFournisseur(data.slug);
    if (!vitrine) return null;
    return {
      vitrine: { ...vitrine, ...enPlus, nom: boutique.nom || vitrine.nom, logo: boutique.logo || vitrine.logo, description: boutique.description || vitrine.description },
      slugBoutique: boutique.slug,
      abonnes: boutique.abonnes,
      galerie: boutique.galerie,
      // Sans quartier choisi pour la boutique, celui de l'entrepôt (même règle que la recherche).
      quartier: boutique.quartier || data.warehouse_neighborhood || null,
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
  const image = vitrine.produits.find((p) => p.image)?.image;

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

  return (
    <ShopView
      boutique={charge.vitrine}
      urlPartage={`${URL_APP}/boutique/${charge.slugBoutique}`}
      refCode={charge.vitrine.code}
      complement={
        <div className="space-y-4">
          {charge.quartier && quartierReconnu(charge.quartier) && (
            <Link
              href={`/boutiques?quartier=${encodeURIComponent(charge.quartier)}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 min-h-[32px]"
            >
              <MapPin className="w-3.5 h-3.5 text-[#078000]" />
              {charge.quartier}
              <span className="text-[#078000] font-bold underline underline-offset-2">· Boutiques voisines</span>
            </Link>
          )}
          <GalerieBoutique images={charge.galerie} nom={charge.vitrine.nom} />
          <BoutonSuivre slug={charge.slugBoutique} abonnesInitial={charge.abonnes} />
        </div>
      }
    />
  );
}
