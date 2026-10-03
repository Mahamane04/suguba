'use client';

import React, { useMemo, useState } from 'react';
import ProductCard from '@/components/product/ProductCard';
import type { ProduitVitrine } from '@/lib/shop';
import { normaliserRecherche } from '@/lib/recherche-texte';
import { Search, ChevronDown, X, Heart } from 'lucide-react';

/**
 * Liste des produits d'une boutique, groupés par catégorie (2026-09-12).
 *
 * Inspiré d'une app de livraison multi-vendeurs à Bamako (vidéo partagée par
 * l'utilisateur) : chaque boutique y regroupe son menu par catégorie
 * (« Légumes (1) », « Fast Food (6) »...) avec une recherche propre à la
 * boutique, plutôt qu'une simple grille plate — plus lisible dès qu'une
 * boutique a plus d'une poignée d'articles.
 *
 * Composant CLIENT séparé de ShopView (qui reste un composant serveur pour
 * les métadonnées de partage) : seule la recherche/le repli ont besoin
 * d'interactivité.
 *
 * Lot 3 du chantier boutique (2026-10-03), une vitrine qui aide à acheter :
 *  - « Coups de cœur » du revendeur en tête (jamais l'intitulé de l'emplacement
 *    sponsorisé payé), sans les répéter dessous, images chargées en priorité ;
 *  - recherche sans accents : « theiere » trouve « Théière » (les clients
 *    tapent souvent sans accents sur téléphone) ;
 *  - articles épuisés en fin de rayon, l'ordre choisi gardé pour le reste ;
 *  - pastilles de rayons qui mènent au rayon, dès 2 rayons ;
 *  - « Nouveau » les 14 jours qui suivent l'ajout, seulement sans autre étiquette
 *    (« Sur devis », « Service »…).
 */

const RAYON_SANS_CATEGORIE = 'Autres articles';
const ID_COUPS_DE_COEUR = 'coups-de-coeur';

/** Épuisés en fin de liste ; l'ordre choisi par le revendeur est gardé pour le reste (tri stable). */
function enStockDAbord(liste: ProduitVitrine[]): ProduitVitrine[] {
  return [...liste.filter((p) => p.enStock !== false), ...liste.filter((p) => p.enStock === false)];
}

/**
 * Ce que montre la vitrine pour une recherche : les coups de cœur trouvés,
 * puis les autres articles trouvés, groupés par catégorie dans l'ordre de leur
 * premier article. Règle PURE (exportée pour les tests).
 */
export function organiserVitrine(produits: ProduitVitrine[], recherche: string): { coups: ProduitVitrine[]; groupes: [string, ProduitVitrine[]][] } {
  const requete = normaliserRecherche(recherche);
  const trouves = requete
    ? produits.filter((p) => normaliserRecherche(p.nom).includes(requete) || normaliserRecherche(p.categorie).includes(requete))
    : produits;
  const parCategorie = new Map<string, ProduitVitrine[]>();
  for (const p of trouves) {
    if (p.coupDeCoeur) continue;
    const cle = p.categorie || RAYON_SANS_CATEGORIE;
    if (!parCategorie.has(cle)) parCategorie.set(cle, []);
    parCategorie.get(cle)!.push(p);
  }
  return {
    coups: enStockDAbord(trouves.filter((p) => p.coupDeCoeur)),
    groupes: Array.from(parCategorie.entries()).map(([categorie, items]): [string, ProduitVitrine[]] => [categorie, enStockDAbord(items)]),
  };
}

