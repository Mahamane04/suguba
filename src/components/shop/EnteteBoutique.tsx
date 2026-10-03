import React from 'react';
import { initiale } from '@/lib/initiale';
import DescriptionBoutique from '@/components/shop/DescriptionBoutique';

/**
 * En-tête d'une vitrine : couverture, logo qui la chevauche, identité.
 *
 * Extrait de ShopView au lot 2 du chantier boutique (2026-10-03), PUREMENT
 * visuel (ni état, ni requête, ni 'use client') : le même rendu sert au visiteur
 * (composant serveur) et au propriétaire, dont EnteteEditable l'enveloppe pour y
 * poser ses trois crayons. Les emplacements `surCouverture`, `surLogo` et `surNom`
 * restent vides pour un visiteur.
 *
 * Sans couverture, un fond aux couleurs de Suguba la remplace : la page ne paraît
 * jamais vide (en-tête refait le 2026-09-24).
 *
 * Seule exception à « purement visuel » : la présentation, dont le « Lire la
 * suite » sur téléphone vit dans le petit composant client DescriptionBoutique
 * (relecture du lot 3, 2026-10-03). L'en-tête lui-même reste sans état.
 */
export default function EnteteBoutique({
  couverture,
  logo,
  nom,
  titre,
  surtitre,
  apresTitre,
  accroche,
  infos,
  description,
  surCouverture,
  surLogo,
  surNom,
  children,
  pied,
}: {
  couverture?: string | null;
  logo: string | null;
  /** Nom de la boutique (texte alternatif du logo, initiale par défaut). */
  nom: string;
  /** Titre affiché : l'enseigne, ou « La sélection de Awa D. » (voir titreVitrine). */
  titre: string;
  /** « Revendeur partenaire Suguba », « Fournisseur partenaire Suguba »… */
  surtitre: string;
  /** Sous le titre (pastille d'état du propriétaire). */
  apresTitre?: React.ReactNode;
  /** Mot d'accueil choisi par le propriétaire. */
  accroche?: string | null;
  /** Badges et ligne « N articles · quartier ». */
  infos?: React.ReactNode;
  description?: string | null;
  /** Posé sur la couverture, en haut à droite (bouton « Personnaliser », crayon). */
  surCouverture?: React.ReactNode;
  /** Posé sur le coin du logo (crayon). */
  surLogo?: React.ReactNode;
  /** À droite du titre (crayon du nom et du mot d'accueil). */
  surNom?: React.ReactNode;
  /** Actions sous l'identité (Suivre, partage…). */
  children?: React.ReactNode;
  /** Bande du bas (garanties). */
  pied?: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Couverture */}
      <div className="relative h-28 sm:h-56">
        {couverture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={couverture} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-suguba-profond"
            style={{
              backgroundImage:
                'radial-gradient(circle at 88% 12%, rgba(199,244,100,0.30), transparent 42%), radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)',
              backgroundSize: 'auto, 14px 14px',
            }}
          />
        )}
        {surCouverture}
      </div>

      <div className="px-4 sm:px-8 pb-5">
        {/* Logo qui chevauche la couverture */}
        <div className="-mt-10 sm:-mt-14 relative w-fit">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={nom}
              className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl object-cover bg-white ring-4 ring-white shadow-md"
            />
          ) : (
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl bg-suguba-menthe text-suguba-profond ring-4 ring-white shadow-md flex items-center justify-center font-bold text-3xl sm:text-4xl">
              {initiale(nom)}
            </div>
          )}
          {surLogo}
        </div>

        {/* Identité */}
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-suguba-brand-dark">{surtitre}</p>
          <div className="flex items-start gap-2">
            <h1 className="flex-1 min-w-0 text-2xl sm:text-3xl font-bold text-slate-900 leading-tight break-words">{titre}</h1>
            {surNom}
          </div>
          {apresTitre}
          {accroche && <p className="text-sm text-slate-600">{accroche}</p>}
          {infos}
          {/* « Lire la suite » sur téléphone (relecture du lot 3, 2026-10-03). */}
          {description && <DescriptionBoutique texte={description} />}
        </div>

        {children}
      </div>

      {pied}
    </section>
  );
}
