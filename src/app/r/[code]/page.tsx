import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ShopView from '@/components/shop/ShopView';
import { chargerBoutiqueRevendeur, URL_APP } from '@/lib/shop';

/**
 * Boutique publique d'un revendeur — /r/<code revendeur>.
 *
 * Le revendeur n'a pas de stock : il choisit ses articles dans le catalogue
 * approuvé (voir /reseller/catalog). Chaque lien de la vitrine porte son code,
 * si bien que toute vente passée depuis sa boutique lui est attribuée sans
 * qu'il ait rien d'autre à faire.
 *
 * Seul un prénom et une initiale sont affichés : suffisant pour une vitrine,
 * sans publier le nom complet d'un particulier.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  const boutique = await chargerBoutiqueRevendeur(code);
  if (!boutique) return { title: 'Boutique introuvable — Suguba' };

  const titre = `La sélection de ${boutique.nom} — Suguba`;
  const description = `${boutique.produits.length} article${boutique.produits.length > 1 ? 's' : ''} livrés à Bamako. Vous payez à la livraison.`;
  const image = boutique.produits.find((p) => p.image)?.image;
  const url = `${URL_APP}/r/${boutique.code}`;

  return {
    title: titre,
    description,
    openGraph: {
      title: titre,
      description,
      url,
      siteName: 'Suguba',
      locale: 'fr_FR',
      type: 'website',
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: titre, description },
  };
}

export default async function BoutiqueRevendeurPage({ params }: Params) {
  const { code } = await params;
  const boutique = await chargerBoutiqueRevendeur(code);
  if (!boutique || !boutique.code) notFound();

  return <ShopView boutique={boutique} urlPartage={`${URL_APP}/r/${boutique.code}`} refCode={boutique.code} />;
}