export default function BoutiqueProduits({
  produits,
  refCode,
  codePartage = null,
  presentation = false,
}: {
  produits: ProduitVitrine[];
  /** Code porté par les liens d'achat (?ref=) : null pour le propriétaire sur sa vitrine. */
  refCode: string | null;
  /** Code porté par le partage d'un article quand les liens d'achat n'en portent pas (2026-10-03). */
  codePartage?: string | null;
  /** Boutique fournisseur en présentation (lot C) : ni prix ni achat. */
  presentation?: boolean;
}) {
  const [recherche, setRecherche] = useState('');
  // Catégories repliées manuellement — vides par défaut : tout est déplié
  // au premier chargement, une boutique d'une poignée d'articles n'a pas
  // besoin qu'on lui demande de tout déplier soi-même.
  const [replieesManuel, setReplieesManuel] = useState<Set<string>>(new Set());

  const { coups, groupes } = useMemo(() => organiserVitrine(produits, recherche), [produits, recherche]);

  const basculer = (categorie: string) => {
    setReplieesManuel((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(categorie)) suivant.delete(categorie);
      else suivant.add(categorie);
      return suivant;
    });
  };

  const carte = (p: ProduitVitrine, priority: boolean) => (
    <ProductCard
      key={p.id}
      produit={{
        id: p.id, slug: p.slug, nom: p.nom, prix: p.prix, categorie: p.categorie, images: p.images, enStock: p.enStock,
        suffixeUnite: p.suffixeUnite, minimum: p.minimum,
        // « Nouveau » seulement quand l'article n'a pas déjà son étiquette d'offre.
        etiquetteOffre: p.etiquetteOffre || (p.nouveau ? 'Nouveau' : null),
        quantiteAjout: p.quantiteAjout, ajoutDirect: p.ajoutDirect, aChoisir: p.aChoisir,
      }}
      refCode={refCode}
      codePartage={codePartage}
      priority={priority}
      presentation={presentation}
    />
  );

  // Pastilles des rayons : des ancres, dès 2 rayons (au-delà de la recherche).
  const ancres = groupes.length >= 2 ? [
    ...(coups.length ? [{ id: ID_COUPS_DE_COEUR, libelle: 'Coups de cœur', nombre: coups.length }] : []),
    ...groupes.map(([categorie, items], i) => ({ id: `rayon-${i + 1}`, libelle: categorie, nombre: items.length })),
  ] : [];

  return (
    <div className="space-y-4">
      {/* Recherche propre à CETTE boutique — pas le catalogue Suguba entier. */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un article dans cette boutique..."
          aria-label="Rechercher un article dans cette boutique"
          className="w-full pl-10 pr-11 py-2.5 bg-white border border-slate-200 rounded-2xl text-base sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-suguba-brand/30"
        />
        {recherche && (
          <button
            type="button"
            onClick={() => setRecherche('')}
            aria-label="Effacer la recherche"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {ancres.length > 0 && (
        <nav aria-label="Rayons de la boutique" className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {ancres.map((a) => (
            <a
              key={a.id}
              href={`#${a.id}`}
              className="shrink-0 inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700 whitespace-nowrap hover:bg-suguba-sauge"
            >
              {a.id === ID_COUPS_DE_COEUR && <Heart className="w-3.5 h-3.5 text-suguba-brand-dark" fill="currentColor" aria-hidden="true" />}
              {a.libelle} <span className="text-slate-500 tabular-nums">({a.nombre})</span>
            </a>
          ))}
        </nav>
      )}

      {coups.length === 0 && groupes.length === 0 ? (
        <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-2xl p-4 text-center">
          Aucun article ne correspond à « {recherche} ».
        </p>
      ) : (
        <>
          {coups.length > 0 && (
            <section id={ID_COUPS_DE_COEUR} aria-labelledby="coups-de-coeur-titre" className="bg-white rounded-3xl border border-slate-200 px-4 sm:px-5 pt-3.5 pb-5 space-y-3 scroll-mt-32">
              <h2 id="coups-de-coeur-titre" className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <Heart className="w-4 h-4 text-suguba-brand-dark" fill="currentColor" aria-hidden="true" />
                <span>Coups de cœur <span className="text-slate-500 font-bold">({coups.length})</span></span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                {/* Images des coups de cœur chargées en premier. */}
                {coups.map((p, i) => carte(p, i < 4))}
              </div>
            </section>
          )}

          {groupes.map(([categorie, items], rang) => {
            const repliee = replieesManuel.has(categorie);
            return (
              <div key={categorie} id={`rayon-${rang + 1}`} className="bg-white rounded-3xl border border-slate-200 overflow-hidden scroll-mt-32">
                <button
                  type="button"
                  onClick={() => basculer(categorie)}
                  aria-expanded={!repliee}
                  className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 text-left"
                >
                  <span className="font-bold text-sm text-slate-900">
                    {categorie} <span className="text-slate-500 font-bold">({items.length})</span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${repliee ? '' : 'rotate-180'}`} />
                </button>
                {!repliee && (
                  <div className="px-4 sm:px-5 pb-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                    {/* Sans coups de cœur, les premières images du premier rayon passent en priorité. */}
                    {items.map((p, i) => carte(p, coups.length === 0 && rang === 0 && i < 4))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
