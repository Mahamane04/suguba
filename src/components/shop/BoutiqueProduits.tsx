'use client';

import React, { useEffect, useMemo, useState } from 'react';
import ProductCard from '@/components/product/ProductCard';
import type { ProduitVitrine } from '@/lib/shop';
import { normaliserRecherche } from '@/lib/recherche-texte';
import { RAYON_COUPS_DE_COEUR, RAYON_SANS_CATEGORIE, cleRayon, rayonMaisonDe, type RayonChoisi } from '@/lib/partage-boutique';
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
 *
 * Lot 4 (2026-10-03) : ?rayon=<cle> (lien « Partager ce rayon » ou « Mes coups de
 * cœur ») ouvre ce rayon et y fait défiler la page. La clé d'un rayon est tirée
 * de son nom (cleRayon, src/lib/partage-boutique.ts) ; une clé inconnue ne fait rien.
 *
 * Lot 6 (2026-10-03) : les rayons MAISON du revendeur (« Pagnes », « Pour la
 * fête »…) passent en premier, dans l'ordre qu'il a choisi, puis les rayons
 * automatiques (catégories). Sans rayon maison — base pas encore migrée, ou aucun
 * rayon créé — le rendu est exactement celui d'avant.
 */

const ID_COUPS_DE_COEUR = RAYON_COUPS_DE_COEUR;
/** Même tableau à chaque rendu : la vitrine sans rayon maison ne recalcule rien. */
const SANS_RAYON_MAISON: readonly RayonChoisi[] = [];

/** Ancre du rayon visé par ?rayon=<cle> ; null si la vitrine n'a pas ce rayon. */
export function ancreDuRayon(cle: string | null | undefined, coups: ProduitVitrine[], groupes: [string, ProduitVitrine[]][]): string | null {
  if (!cle) return null;
  if (cle === RAYON_COUPS_DE_COEUR) return coups.length > 0 ? ID_COUPS_DE_COEUR : null;
  const rang = groupes.findIndex(([categorie]) => cleRayon(categorie) === cle);
  return rang >= 0 ? `rayon-${rang + 1}` : null;
}

/** Épuisés en fin de liste ; l'ordre choisi par le revendeur est gardé pour le reste (tri stable). */
function enStockDAbord(liste: ProduitVitrine[]): ProduitVitrine[] {
  return [...liste.filter((p) => p.enStock !== false), ...liste.filter((p) => p.enStock === false)];
}

/**
 * Ce que montre la vitrine pour une recherche : les coups de cœur trouvés,
 * puis les autres articles trouvés, groupés par rayon. Règle PURE (exportée pour
 * les tests).
 *
 * Rayons maison (lot 6) d'abord, dans l'ordre choisi par le revendeur ; puis les
 * catégories, dans l'ordre de leur premier article. Un rayon maison sans article
 * trouvé n'apparaît pas. Le nom d'un rayon maison est cherché comme une catégorie.
 */
export function organiserVitrine(
  produits: ProduitVitrine[],
  recherche: string,
  rayonsMaison: readonly RayonChoisi[] = [],
): { coups: ProduitVitrine[]; groupes: [string, ProduitVitrine[]][] } {
  const requete = normaliserRecherche(recherche);
  const maisonDe = rayonMaisonDe(rayonsMaison);
  const trouves = requete
    ? produits.filter((p) => normaliserRecherche(p.nom).includes(requete) || normaliserRecherche(p.categorie).includes(requete)
      || normaliserRecherche(maisonDe(p) || '').includes(requete))
    : produits;
  const parCategorie = new Map<string, ProduitVitrine[]>();
  // Les rayons maison prennent leur place avant tout article : l'ordre choisi.
  for (const r of rayonsMaison) if (!parCategorie.has(r.nom)) parCategorie.set(r.nom, []);
  for (const p of trouves) {
    if (p.coupDeCoeur) continue;
    const cle = maisonDe(p) || p.categorie || RAYON_SANS_CATEGORIE;
    if (!parCategorie.has(cle)) parCategorie.set(cle, []);
    parCategorie.get(cle)!.push(p);
  }
  return {
    coups: enStockDAbord(trouves.filter((p) => p.coupDeCoeur)),
    groupes: Array.from(parCategorie.entries())
      .filter(([, items]) => items.length > 0)
      .map(([categorie, items]): [string, ProduitVitrine[]] => [categorie, enStockDAbord(items)]),
  };
}

export default function BoutiqueProduits({
  produits,
  refCode,
  codePartage = null,
  presentation = false,
  rayon = null,
  rayonsMaison = SANS_RAYON_MAISON,
}: {
  produits: ProduitVitrine[];
  /** Code porté par les liens d'achat (?ref=) : null pour le propriétaire sur sa vitrine. */
  refCode: string | null;
  /** Code porté par le partage d'un article quand les liens d'achat n'en portent pas (2026-10-03). */
  codePartage?: string | null;
  /** Boutique fournisseur en présentation (lot C) : ni prix ni achat. */
  presentation?: boolean;
  /** ?rayon=<cle> reçu par la vitrine (lot 4) : rayon à ouvrir à l'arrivée. */
  rayon?: string | null;
  /** Rayons maison du revendeur, dans l'ordre choisi (lot 6). Absents : rayons automatiques seuls. */
  rayonsMaison?: readonly RayonChoisi[];
}) {
  const [recherche, setRecherche] = useState('');
  // Catégories repliées manuellement — vides par défaut : tout est déplié
  // au premier chargement, une boutique d'une poignée d'articles n'a pas
  // besoin qu'on lui demande de tout déplier soi-même.
  const [replieesManuel, setReplieesManuel] = useState<Set<string>>(new Set());

  const { coups, groupes } = useMemo(() => organiserVitrine(produits, recherche, rayonsMaison), [produits, recherche, rayonsMaison]);

  // ?rayon=<cle> : une seule fois à l'arrivée, sur la vitrine complète (sans recherche).
  useEffect(() => {
    if (!rayon) return;
    const complete = organiserVitrine(produits, '', rayonsMaison);
    const ancre = ancreDuRayon(rayon, complete.coups, complete.groupes);
    if (!ancre) return;
    const visee = complete.groupes.find(([categorie]) => cleRayon(categorie) === rayon)?.[0];
    if (visee) setReplieesManuel((prev) => { const suivant = new Set(prev); suivant.delete(visee); return suivant; });
    const image = window.requestAnimationFrame(() => {
      const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      document.getElementById(ancre)?.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(image);
    // Une seule fois à l'arrivée : la recherche ou un repli ne doivent pas y ramener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rayon]);

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
