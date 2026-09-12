'use client';

import React, { useMemo, useState } from 'react';
import ProductCard from '@/components/product/ProductCard';
import type { ProduitVitrine } from '@/lib/shop';
import { Search, ChevronDown, X } from 'lucide-react';

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
 */
export default function BoutiqueProduits({
  produits,
  refCode,
}: {
  produits: ProduitVitrine[];
  refCode: string | null;
}) {
  const [recherche, setRecherche] = useState('');
  // Catégories repliées manuellement — vides par défaut : tout est déplié
  // au premier chargement, une boutique d'une poignée d'articles n'a pas
  // besoin qu'on lui demande de tout déplier soi-même.
  const [replieesManuel, setReplieesManuel] = useState<Set<string>>(new Set());

  const requete = recherche.trim().toLowerCase();
  const produitsFiltres = requete
    ? produits.filter((p) => p.nom.toLowerCase().includes(requete) || p.categorie.toLowerCase().includes(requete))
    : produits;

  const groupes = useMemo(() => {
    const parCategorie = new Map<string, ProduitVitrine[]>();
    for (const p of produitsFiltres) {
      const cle = p.categorie || 'Autres articles';
      if (!parCategorie.has(cle)) parCategorie.set(cle, []);
      parCategorie.get(cle)!.push(p);
    }
    return Array.from(parCategorie.entries());
  }, [produitsFiltres]);

  const basculer = (categorie: string) => {
    setReplieesManuel((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(categorie)) suivant.delete(categorie);
      else suivant.add(categorie);
      return suivant;
    });
  };

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
          className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-suguba-brand/30"
        />
        {recherche && (
          <button
            type="button"
            onClick={() => setRecherche('')}
            aria-label="Effacer la recherche"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {groupes.length === 0 ? (
        <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-2xl p-4 text-center">
          Aucun article ne correspond à « {recherche} ».
        </p>
      ) : (
        groupes.map(([categorie, items]) => {
          const repliee = replieesManuel.has(categorie);
          return (
            <div key={categorie} className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => basculer(categorie)}
                className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 text-left"
              >
                <span className="font-black text-sm text-slate-900">
                  {categorie} <span className="text-slate-400 font-bold">({items.length})</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${repliee ? '' : 'rotate-180'}`} />
              </button>
              {!repliee && (
                <div className="px-4 sm:px-5 pb-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                  {items.map((p, i) => (
                    <ProductCard
                      key={p.id}
                      produit={{ id: p.id, slug: p.slug, nom: p.nom, prix: p.prix, categorie: p.categorie, images: p.images, enStock: p.enStock }}
                      refCode={refCode}
                      priority={i < 4}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
