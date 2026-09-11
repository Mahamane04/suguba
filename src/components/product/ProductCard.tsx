'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Carrousel from '@/components/product/Carrousel';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { partagerProduit, prechargerImage, useCodeRevendeur } from '@/lib/partage';
import type { Product } from '@/types';
import { Loader2 } from 'lucide-react';

export interface ProduitCarte {
  id: string;
  slug: string;
  nom: string;
  prix: number;
  categorie?: string;
  images: string[];
  enStock?: boolean;
  commission?: number;
}

export function carteDepuisProduit(p: Product): ProduitCarte {
  return {
    id: p.id,
    slug: p.slug,
    nom: p.name,
    prix: p.publicPrice,
    categorie: p.category,
    images: p.images,
    enStock: p.stockQuantity > 0,
    commission: p.resellerCommission,
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
  children,
}: {
  produit: ProduitCarte;
  /** Code de la visite en cours (boutique /r/ ou lien ?ref=) : porté par le lien d'achat. */
  refCode?: string | null;
  afficherCommission?: boolean;
  /** Catalogue revendeur : le partage devient l'action principale. */
  partageEnAvant?: boolean;
  priority?: boolean;
  children?: React.ReactNode;
}) {
  const monCode = useCodeRevendeur();
  const [preparation, setPreparation] = useState(false);
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
  const precharger = () => { prechargerImage(produit.images[0], produit.slug); };

  const boutonPartage = (pleineLargeur: boolean) => (
    <button
      type="button"
      onClick={partager}
      onPointerDown={precharger}
      onMouseEnter={precharger}
      disabled={preparation}
      aria-label={`Partager ${produit.nom} sur WhatsApp`}
      className={`h-9 rounded-2xl bg-[#25D366] hover:bg-[#1ebe5b] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] disabled:opacity-70 ${
        pleineLargeur ? 'w-full' : 'px-3 shrink-0'
      }`}
    >
      {preparation ? <Loader2 className="w-4 h-4 animate-spin" /> : <WhatsAppIcon className="w-4 h-4" />}
      <span className={pleineLargeur ? '' : 'hidden sm:inline'}>{pleineLargeur ? 'Partager sur WhatsApp' : 'Partager'}</span>
    </button>
  );

  return (
    <article className="bg-white rounded-3xl overflow-hidden border border-slate-200 hover:border-slate-300 hover:shadow-card-hover transition-all flex flex-col">
      <div className="relative">
        <Carrousel images={produit.images} alt={produit.nom} href={lien} priority={priority} />
        {enRupture && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-slate-900/85 text-white text-[11px] font-bold pointer-events-none">
            Rupture de stock
          </span>
        )}
        {afficherCommission && (produit.commission ?? 0) > 0 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-suguba-brand text-white text-[11px] font-black shadow pointer-events-none">
            +{produit.commission!.toLocaleString('fr-FR')} F
          </span>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <Link href={lien} className="block">
          <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 min-h-[2.5rem] hover:text-suguba-brand transition-colors">
            {produit.nom}
          </h3>
        </Link>
        <p className="text-base sm:text-lg font-black text-slate-900 leading-none">
          {produit.prix.toLocaleString('fr-FR')} <span className="text-xs font-bold">F</span>
        </p>
        <p className="text-[11px] text-slate-500">
          {afficherCommission && (produit.commission ?? 0) > 0
            ? <>Vous gagnez <strong className="text-suguba-brand">{produit.commission!.toLocaleString('fr-FR')} F</strong></>
            : 'Payez à la livraison'}
        </p>

        <div className="mt-auto pt-1.5 space-y-2">
          {partageEnAvant ? (
            boutonPartage(true)
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
    </article>
  );
}
