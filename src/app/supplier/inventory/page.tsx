'use client';

import SugubaLoader from '@/components/ui/SugubaLoader';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import ProductImage from '@/components/common/ProductImage';
import Button from '@/components/ui/Button';
import PhotosProduitModal from '@/components/product/PhotosProduitModal';
import FormulaireVariante from '@/components/product/FormulaireVariante';
import { Package, Minus, Plus, AlertTriangle, ArrowLeft } from 'lucide-react';
import { formatF } from '@/lib/montant';

interface ProduitStock {
  id: string;
  name: string;
  images: string[];
  supplierPrice: number;
  stockQuantity: number;
  status: string;
}

const STATUT: Record<string, { libelle: string; classe: string }> = {
  approved: { libelle: 'En vente', classe: 'bg-suguba-brand/10 text-suguba-brand-dark' },
  draft: { libelle: 'Copie à vérifier', classe: 'bg-slate-100 text-slate-700' },
  submitted: { libelle: 'En attente', classe: 'bg-amber-50 text-amber-800' },
  rejected: { libelle: 'Retiré', classe: 'bg-rose-50 text-rose-700' },
};

/**
 * Stocks du fournisseur — refaits le 2026-09-11 sur ses VRAIS produits
 * (/api/supplier/me), avec une mise à jour enregistrée en base
 * (/api/supplier/stock). L'ancienne page affichait les produits d'un
 * fournisseur de démonstration et ne changeait que la mémoire du téléphone.
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
  const [quantites, setQuantites] = useState<Record<string, string>>({});

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

  const changerStock = async (p: ProduitStock, nouveau: number) => {
    if (enCours) return;
    const quantite = Math.max(0, nouveau);
    setErreur('');
    setEnCours(p.id);
    const avant = p.stockQuantity;
    setProduits((l) => (l || []).map((x) => (x.id === p.id ? { ...x, stockQuantity: quantite } : x)));
    try {
      const res = await fetch('/api/supplier/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: p.id, stock: quantite }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'Mise à jour impossible.');
    } catch (e) {
      // On remet la valeur d'avant : l'écran ne doit jamais montrer un stock
      // qui n'est pas enregistré.
      setProduits((l) => (l || []).map((x) => (x.id === p.id ? { ...x, stockQuantity: avant } : x)));
      setErreur(e instanceof Error ? e.message : 'Mise à jour impossible.');
    } finally {
      setEnCours(null);
    }
  };

  const liste = produits || [];
  const unites = liste.reduce((s, p) => s + p.stockQuantity, 0);
  const valeur = liste.reduce((s, p) => s + p.supplierPrice * p.stockQuantity, 0);
  const faibles = liste.filter((p) => p.stockQuantity <= 5).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-5">
        <Link href="/supplier" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" />
          <span>Mon espace fournisseur</span>
        </Link>

        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Mes produits</h1>
          <p className="text-xs text-slate-500">Tenez vos quantités à jour pour ne jamais vendre un article absent.</p>
        </div>

        {produits !== null && <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-3xl border border-slate-200 p-3">
            <p className="text-xs font-bold text-slate-500 uppercase">Unités</p>
            <p className="text-lg font-bold text-slate-900">{unites}</p>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 p-3">
            <p className="text-xs font-bold text-slate-500 uppercase">Valeur</p>
            <p className="text-lg font-bold text-slate-900">{formatF(valeur)}</p>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 p-3">
            <p className="text-xs font-bold text-slate-500 uppercase">Stock faible</p>
            <p className={`text-lg font-bold ${faibles > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{faibles}</p>
          </div>
        </div>}

        <div className="bg-white rounded-2xl p-4 space-y-3 border"><Button href="/supplier/products/new">Ajouter une offre</Button><label htmlFor="stock-recherche" className="block text-sm font-semibold">Rechercher un produit</label><input id="stock-recherche" value={recherche} onChange={e => setRecherche(e.target.value)} className="w-full border rounded-xl p-3"/><label htmlFor="stock-filtre" className="block text-sm font-semibold">Afficher</label><select id="stock-filtre" value={filtre} onChange={e => setFiltre(e.target.value)} className="w-full border rounded-xl p-3"><option value="tous">Tous les produits</option><option value="faible">Stock faible ou rupture</option><option value="approved">En vente</option><option value="submitted">En attente</option></select></div>
        {erreur && (
          <p className="rounded-2xl bg-rose-50 border border-rose-100 p-3 text-xs font-bold text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />{erreur}
          </p>
        )}

        {erreurChargement ? <div role="alert" className="rounded-2xl border bg-white p-5 space-y-3"><p>Vos produits n’ont pas pu être chargés.</p><Button onClick={recharger}>Réessayer</Button></div> : produits === null ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 flex justify-center">
            <SugubaLoader className="w-6 h-6 text-slate-400" />
          </div>
        ) : liste.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
            <Package className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-600">Vous n&apos;avez pas encore de produit.</p>
            <Button href="/supplier/products/new">Ajouter un produit</Button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100">
            {liste.filter(p => p.name.toLocaleLowerCase('fr').includes(recherche.toLocaleLowerCase('fr')) && (filtre === 'tous' || (filtre === 'faible' ? p.stockQuantity <= 5 : p.status === filtre))).map((p) => {
              const statut = STATUT[p.status] || { libelle: p.status, classe: 'bg-slate-100 text-slate-600' };
              return (
                <div key={p.id} className="p-3 sm:p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                    <ProductImage src={p.images[0] || ''} alt={p.name} fill sizes="56px" className="object-cover" compact />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 line-clamp-1">{p.name}</p>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${statut.classe}`}>{statut.libelle}</span>
                    {p.stockQuantity <= 5 && (
                      <span className="ml-1.5 inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800">
                        {p.stockQuantity === 0 ? 'Rupture' : 'Stock faible'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => changerStock(p, p.stockQuantity - 1)}
                      disabled={enCours !== null || p.stockQuantity <= 0}
                      aria-label={`Retirer une unité de ${p.name}`}
                      className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center disabled:opacity-40"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center text-base font-bold text-slate-900">{p.stockQuantity}</span>
                    <button
                      type="button"
                      onClick={() => changerStock(p, p.stockQuantity + 1)}
                      disabled={enCours !== null}
                      aria-label={`Ajouter une unité de ${p.name}`}
                      className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2"><div><label htmlFor={`quantite-${p.id}`} className="block text-xs font-semibold mb-1">Nouvelle quantité</label><input id={`quantite-${p.id}`} type="number" min="0" step="1" value={quantites[p.id] ?? p.stockQuantity} onChange={e => setQuantites(v => ({ ...v, [p.id]: e.target.value }))} className="w-28 border rounded-xl p-2"/></div><Button size="sm" disabled={enCours !== null || quantites[p.id] === undefined || quantites[p.id] === '' || !Number.isInteger(Number(quantites[p.id])) || Number(quantites[p.id]) < 0} onClick={() => { changerStock(p, Number(quantites[p.id])); setQuantites(v => { const n = { ...v }; delete n[p.id]; return n; }); }}>Confirmer le stock</Button></div>
                <div className="flex flex-wrap gap-2"><Button size="sm" variant="ghost" onClick={() => setPhotosPour(p)}>Photos ({p.images.length})</Button><Button href={`/supplier/products/${encodeURIComponent(p.id)}`} size="sm" variant="ghost">Modifier l’offre</Button><Button size="sm" variant="ghost" disabled={enCours !== null || ['rejected', 'archived'].includes(p.status)} onClick={() => dupliquer(p)}>{enCours === p.id ? <SugubaLoader className="w-4 h-4"/> : null}Dupliquer</Button></div>
                <p className="text-xs text-slate-500">La copie reste à vérifier, avec un stock à zéro. Elle n’est pas mise en vente automatiquement.</p>
                <FormulaireVariante produit={p} onCree={recharger} />
                </div>
              );
            })}
          </div>
        )}
      </main>

      {photosPour && <PhotosProduitModal produit={{ id: photosPour.id, nom: photosPour.name, images: photosPour.images }} onClose={() => setPhotosPour(null)} onEnregistre={() => { setPhotosPour(null); recharger(); }}/>}
      <BottomNav />
    </div>
  );
}
