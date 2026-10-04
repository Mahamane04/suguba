'use client';

import SugubaLoader from '@/components/ui/SugubaLoader';

import React, { useState } from 'react';
import Link from 'next/link';
import Carrousel from '@/components/product/Carrousel';
import AfficheModal from '@/components/product/AfficheModal';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import BoutonPartageWhatsApp from '@/components/ui/BoutonPartageWhatsApp';
import { compterClic } from '@/lib/sponsorises';
import { partagerProduit, prechargerImage, prechargerLienPartage, useCodeRevendeur } from '@/lib/partage';
import type { Product } from '@/types';
import { libelleTypeOffre, normaliserTypeOffre } from '@/lib/offre';
import { Image as ImageIcon, ShoppingBag, Check } from 'lucide-react';
import { ajoutDirectPossible, suffixeUnite, texteMinimum } from '@/lib/unite-vente';
import { ajouterAuPanier } from '@/lib/panier';
import { useToast } from '@/components/ui/Toast';
import { formatF, formatNombre } from '@/lib/montant';

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
  /** « / lot de 4 », « / kg »… (V2, 2026-09-27) ; vide si non renseignée. */
  suffixeUnite?: string;
  /** « Minimum : 2 m » (quantité minimale du vendeur). */
  minimum?: string;
  /** Quantité ajoutée d'un geste : le minimum du vendeur, sinon 1. */
  quantiteAjout?: number;
  /** Offre simple : « Ajouter » au panier depuis la carte. */
  ajoutDirect?: boolean;
  /** Variantes à choisir sur la fiche : bouton « Choisir ». */
  aChoisir?: boolean;
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
    suffixeUnite: suffixeUnite(p.uniteVente, p.contenuValeur, p.contenuMesure),
    minimum: texteMinimum(p.uniteVente, p.quantiteMin),
    quantiteAjout: p.quantiteMin && p.quantiteMin > 1 ? p.quantiteMin : 1,
    ajoutDirect: ajoutDirectPossible({
      enStock: p.stockQuantity > 0, modeCommande: p.modeCommande, modePrix: p.modePrix,
      variantes: Boolean(p.variantGroup), modeRemise: p.modeRemise,
    }),
    aChoisir: Boolean(p.variantGroup) && p.stockQuantity > 0,
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
  codePartage = null,
  afficherCommission = false,
  partageEnAvant = false,
  priority = false,
  sponsorisationId = null,
  presentation = false,
  children,
  hrefStudio,
}: {
  produit: ProduitCarte;
  /** Code de la visite en cours (boutique /r/ ou lien ?ref=) : porté par le lien d'achat. */
  refCode?: string | null;
  /**
   * Code du partage quand le lien d'achat n'en porte pas (2026-10-03) : le
   * propriétaire sur sa vitrine n'a pas de ?ref= (il deviendrait son propre
   * revendeur d'origine), mais l'article qu'il partage garde son code.
   */
  codePartage?: string | null;
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
  hrefStudio?: string;
}) {
  const monCode = useCodeRevendeur();
  const [preparation, setPreparation] = useState(false);
  const [afficheOuverte, setAfficheOuverte] = useState(false);
  const lien = `/p/${produit.slug}${refCode ? `?ref=${encodeURIComponent(refCode)}` : ''}`;
  const enRupture = produit.enStock === false;
  const { toast } = useToast();
  const [ajoute, setAjoute] = useState(false);
  const ajouter = () => {
    if (ajouterAuPanier(produit.id, produit.quantiteAjout ?? 1) === 'plein') {
      toast('Votre panier contient déjà 20 articles différents.', { ton: 'info' });
      return;
    }
    setAjoute(true);
    toast(`${produit.nom} ajouté au panier.`, { ton: 'succes' });
    setTimeout(() => setAjoute(false), 1800);
  };

  const partager = async () => {
    setPreparation(true);
    try {
      await partagerProduit(
        { nom: produit.nom, prix: produit.prix, slug: produit.slug, images: produit.images },
        monCode || codePartage || refCode,
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

  // Catalogue revendeur (pleine largeur) : le partage EST l'action principale,
  // avec le bouton WhatsApp commun (REV-03, lot 3 de l'audit UI/UX du 2026-10-02).
  // Vue client (V1, 2026-09-27) : partager reste possible mais ne doit plus
  // concurrencer l'achat — bouton neutre à côté de « Acheter », 40 px.
  const boutonPartage = (pleineLargeur: boolean) => pleineLargeur ? (
    <BoutonPartageWhatsApp
      size="sm"
      onClick={partager}
      onPointerDown={precharger}
      onMouseEnter={precharger}
      loading={preparation}
      aria-label={`Partager ${produit.nom} sur WhatsApp`}
      className="flex-1 min-w-0"
      libelle={<><span className="sm:hidden">Partager</span><span className="hidden sm:inline">Partager sur WhatsApp</span></>}
    />
  ) : (
    <button
      type="button"
      onClick={partager}
      onPointerDown={precharger}
      onMouseEnter={precharger}
      disabled={preparation}
      aria-label={`Partager ${produit.nom} sur WhatsApp`}
      className="h-10 w-10 shrink-0 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center transition-all active:scale-[0.97] disabled:opacity-70"
    >
      {preparation ? <SugubaLoader className="w-4 h-4" /> : <WhatsAppIcon className="w-4 h-4" />}
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
            {produit.prixLibre ? 'Prix libre · ' : ''}+{formatF(produit.commission!)}
          </span>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <Link href={lien} className="block">
          <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 min-h-[2.5rem] hover:text-suguba-brand-dark transition-colors">
            {produit.nom}
          </h3>
        </Link>
        {presentation ? (
          <p className="text-xs text-slate-500">{produit.categorie}</p>
        ) : (
        <>
        <p className="text-base sm:text-lg font-bold text-slate-900 leading-none">
          {produit.mentionPrix === 'des' && <span className="text-xs font-bold text-slate-500">dès </span>}
          {formatNombre(produit.prix)} <span className="text-xs font-bold">F</span>
          {produit.suffixeUnite && <span className="text-xs font-semibold text-slate-600"> {produit.suffixeUnite}</span>}
        </p>
        {produit.minimum && <p className="text-xs font-semibold text-slate-600">{produit.minimum}</p>}
        <p className="text-xs text-slate-500">
          {afficherCommission && (produit.commission ?? 0) > 0
            ? <>Vous gagnez <strong className="text-suguba-brand-dark">{formatF(produit.commission!)}</strong></>
            : produit.mentionPrix === 'des' ? 'Prix de nos revendeurs'
              : produit.mentionPrix === 'partenaire' ? 'Prix de votre partenaire'
                : 'Payez à la livraison'}
        </p>
        </>
        )}

        <div className="mt-auto pt-1.5 space-y-2">
          {presentation ? (
            <Button href={lien} variant="secondary" size="sm" fullWidth>Voir le produit</Button>
          ) : partageEnAvant ? (
            // Catalogue revendeur : partage direct + affiche pour le statut.
            <div className="flex items-center gap-2">
              {boutonPartage(true)}
              {hrefStudio ? <Link href={hrefStudio} aria-label={`Créer un visuel de ${produit.nom}`} title="Personnaliser le visuel" className="h-10 w-10 shrink-0 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700 inline-flex items-center justify-center"><ImageIcon className="w-4 h-4"/></Link> : <button
                type="button"
                onClick={() => setAfficheOuverte(true)}
                aria-label={`Créer une affiche de ${produit.nom} pour mon statut WhatsApp`}
                title="Affiche pour mon statut"
                className="h-10 w-10 shrink-0 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700 inline-flex items-center justify-center"
              >
                <ImageIcon className="w-4 h-4" />
              </button>}
            </div>
          ) : (
            // Rangée mesurée (relecture finale, 2026-10-04) : c'est ELLE qui porte
            // « carte-produit » (container-type), plus l'<article>. Sur la carte
            // entière, les navigateurs d'avant fin 2024 (Chrome ≤ 128, Safari iOS
            // 16-17) en faisaient le bloc conteneur de ses descendants fixés : la
            // fenêtre « Affiche pour mon statut » (AfficheModal, « fixed inset-0 »,
            // rendue dans la carte) s'ouvrait enfermée dans la carte. Cette rangée ne
            // contient que le bouton principal et le rond de partage : ne jamais y
            // rendre un élément en position fixe (fenêtre, feuille, bulle).
            <div className="carte-produit flex items-center gap-2">
              {produit.ajoutDirect ? (
                // V2 (2026-09-27) : offre simple → ajout au panier sans quitter
                // le catalogue ; le compteur de la barre du bas le confirme.
                // Carte étroite (2 colonnes sur téléphone, 2026-10-03) : le bouton + le
                // partage dépassaient de 22 px et le rond WhatsApp était rogné. Sous
                // 152 px de rangée, l'icône du bouton s'efface et il se resserre
                // (règle « carte-produit » de globals.css, requête de conteneur).
                <Button type="button" onClick={ajouter} variant="primary" size="sm" className="bouton-ajout flex-1 min-w-0"
                  aria-label={`Ajouter ${produit.nom} au panier`}>
                  {ajoute ? <><Check className="icone-ajout w-4 h-4" />Ajouté</> : <><ShoppingBag className="icone-ajout w-4 h-4" />Ajouter</>}
                </Button>
              ) : (
                <Button href={lien} variant={enRupture ? 'secondary' : 'primary'} size="sm" className="bouton-ajout flex-1 min-w-0">
                  {enRupture ? 'Voir' : produit.aChoisir ? 'Choisir' : 'Acheter'}
                </Button>
              )}
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
