'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Carrousel from '@/components/product/Carrousel';
import AfficheModal from '@/components/product/AfficheModal';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { compterClic } from '@/lib/sponsorises';
import { partagerProduit, prechargerImage, prechargerLienPartage, useCodeRevendeur } from '@/lib/partage';
import type { Product } from '@/types';
import { libelleTypeOffre, normaliserTypeOffre } from '@/lib/offre';
import { Loader2, Image as ImageIcon } from 'lucide-react';

export interface ProduitCarte {
  id: string;
  slug: string;
  nom: string;
  prix: number;
  categorie?: string;
  images: string[];
  enStock?: boolean;
  commission?: number;
  /** Article au prix de gros : le revendeur fixe son prix (2026-09-24). */
  prixLibre?: boolean;
  /** « Service », « Installation incluse » ou « Remis par le vendeur » (2026-09-26). */
  etiquetteOffre?: string | null;
  /** Article au prix de gros vu par un visiteur : prix des revendeurs (2026-09-26). */
  mentionPrix?: 'partenaire' | 'des' | null;
}

export function carteDepuisProduit(p: Product): ProduitCarte {
  const nature = libelleTypeOffre(normaliserTypeOffre(p.typeOffre));
  return {
    etiquetteOffre: p.modeCommande === 'devis' ? 'Sur devis'
      : nature || (p.modeRemise === 'fournisseur' ? 'Remis par le vendeur' : p.modeRemise === 'retrait' ? 'Chez le vendeur' : null),
    id: p.id,
    slug: p.slug,
    nom: p.name,
    prix: p.prixCatalogue?.prix ?? p.publicPrice,
    mentionPrix: p.prixCatalogue?.mention ?? null,
    categorie: p.category,
    images: p.images,
    enStock: p.stockQuantity > 0,
    commission: p.resellerCommission,
    prixLibre: p.modePrix === 'gros',
  };
}

/**
 * Carte produit unique de l'application (2026-09-11). Elle remplace trois
 * cartes écrites séparément — accueil, catalogue revendeur, boutiques — qui
 * divergeaient déjà (tailles, prix, badges, actions).
 *
 * Inspirée des grandes places de marché mobiles : photo carrée qui domine,
 * plusieurs photos à balayer, nom sur deux lignes, prix en gros, et une action
 * claire. Pensée d'abord pour deux colonnes sur un téléphone.
 *
 * Le bouton de partage porte le logo WhatsApp et partage en un clic la photo +
 * le texte + le lien (voir src/lib/partage.ts). Le lien porte le code du
 * revendeur connecté ; à défaut, celui de la boutique visitée.
 */
