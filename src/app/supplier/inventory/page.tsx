'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageReseau from '@/components/reseau/PageReseau';
import ProductImage from '@/components/common/ProductImage';
import Button from '@/components/ui/Button';
import { EmptyState, Skeleton, StatCard, StatusPill } from '@/components/ui/Surface';
import PhotosProduitModal from '@/components/product/PhotosProduitModal';
import FormulaireVariante from '@/components/product/FormulaireVariante';
import { Package, Minus, Plus, AlertTriangle, MoreHorizontal, Search } from 'lucide-react';
import { formatF } from '@/lib/montant';

interface ProduitStock {
  id: string;
  name: string;
  images: string[];
  supplierPrice: number;
  publicPrice?: number;
  stockQuantity: number;
  status: string;
}

const STATUT: Record<string, { libelle: string; ton: 'succes' | 'attente' | 'neutre' | 'danger' }> = {
  approved: { libelle: 'En vente', ton: 'succes' },
  draft: { libelle: 'Copie à vérifier', ton: 'neutre' },
  submitted: { libelle: 'En attente', ton: 'attente' },
  rejected: { libelle: 'Retiré', ton: 'danger' },
};

/**
 * Stocks du fournisseur — refaits le 2026-09-11 sur ses VRAIS produits
 * (/api/supplier/me), avec une mise à jour enregistrée en base
 * (/api/supplier/stock).
 *
 * FOU-06 (lot 6 de l'audit UI/UX du 2026-10-02) : chaque ligne portait sept
 * commandes (−, +, champ, « Confirmer le stock », Photos, Modifier, Dupliquer),
 * chaque appui sur − ou + partait au serveur, et aucun prix n'était affiché.
 * Désormais : le prix en clair, un compteur qui ne change que l'écran, un seul
 * « Enregistrer » quand la quantité a changé, et le reste rangé dans « Plus ».
 */
