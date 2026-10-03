'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import PageReseau from '@/components/reseau/PageReseau';
import CreateOrderModal from '@/components/reseller/CreateOrderModal';
import ProductCard, { carteDepuisProduit } from '@/components/product/ProductCard';
import ChoicePicker from '@/components/ui/ChoicePicker';
import { useSponsorises, compterVues } from '@/lib/sponsorises';
import { classerAvecSponsorises } from '@/lib/reseau/sponsoring';
import Button from '@/components/ui/Button';
import { useSugubaStore, useCatalogueCharge } from '@/lib/store';
import { Product } from '@/types';
import { Search, Plus, Sparkles, Check, Store, Eye } from 'lucide-react';
import { PORTE_MA_BOUTIQUE } from '@/lib/reseau/porte-boutique';

/**
 * Catalogue revendeur — refondu le 2026-09-11 sur la carte produit commune :
 * plusieurs photos, partage WhatsApp en un clic (photo + texte + lien), deux
 * colonnes sur téléphone. Le partage y est l'action principale : c'est le
 * métier du revendeur.
 */
export default function ResellerCatalogPage() {
  const state = useSugubaStore();
  const catalogueCharge = useCatalogueCharge();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [tri, setTri] = useState<'recommandes' | 'commission' | 'nouveautes' | 'populaires' | 'sponsorises'>('recommandes');
  const [fournisseur, setFournisseur] = useState('all');
  const sponsorises = useSponsorises('reseller_dashboard');
  const [popularite, setPopularite] = useState<Record<string, number>>({});
  useEffect(() => {
    if (tri !== 'populaires' || Object.keys(popularite).length) return;
    fetch('/api/products/popularite').then((r) => r.json()).then((d) => setPopularite(d.livraisons || {})).catch(() => undefined);
  }, [tri, popularite]);
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<Product | null>(null);

  // Code revendeur (bouton « Boutique » de chaque article) et sélection de la boutique.
  // Relecture du lot 1 (2026-10-03) : le bandeau « Ma boutique » ne dépend plus du
  // code (il ne servait qu'à l'ancienne adresse /r/<code>) ; il est toujours affiché,
  // donc ne pousse plus le catalogue, et son nombre d'articles attend la sélection.
  const [codeRevendeur, setCodeRevendeur] = useState<string | null | undefined>(undefined);
  const [maSelection, setMaSelection] = useState<Set<string>>(new Set());
  const [selectionLue, setSelectionLue] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreurBoutique, setErreurBoutique] = useState('');

  useEffect(() => {
    fetch('/api/reseller/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setCodeRevendeur(j?.reseller?.referralCode || null))
      .catch(() => setCodeRevendeur(null));
    fetch('/api/reseller/shop')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.articles && setMaSelection(new Set(j.articles)))
      .catch(() => {})
      .finally(() => setSelectionLue(true));
  }, []);

  const basculerBoutique = async (productId: string) => {
    setErreurBoutique('');
    setEnCours(productId);
    const dedans = maSelection.has(productId);
    try {
      const res = await fetch('/api/reseller/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, action: dedans ? 'retirer' : 'ajouter' }),
      });
      const json = await res.json();
      if (!res.ok) { setErreurBoutique(json.error || 'Action impossible.'); return; }
      setMaSelection((prev) => {
        const suivant = new Set(prev);
        if (dedans) suivant.delete(productId); else suivant.add(productId);
        return suivant;
      });
    } catch {
      setErreurBoutique('Erreur réseau.');
    } finally {
      setEnCours(null);
    }
  };

  // Seuls les produits qui rapportent une commission sont proposés au partage.
  // Un article sous le plancher ou à commission trop faible afficherait
  // « +0 F » : aucun sens pour un revendeur (voir src/lib/pricing.ts).
  const approvedProducts = state.products.filter(p => p.status === 'approved' && p.resellerCommission > 0);
  const categories = ['all', ...Array.from(new Set(approvedProducts.map(p => p.category)))];

  const fournisseurs = Array.from(new Set(approvedProducts.map((p) => p.supplierName).filter(Boolean))).sort();

  const recherche = searchTerm.trim().toLowerCase();
  const trouves = approvedProducts.filter(p => {
    const matchesSearch = !recherche || p.name.toLowerCase().includes(recherche) ||
                          p.description.toLowerCase().includes(recherche);
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const bonFournisseur = fournisseur === 'all' || p.supplierName === fournisseur;
    const bonSponso = tri !== 'sponsorises' || sponsorises.has(p.id);
    return matchesSearch && matchesCategory && bonFournisseur && bonSponso;
  });

  // Tri (§ page 9 : marge, popularité, nouveautés, sponsorisés). Par défaut
  // « Recommandés » : l'ordre du catalogue, avec au plus 3 produits
  // sponsorisés en tête, marqués comme tels.
  const tries = [...trouves].sort((a, b) => {
    if (tri === 'commission') return b.resellerCommission - a.resellerCommission;
    if (tri === 'nouveautes') return String(b.createdAt).localeCompare(String(a.createdAt));
    if (tri === 'populaires') return (popularite[b.id] || 0) - (popularite[a.id] || 0);
    return 0;
  });
  const classes = tri === 'recommandes' || tri === 'sponsorises'
    ? classerAvecSponsorises(tries, [...sponsorises.keys()], tri === 'sponsorises' ? 30 : 3)
    : tries.map((element) => ({ element, sponsorise: sponsorises.has(element.id) }));
  const filtered = classes.map((c) => c.element);
  const idsAffiches = classes.filter((c) => c.sponsorise).map((c) => sponsorises.get(c.element.id)!).join(',');
  useEffect(() => { if (idsAffiches) compterVues(idsAffiches.split(',')); }, [idsAffiches]);

  return (
    // REV-14 (lot 6 de l'audit UI/UX du 2026-10-02) : coquille commune des espaces.
    <PageReseau titre="Catalogue à partager" large
      sousTitre="Partagez sur WhatsApp : chaque vente livrée vous rapporte la commission affichée."
      retour={{ href: '/reseller', libelle: 'Espace revendeur' }}
      action={<Button href="/reseller/createur" variant="ghost" size="sm"><Sparkles className="w-4 h-4" /><span>Créer un visuel</span></Button>}>
        {/* Ma boutique : la vitrine publique composée depuis ce catalogue. */}
        {/* REV-11 (lot 7 de l'audit UI/UX du 2026-10-02) : sur une ligne, pour que le
            premier produit remonte (il apparaissait vers 605 px sur téléphone). */}
        <div className="bg-white border border-slate-200 rounded-2xl px-3 py-2 flex items-center justify-between gap-3" aria-busy={!selectionLue}>
          <div className="flex items-center gap-2.5 min-w-0">
            <Store className="w-5 h-5 text-suguba-profond shrink-0" />
            <div className="min-w-0">
              {/* Sur téléphone, le libellé passe à la ligne plutôt que de couper le nombre
                  d'articles : « Voir ma boutique » est maintenant écrit en entier (2026-10-03). */}
              {selectionLue ? (
                <p className="text-sm font-semibold text-slate-900 leading-tight sm:truncate">Ma boutique · {maSelection.size} article{maSelection.size > 1 ? 's' : ''}</p>
              ) : (
                <p className="text-sm font-semibold text-slate-900 leading-tight">Ma boutique</p>
              )}
              <p className="hidden sm:block text-xs text-slate-600">
                Ajoutez des articles ci-dessous, puis partagez votre boutique : chaque vente vous est attribuée.
              </p>
            </div>
          </div>
          {/* La vraie vitrine /boutique/<adresse>, dans le même onglet (2026-10-03) :
              l'ancienne /r/<code>, appauvrie, s'ouvrait dans un nouvel onglet et
              faisait sortir de l'application installée. La porte n'a pas besoin du code. */}
          <Button href={PORTE_MA_BOUTIQUE} variant="secondary" size="sm" className="shrink-0">
            <Eye className="w-4 h-4" />
            <span>Voir ma boutique</span>
          </Button>
        </div>
        {erreurBoutique && (
          <p role="alert" className="text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-2xl p-3">{erreurBoutique}</p>
        )}

        {/* Recherche et catégories */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Rechercher un produit…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-suguba-brand/30 focus:border-suguba-brand"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ChoicePicker
              id="tri-catalogue"
              ariaLabel="Trier les produits"
              valeur={tri}
              onChange={(v) => setTri(v as typeof tri)}
              choix={[
                { valeur: 'recommandes', libelle: 'Recommandés' },
                { valeur: 'commission', libelle: 'Meilleure commission' },
                { valeur: 'populaires', libelle: 'Les plus vendus' },
                { valeur: 'nouveautes', libelle: 'Nouveautés' },
                { valeur: 'sponsorises', libelle: 'Sponsorisés', detail: sponsorises.size ? String(sponsorises.size) : undefined },
              ]}
            />
            <ChoicePicker
              id="fournisseur-catalogue"
              ariaLabel="Filtrer par fournisseur"
              valeur={fournisseur}
              onChange={setFournisseur}
              choix={[{ valeur: 'all', libelle: 'Tous les fournisseurs' }, ...fournisseurs.map((f) => ({ valeur: f, libelle: f }))]}
            />
          </div>
          {categories.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  aria-pressed={selectedCategory === cat}
                  className={`min-h-10 px-3.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-suguba-profond text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cat === 'all' ? 'Tout' : cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {approvedProducts.length === 0 && !catalogueCharge ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4" aria-busy="true" aria-label="Chargement du catalogue">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-3xl border border-slate-200 overflow-hidden animate-pulse">
                <div className="aspect-square bg-slate-200" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-4/5 rounded bg-slate-200" />
                  <div className="h-4 w-1/2 rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            {approvedProducts.length === 0
              ? 'Le catalogue est en cours de remplissage. Les produits apparaîtront ici dès leur validation.'
              : 'Aucun produit ne correspond à votre recherche.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map((product, i) => (
              <ProductCard
                key={product.id}
                produit={carteDepuisProduit(product)}
                afficherCommission
                partageEnAvant
                hrefStudio={`/reseller/createur?produit=${encodeURIComponent(product.id)}`}
                priority={i < 4}
                sponsorisationId={classes[i]?.sponsorise ? sponsorises.get(product.id) : null}
              >
                <div className="grid grid-cols-2 gap-1.5">
                  {/* REV-07 (audit UI/UX du 2026-10-02) : 32 px, sous la cible tactile ; 40 px et nom explicite. */}
                  <button
                    type="button"
                    onClick={() => setSelectedProductForOrder(product)}
                    aria-label={`Enregistrer une vente de ${product.name} pour un client`}
                    className="h-10 rounded-full border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Vente</span>
                  </button>
                  {codeRevendeur ? (
                    <button
                      type="button"
                      onClick={() => basculerBoutique(product.id)}
                      disabled={enCours === product.id}
                      aria-pressed={maSelection.has(product.id)}
                      aria-label={maSelection.has(product.id) ? `Retirer ${product.name} de ma boutique` : `Ajouter ${product.name} à ma boutique`}
                      className={`h-10 rounded-full border text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors disabled:opacity-60 ${
                        maSelection.has(product.id)
                          ? 'bg-suguba-brand/10 border-suguba-brand/30 text-suguba-brand-dark'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {maSelection.has(product.id) ? <Check className="w-3.5 h-3.5" /> : <Store className="w-3.5 h-3.5" />}
                      <span>{maSelection.has(product.id) ? 'En boutique' : 'Boutique'}</span>
                    </button>
                  ) : (
                    <Link
                      href={`/p/${product.slug}`}
                      className="h-10 rounded-full border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center justify-center"
                    >
                      Voir
                    </Link>
                  )}
                </div>
              </ProductCard>
            ))}
          </div>
        )}

      {selectedProductForOrder && (
        <CreateOrderModal
          product={selectedProductForOrder}
          isOpen={!!selectedProductForOrder}
          onClose={() => setSelectedProductForOrder(null)}
        />
      )}
    </PageReseau>
  );
}
