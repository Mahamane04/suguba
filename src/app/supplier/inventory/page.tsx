'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import ProductImage from '@/components/common/ProductImage';
import Button from '@/components/ui/Button';
import { Package, Minus, Plus, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';

interface ProduitStock {
  id: string;
  name: string;
  images: string[];
  supplierPrice: number;
  stockQuantity: number;
  status: string;
}

const STATUT: Record<string, { libelle: string; classe: string }> = {
  approved: { libelle: 'En vente', classe: 'bg-suguba-brand/10 text-suguba-brand' },
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
  const [produits, setProduits] = useState<ProduitStock[] | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    fetch('/api/supplier/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setProduits(Array.isArray(j?.products) ? j.products : []))
      .catch(() => setProduits([]));
  }, []);

  const changerStock = async (p: ProduitStock, nouveau: number) => {
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
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Mes stocks</h1>
          <p className="text-xs text-slate-500">Tenez vos quantités à jour pour ne jamais vendre un article absent.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-3xl border border-slate-200 p-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase">Unités</p>
            <p className="text-lg font-black text-slate-900">{unites}</p>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 p-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase">Valeur</p>
            <p className="text-lg font-black text-slate-900">{valeur.toLocaleString('fr-FR')} F</p>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 p-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase">Stock faible</p>
            <p className={`text-lg font-black ${faibles > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{faibles}</p>
          </div>
        </div>

        {erreur && (
          <p className="rounded-2xl bg-rose-50 border border-rose-100 p-3 text-xs font-bold text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />{erreur}
          </p>
        )}

        {produits === null ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 flex justify-center">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : liste.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
            <Package className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-600">Vous n&apos;avez pas encore de produit.</p>
            <Button href="/supplier/products/new">Ajouter un produit</Button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100">
            {liste.map((p) => {
              const statut = STATUT[p.status] || { libelle: p.status, classe: 'bg-slate-100 text-slate-600' };
              return (
                <div key={p.id} className="p-3 sm:p-4 flex items-center gap-3">
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                    <ProductImage src={p.images[0] || ''} alt={p.name} fill sizes="56px" className="object-cover" compact />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 line-clamp-1">{p.name}</p>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${statut.classe}`}>{statut.libelle}</span>
                    {p.stockQuantity <= 5 && (
                      <span className="ml-1.5 inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800">
                        {p.stockQuantity === 0 ? 'Rupture' : 'Stock faible'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => changerStock(p, p.stockQuantity - 1)}
                      disabled={enCours === p.id || p.stockQuantity <= 0}
                      aria-label={`Retirer une unité de ${p.name}`}
                      className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center disabled:opacity-40"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center text-base font-black text-slate-900">{p.stockQuantity}</span>
                    <button
                      type="button"
                      onClick={() => changerStock(p, p.stockQuantity + 1)}
                      disabled={enCours === p.id}
                      aria-label={`Ajouter une unité de ${p.name}`}
                      className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
