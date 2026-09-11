import type { Metadata } from 'next';
import { chargerProduitPublic, URL_APP } from '@/lib/shop';

/**
 * Aperçu de partage de la page produit (2026-09-11).
 *
 * La page elle-même est rendue dans le navigateur ('use client') : sans ce
 * layout serveur, elle n'avait AUCUNE métadonnée. WhatsApp, qui lit la page
 * sans exécuter son JavaScript, ne trouvait donc ni image, ni nom, ni prix, et
 * affichait un lien nu. C'est ce qui rendait les partages si peu engageants.
 *
 * Tant qu'un produit n'a pas de photo, l'aperçu montre le logo Suguba plutôt
 * que rien.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const produit = await chargerProduitPublic(slug);
  if (!produit) return { title: 'Produit introuvable — Suguba' };

  const titre = `${produit.nom} — ${produit.prix.toLocaleString('fr-FR')} F`;
  const description = 'Vous payez à la livraison. Livré chez vous à Bamako par Suguba.';
  const image = produit.image || `${URL_APP}/icon-512.png`;

  return {
    title: `${titre} | Suguba`,
    description,
    openGraph: {
      title: titre,
      description,
      url: `${URL_APP}/p/${slug}`,
      siteName: 'Suguba',
      locale: 'fr_FR',
      type: 'website',
      images: [{ url: image, alt: produit.nom }],
    },
    twitter: { card: produit.image ? 'summary_large_image' : 'summary', title: titre, description, images: [image] },
  };
}

export default function ProduitLayout({ children }: { children: React.ReactNode }) {
  return children;
}