export default function SupplierInventoryPage() {
  const router = useRouter();
  const [photosPour, setPhotosPour] = useState<ProduitStock | null>(null);
  const [erreurChargement, setErreurChargement] = useState(false);
  const [produits, setProduits] = useState<ProduitStock[] | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState('tous');
  // Quantité en cours de saisie, par produit : rien ne part au serveur avant « Enregistrer ».
  const [brouillons, setBrouillons] = useState<Record<string, number>>({});

  const recharger = React.useCallback(async () => {
    setErreurChargement(false);
    try {
      const r = await fetch('/api/supplier/me'); const d = await r.json();
      if (!r.ok || !Array.isArray(d.products)) throw new Error();
      setProduits(d.products);
    } catch { setErreurChargement(true); }
  }, []);
  useEffect(() => { recharger(); }, [recharger]);

  const dupliquer = async (p: ProduitStock) => {
    if (enCours) return; setEnCours(p.id); setErreur('');
    try {
      const r = await fetch(`/api/supplier/products/${encodeURIComponent(p.id)}`, { method: 'POST' });
      const d = await r.json(); if (!r.ok || !d.id) throw new Error(d.error || 'Copie non enregistrée.');
      router.push(`/supplier/products/${encodeURIComponent(d.id)}`);
    } catch(e) { setErreur((e as Error).message); } finally { setEnCours(null); }
  };

  const ajuster = (p: ProduitStock, quantite: number) =>
    setBrouillons((b) => ({ ...b, [p.id]: Math.max(0, Math.floor(quantite) || 0) }));

  const enregistrerStock = async (p: ProduitStock) => {
    const quantite = brouillons[p.id];
    if (enCours || quantite === undefined) return;
    setErreur('');
    setEnCours(p.id);
    try {
      const res = await fetch('/api/supplier/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: p.id, stock: quantite }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'Mise à jour impossible.');
      // L'écran ne montre la nouvelle quantité qu'une fois enregistrée.
      setProduits((l) => (l || []).map((x) => (x.id === p.id ? { ...x, stockQuantity: quantite } : x)));
      setBrouillons((b) => { const n = { ...b }; delete n[p.id]; return n; });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Mise à jour impossible.');
    } finally {
      setEnCours(null);
    }
  };

  const liste = produits || [];
  const unites = liste.reduce((s, p) => s + p.stockQuantity, 0);
  const valeur = liste.reduce((s, p) => s + p.supplierPrice * p.stockQuantity, 0);
  const faibles = liste.filter((p) => p.stockQuantity <= 5).length;
  const requete = recherche.trim().toLocaleLowerCase('fr');
  const affiches = liste.filter((p) => p.name.toLocaleLowerCase('fr').includes(requete)
    && (filtre === 'tous' || (filtre === 'faible' ? p.stockQuantity <= 5 : p.status === filtre)));

  return (
    <PageReseau
      titre="Mes produits"
      sousTitre="Tenez vos quantités à jour pour ne jamais vendre un article absent."
      retour={{ href: '/supplier', libelle: 'Espace fournisseur' }}
      action={<Button href="/supplier/products/new"><Plus className="w-4 h-4" />Ajouter une offre</Button>}
    >
      {produits !== null && (
        // La valeur (« 19 840 000 F ») prend toute la largeur sur téléphone : en trois
        // colonnes de 390 px, elle débordait de sa tuile.
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-1"><StatCard label="Valeur du stock" valeur={formatF(valeur)} aide="à votre prix" /></div>
          <StatCard label="Unités" valeur={unites} />
          <StatCard label="Stock faible" valeur={faibles} alerte={faibles > 0} />
        </div>
      )}

      {liste.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Rechercher un produit</span>
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un produit"
              className="w-full min-h-11 pl-10 pr-3 rounded-2xl border border-slate-200 bg-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-suguba-profond/30" />
          </label>
          <label className="sm:w-56">
            <span className="sr-only">Afficher</span>
            <select value={filtre} onChange={(e) => setFiltre(e.target.value)}
              className="w-full min-h-11 px-3 rounded-2xl border border-slate-200 bg-white text-base sm:text-sm">
              <option value="tous">Tous les produits</option>
              <option value="faible">Stock faible ou rupture</option>
              <option value="approved">En vente</option>
              <option value="submitted">En attente</option>
            </select>
          </label>
        </div>
      )}

      {erreur && (
        <p role="alert" className="rounded-2xl bg-rose-50 border border-rose-100 p-3 text-sm text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />{erreur}
        </p>
      )}

      {erreurChargement ? (
        <EmptyState erreur titre="Vos produits n’ont pas pu être chargés" texte="Vérifiez la connexion puis réessayez." onReessayer={recharger} />
      ) : produits === null ? (
        <Skeleton className="h-48" />
      ) : liste.length === 0 ? (
        <EmptyState icone={Package} titre="Vous n’avez pas encore de produit"
          texte="Ajoutez une offre : avec une photo, elle est en vente tout de suite."
          action={<Button href="/supplier/products/new">Ajouter une offre</Button>} />
      ) : affiches.length === 0 ? (
        <EmptyState icone={Search} titre="Aucun produit ne correspond"
          action={<Button variant="ghost" onClick={() => { setRecherche(''); setFiltre('tous'); }}>Tout afficher</Button>} />
      ) : (
        <ul className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100">
          {affiches.map((p) => {
            const statut = STATUT[p.status] || { libelle: p.status, ton: 'neutre' as const };
            const brouillon = brouillons[p.id];
            const quantite = brouillon ?? p.stockQuantity;
            const modifie = brouillon !== undefined && brouillon !== p.stockQuantity;
            return (
              <li key={p.id} className="p-3 sm:p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                    <ProductImage src={p.images[0] || ''} alt={p.name} fill sizes="56px" className="object-cover" compact />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-slate-900 line-clamp-2">{p.name}</p>
                    <p className="text-sm text-slate-700">
                      Vous touchez <strong className="whitespace-nowrap">{formatF(p.supplierPrice)}</strong>
                      {Number(p.publicPrice) > 0 && <span className="text-slate-500"> · client <span className="whitespace-nowrap">{formatF(Number(p.publicPrice))}</span></span>}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusPill ton={statut.ton}>{statut.libelle}</StatusPill>
                      {p.stockQuantity <= 5 && <StatusPill ton="attente">{p.stockQuantity === 0 ? 'Rupture' : 'Stock faible'}</StatusPill>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1" role="group" aria-label={`Stock de ${p.name}`}>
                    <button type="button" onClick={() => ajuster(p, quantite - 1)} disabled={quantite <= 0}
                      aria-label={`Retirer une unité de ${p.name}`}
                      className="w-11 h-11 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center disabled:opacity-40">
                      <Minus className="w-4 h-4" />
                    </button>
                    <input type="number" inputMode="numeric" min={0} step={1} value={quantite}
                      onChange={(e) => ajuster(p, Number(e.target.value))}
                      aria-label={`Quantité en stock de ${p.name}`}
                      className="w-16 h-11 rounded-xl border border-slate-200 text-center text-base font-bold text-slate-900 tabular-nums" />
                    <button type="button" onClick={() => ajuster(p, quantite + 1)}
                      aria-label={`Ajouter une unité de ${p.name}`}
                      className="w-11 h-11 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {modifie ? (
                    <>
                      <Button size="sm" loading={enCours === p.id} disabled={enCours !== null && enCours !== p.id} onClick={() => enregistrerStock(p)}>
                        Enregistrer {quantite}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setBrouillons((b) => { const n = { ...b }; delete n[p.id]; return n; })}>Annuler</Button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-600">en stock</span>
                  )}
                  <Button href={`/supplier/products/${encodeURIComponent(p.id)}`} size="sm" variant="ghost" className="ml-auto">Modifier</Button>
                </div>

                <details className="group">
                  <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
                    <MoreHorizontal className="w-4 h-4" />Plus
                  </summary>
                  <div className="mt-2 space-y-2 rounded-2xl bg-slate-50 p-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setPhotosPour(p)}>Photos ({p.images.length})</Button>
                      <Button size="sm" variant="ghost" loading={enCours === p.id && !modifie}
                        disabled={enCours !== null || ['rejected', 'archived'].includes(p.status)} onClick={() => dupliquer(p)}>
                        Dupliquer
                      </Button>
                    </div>
                    <p className="text-xs text-slate-600">La copie reste à vérifier, avec un stock à zéro : elle n’est pas mise en vente automatiquement.</p>
                    <FormulaireVariante produit={p} onCree={recharger} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      {photosPour && <PhotosProduitModal produit={{ id: photosPour.id, nom: photosPour.name, images: photosPour.images }} onClose={() => setPhotosPour(null)} onEnregistre={() => { setPhotosPour(null); recharger(); }}/>}
    </PageReseau>
  );
}
