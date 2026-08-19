'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { 
  Package, AlertTriangle, CheckCircle2, Plus, 
  Minus, ArrowLeft, RefreshCw, Layers, ShieldCheck, DollarSign
} from 'lucide-react';

export default function SupplierInventoryPage() {
  const state = useSugubaStore();
  const currentUser = state.currentUser;
  const supplier = state.suppliers.find(s => s.userId === currentUser.id) || state.suppliers[0];

  const myProducts = state.products.filter(p => p.supplierId === supplier.id);

  const totalStockUnits = myProducts.reduce((acc, p) => acc + p.stockQuantity, 0);
  const totalStockValue = myProducts.reduce((acc, p) => acc + (p.supplierPrice * p.stockQuantity), 0);
  const lowStockCount = myProducts.filter(p => p.stockQuantity <= 5).length;

  const handleUpdateStock = (productId: string, delta: number) => {
    const product = myProducts.find(p => p.id === productId);
    if (!product) return;
    const newQty = Math.max(0, product.stockQuantity + delta);
    sugubaStore.updateProductStock(productId, newQty);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link 
              href="/supplier" 
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à l&apos;Espace Fournisseur</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Gestion des Stocks & Inventaire Fournisseur
            </h1>
            <p className="text-xs text-slate-500">
              Mettez à jour vos quantités en temps réel pour éviter les ruptures de livraison.
            </p>
          </div>

          <Link
            href="/supplier/products/new"
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md transition-all self-start sm:self-auto active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un Produit</span>
          </Link>
        </div>

        {/* Inventory Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unités en Stock</span>
            <p className="text-2xl font-black text-slate-900">{totalStockUnits} pièces</p>
            <p className="text-[10px] text-slate-400">Sur {myProducts.length} références actives</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Valeur Stock Fournisseur</span>
            <p className="text-2xl font-black text-emerald-700">
              {totalStockValue.toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-500">FCFA</span>
            </p>
            <p className="text-[10px] text-emerald-600 font-bold">Capital immobilisé</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Alertes Stock Faible</span>
            <p className="text-2xl font-black text-amber-600">{lowStockCount}</p>
            <p className="text-[10px] text-slate-400">Produits avec moins de 5 unités</p>
          </div>
        </div>

        {/* Products Stock List */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-black text-sm text-slate-900">
              Inventaire des Articles & Réajustement Rapide
            </h2>
            <span className="text-[11px] font-bold text-slate-500">
              {myProducts.length} références enregistrées
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {myProducts.map((product) => {
              const isLowStock = product.stockQuantity <= 5 && product.stockQuantity > 0;
              const isOutOfStock = product.stockQuantity === 0;

              return (
                <div key={product.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Product Details */}
                  <div className="flex items-center space-x-3">
                    <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                      <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-black text-xs text-slate-900">{product.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          isOutOfStock ? 'bg-rose-100 text-rose-800' :
                          isLowStock ? 'bg-amber-100 text-amber-800 animate-pulse' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isOutOfStock ? 'Rupture' : isLowStock ? 'Stock Faible' : 'Disponible'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Prix Fournisseur : <strong>{product.supplierPrice.toLocaleString('fr-FR')} FCFA</strong> • Emplacement : {product.stockLocationType === 'suguba_hub' ? 'Hub Suguba' : product.stockLocationAddress}
                      </p>
                    </div>
                  </div>

                  {/* Stock Controls */}
                  <div className="flex items-center space-x-3 self-end sm:self-auto">
                    <div className="text-right mr-2">
                      <span className="text-[10px] text-slate-400 block font-bold">Quantité :</span>
                      <span className="text-lg font-black text-slate-900">{product.stockQuantity}</span>
                    </div>

                    <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                      <button
                        onClick={() => handleUpdateStock(product.id, -1)}
                        disabled={product.stockQuantity <= 0}
                        className="w-8 h-8 rounded-xl bg-white hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center text-slate-700 font-black text-xs shadow-2xs transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleUpdateStock(product.id, 1)}
                        className="w-8 h-8 rounded-xl bg-white hover:bg-slate-200 flex items-center justify-center text-slate-700 font-black text-xs shadow-2xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleUpdateStock(product.id, 10)}
                        className="px-2.5 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center justify-center shadow-xs transition-colors"
                      >
                        +10
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