export default function ProductCard({
  produit,
  refCode = null,
  afficherCommission = false,
  partageEnAvant = false,
  priority = false,
  sponsorisationId = null,
  presentation = false,
  children,
}: {
  produit: ProduitCarte;
  /** Code de la visite en cours (boutique /r/ ou lien ?ref=) : porté par le lien d'achat. */
  refCode?: string | null;
  afficherCommission?: boolean;
  /** Catalogue revendeur : le partage devient l'action principale. */
  partageEnAvant?: boolean;
  priority?: boolean;
  /**
   * Carte mise en avant par une sponsorisation payée (§ 17). Elle est
   * MARQUÉE « Sponsorisé » : une publicité qui se fait passer pour un
   * résultat naturel trompe le client.
   */
  sponsorisationId?: string | null;
  /**
   * Boutique fournisseur en page de présentation (lot C, 2026-09-26) : ni
   * prix ni achat ici, seulement « Voir le produit ».
   */
  presentation?: boolean;
  children?: React.ReactNode;
}) {
  const monCode = useCodeRevendeur();
  const [preparation, setPreparation] = useState(false);
  const [afficheOuverte, setAfficheOuverte] = useState(false);
  const lien = `/p/${produit.slug}${refCode ? `?ref=${encodeURIComponent(refCode)}` : ''}`;
  const enRupture = produit.enStock === false;

  const partager = async () => {
    setPreparation(true);
    try {
      await partagerProduit(
        { nom: produit.nom, prix: produit.prix, slug: produit.slug, images: produit.images },
        monCode || refCode,
      );
    } finally {
      setPreparation(false);
    }
  };
  const precharger = () => {
    prechargerImage(produit.images[0], produit.slug);
    // Le lien tracké se prépare en même temps que la photo : au clic, il
    // est déjà là et le partage reste dans le geste de l'utilisateur.
    if (monCode) prechargerLienPartage(produit.slug);
  };

  const boutonPartage = (pleineLargeur: boolean) => (
    <button
      type="button"
      onClick={partager}
      onPointerDown={precharger}
      onMouseEnter={precharger}
      disabled={preparation}
      aria-label={`Partager ${produit.nom} sur WhatsApp`}
      className={`h-9 rounded-2xl bg-suguba-wa hover:bg-[#1fbf5b] text-suguba-profond font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] disabled:opacity-70 ${
        pleineLargeur ? 'flex-1 min-w-0' : 'px-3 shrink-0'
      }`}
    >
      {preparation ? <Loader2 className="w-4 h-4 animate-spin" /> : <WhatsAppIcon className="w-4 h-4" />}
      {pleineLargeur ? (
        <>
          <span className="sm:hidden">Partager</span>
          <span className="hidden sm:inline">Partager sur WhatsApp</span>
        </>
      ) : (
        <span className="hidden sm:inline">Partager</span>
      )}
    </button>
  );

  return (
    <article
      className="bg-white rounded-3xl overflow-hidden border border-slate-200 hover:border-slate-300 hover:shadow-card-hover transition-all flex flex-col"
      onClickCapture={sponsorisationId ? (e) => {
        if ((e.target as HTMLElement).closest('a')) compterClic(sponsorisationId);
      } : undefined}
    >
      <div className="relative">
        <Carrousel images={produit.images} alt={produit.nom} href={lien} priority={priority} />
        {sponsorisationId && (
          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-white/95 text-slate-700 text-xs font-bold border border-slate-200 pointer-events-none">
            Sponsorisé
          </span>
        )}
        {enRupture ? (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-slate-900/85 text-white text-xs font-bold pointer-events-none">
            Rupture de stock
          </span>
        ) : produit.etiquetteOffre && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-white/95 text-suguba-profond text-xs font-bold border border-slate-200 pointer-events-none">
            {produit.etiquetteOffre}
          </span>
        )}
        {afficherCommission && (produit.commission ?? 0) > 0 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-suguba-citron text-suguba-profond text-xs font-bold shadow pointer-events-none">
            {produit.prixLibre ? 'Prix libre · ' : ''}+{produit.commission!.toLocaleString('fr-FR')} F
          </span>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <Link href={lien} className="block">
          <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 min-h-[2.5rem] hover:text-suguba-brand transition-colors">
            {produit.nom}
          </h3>
        </Link>
        {presentation ? (
          <p className="text-xs text-slate-500">{produit.categorie}</p>
        ) : (
        <>
        <p className="text-base sm:text-lg font-bold text-slate-900 leading-none">
          {produit.mentionPrix === 'des' && <span className="text-xs font-bold text-slate-500">dès </span>}
          {produit.prix.toLocaleString('fr-FR')} <span className="text-xs font-bold">F</span>
        </p>
        <p className="text-xs text-slate-500">
          {afficherCommission && (produit.commission ?? 0) > 0
            ? <>Vous gagnez <strong className="text-suguba-brand-dark">{produit.commission!.toLocaleString('fr-FR')} F</strong></>
            : produit.mentionPrix === 'des' ? 'Prix de nos revendeurs'
              : produit.mentionPrix === 'partenaire' ? 'Prix de votre partenaire'
                : 'Payez à la livraison'}
        </p>
        </>
        )}

        <div className="mt-auto pt-1.5 space-y-2">
          {presentation ? (
            <Button href={lien} variant="secondary" size="sm" fullWidth className="!h-9 !py-0">Voir le produit</Button>
          ) : partageEnAvant ? (
            // Catalogue revendeur : partage direct + affiche pour le statut.
            <div className="flex items-center gap-2">
              {boutonPartage(true)}
              <button
                type="button"
                onClick={() => setAfficheOuverte(true)}
                aria-label={`Créer une affiche de ${produit.nom} pour mon statut WhatsApp`}
                title="Affiche pour mon statut"
                className="h-9 w-9 shrink-0 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 inline-flex items-center justify-center"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button href={lien} variant="secondary" size="sm" className="flex-1 !h-9 !py-0">
                {enRupture ? 'Voir' : 'Acheter'}
              </Button>
              {boutonPartage(false)}
            </div>
          )}
          {children}
        </div>
      </div>

      {afficheOuverte && (
        <AfficheModal
          produit={{ nom: produit.nom, prix: produit.prix, slug: produit.slug, images: produit.images }}
          onClose={() => setAfficheOuverte(false)}
        />
      )}
    </article>
  );
}
