import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ShopView from '@/components/shop/ShopView';
import { chargerBoutiqueRevendeur, URL_APP } from '@/lib/shop';
import { titreVitrine } from '@/lib/enseigne';

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

  // Même titre que la vitrine (lot 2 du chantier boutique, 2026-10-03) : l'enseigne
  // seule, ou « La sélection de Awa D. » ; jamais le nom complet.
  const titre = `${titreVitrine(boutique)} — Suguba`;
  const description = `${boutique.produits.length} article${boutique.produits.length > 1 ? 's' : ''} livrés à Bamako. Vous payez à la livraison.`;
  // Aperçu WhatsApp/Facebook : la couverture, puis le logo de la boutique ;
  // une photo d'article seulement si le revendeur n'a rien personnalisé.
  const image = boutique.couverture || boutique.logo || boutique.produits.find((p) => p.image)?.image;
  const url = `${URL_APP}/r/${boutique.code}`;

  return {
    title: titre,
    description,
    // Lot 4 du chantier boutique (2026-10-03), décision du fondateur : l'ancienne
    // adresse désigne /boutique/<slug> comme adresse de référence (balise
    // canonical), SANS redirection. Seulement quand la boutique principale est en
    // ligne ; sinon /r/ reste la seule vitrine et n'a pas de canonical.
    ...(boutique.slugBoutique ? { alternates: { canonical: `${URL_APP}/boutique/${boutique.slugBoutique}` } } : {}),
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
