'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import { useSugubaStore } from '@/lib/store';
import { 
  ShoppingBag, Plus, PackageCheck, AlertTriangle, 
  Clock, ShieldCheck, ArrowRight, DollarSign, Store, Package, Users
} from 'lucide-react';

export default function SupplierDashboardPage() {
  const state = useSugubaStore();
  const currentUser = state.currentUser;
  const supplier = state.suppliers.find(s => s.userId === currentUser.id) || state.suppliers[0];
  const myProducts = state.products.filter(p => p.supplierId === supplier?.id);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Supplier Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-5 sm:p-6 rounded-3xl shadow-lg">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-800 text-blue-200 text-[11px] font-bold">
              <Store className="w-3.5 h-3.5 text-blue-300" />
              <span>Grossiste & Fournisseur Partenaire</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black">
              {supplier.companyName}
            </h1>
            <p className="text-xs text-blue-100">
              Entrepôt : {supplier.warehouseAddress} ({supplier.warehouseNeighborhood})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/supplier/ambassadors"
              className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-black shadow-md transition-all active:scale-95"
            >
              <Users className="w-4 h-4 text-purple-200" />
              <span>Mon Réseau d&apos;Ambassadrices</span>
            </Link>

            <Link
              href="/supplier/inventory"
              className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-2xl text-xs font-bold transition-all active:scale-95"
            >
              <Package className="w-4 h-4" />
              <span>Gérer les Stocks</span>
            </Link>

            <Link
              href="/supplier/products/new"
              className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-2xl text-xs font-black shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Ajouter un produit</span>
            </Link>
          </div>
        </div>

        {/* Supplier Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Produits au catalogue</span>
            <p className="text-2xl font-black text-slate-900">{myProducts.length}</p>
            <p className="text-[10px] text-slate-400">Total références</p>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-emerald-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-emerald-700 uppercase">Produits Actifs</span>
            <p className="text-2xl font-black text-emerald-600">
              {myProducts.filter(p => p.status === 'approved').length}
            </p>
            <p className="text-[10px] text-slate-400">En vente par les revendeurs</p>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-amber-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-amber-700 uppercase">En Modération</span>
            <p className="text-2xl font-black text-amber-600">
              {myProducts.filter(p => p.status === 'submitted').length}
            </p>
            <p className="text-[10px] text-slate-400">Vérification Suguba en cours</p>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Volume Écoulé</span>
            <p className="text-2xl font-black text-blue-700">
              {supplier.totalRevenue.toLocaleString('fr-FR')} <span className="text-xs font-normal">F</span>
            </p>
            <p className="text-[10px] text-slate-400">Chiffre d&apos;affaires généré</p>
          </div>
        </div>

        {/* Products List */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-base text-slate-900">
              Gestion de Mon Catalogue & Stocks
            </h2>
            <Link
              href="/supplier/products/new"
              className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Nouveau produit</span>
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {myProducts.map((product) => (
              <div key={product.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                    <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <h3 className="font-bold text-xs text-slate-900 truncate">{product.name}</h3>
                    <p className="text-[11px] text-slate-500">
                      Catégorie : <strong>{product.category}</strong> • Stock : <strong>{product.stockQuantity} unités</strong>
                    </p>
                    <p className="text-[11px] font-black text-blue-700">
                      Mon Prix Fournisseur : {product.supplierPrice.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div>
                    {product.status === 'approved' && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center space-x-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>Approuvé & Publié</span>
                      </span>
                    )}
                    {product.status === 'submitted' && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>En validation Suguba</span>
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Prix Public Fixé</span>
                    <span className="text-xs font-bold text-slate-800">
                      {product.publicPrice ? `${product.publicPrice.toLocaleString('fr-FR')} FCFA` : 'En attente'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
