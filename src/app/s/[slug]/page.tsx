import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ShopView from '@/components/shop/ShopView';
import { chargerBoutiqueFournisseur, URL_APP } from '@/lib/shop';

/**
 * Boutique publique d'un fournisseur — /s/<adresse>.
 *
 * Reconstruite en composant SERVEUR sur les vraies données. L'ancienne page :
 *  - lisait des données de démonstration locales au navigateur ;
 *  - retombait sur le PREMIER fournisseur venu quand l'adresse ne
 *    correspondait à personne, affichant la boutique d'un autre comme si
 *    c'était la bonne ;
 *  - publiait le téléphone et l'adresse de l'entrepôt du fournisseur — une
 *    invitation à acheter en direct, hors de Suguba ;
 *  - affichait une note « 4.9 / 5 » écrite en dur.
 *
 * Être un composant serveur permet aussi de produire les métadonnées de
 * partage : c'est ce qui fait apparaître l'image, le nom et le nombre
 * d'articles quand le lien est collé sur WhatsApp ou Facebook. Sans elles, un
 * lien partagé n'est qu'une adresse que personne n'ouvre.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ ref?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const boutique = await chargerBoutiqueFournisseur(slug);
  if (!boutique) return { title: 'Boutique introuvable — Suguba' };

  const titre = `${boutique.nom} — Boutique Suguba`;
  const description = `${boutique.produits.length} article${boutique.produits.length > 1 ? 's' : ''} livrés par Suguba à Bamako. Vous payez à la livraison.`;
  const image = boutique.produits.find((p) => p.image)?.image;
  const url = `${URL_APP}/s/${slug}`;

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

export default async function BoutiqueFournisseurPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { ref } = await searchParams;

  const boutique = await chargerBoutiqueFournisseur(slug);
  if (!boutique) notFound();

  // Une boutique fournisseur partagée par un revendeur garde son code : les
  // liens produits le transmettent, et la vente lui est attribuée.
  const refCode = ref ? String(ref).toUpperCase() : null;
  const urlPartage = `${URL_APP}/s/${slug}${refCode ? `?ref=${encodeURIComponent(refCode)}` : ''}`;

  return <ShopView boutique={boutique} urlPartage={urlPartage} refCode={refCode} />;
}
