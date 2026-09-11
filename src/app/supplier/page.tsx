'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Button from '@/components/ui/Button';
import PhotosProduitModal from '@/components/product/PhotosProduitModal';
import {
  Plus, ShieldCheck, Clock, Store, Package, Users, Loader2, XCircle, Camera
} from 'lucide-react';

interface SupplierProduct {
  id: string;
  name: string;
  category: string;
  images: string[];
  supplierPrice: number;
  publicPrice: number;
  stockQuantity: number;
  status: string;
}

interface SupplierMe {
  companyName: string;
  slug?: string | null;
  managerName: string | null;
  warehouseAddress: string | null;
  warehouseNeighborhood: string | null;
}

/**
 * Tableau de bord fournisseur — converti au design system (2026-09-10) :
 * un seul vert de marque pour l'action primaire (« Ajouter un produit »),
 * slate pour le reste, plus de dégradé bleu/violet ni de texte sous 11px.
 *
 * La 4ᵉ carte s'appelait « Volume écoulé — chiffre d'affaires généré » alors
 * qu'elle additionnait le prix public des produits APPROUVÉS, vendus ou non :
 * un fournisseur sans une seule vente y lisait un chiffre d'affaires. Elle dit
 * désormais ce qu'elle mesure (valeur du catalogue en vente), en attendant un
 * vrai grand-livre des ventes fournisseur (voir /api/supplier/me).
 */
export default function SupplierDashboardPage() {
  const [supplier, setSupplier] = useState<SupplierMe | null>(null);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [valeurCatalogue, setValeurCatalogue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [photosPour, setPhotosPour] = useState<SupplierProduct | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/supplier/me');
        const json = await res.json();
        if (cancelled) return;
        setSupplier(json.supplier || null);
        setProducts(json.products || []);
        setValeurCatalogue(json.totalRevenue || 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </main>
        <BottomNav />
      </div>
    );
  }

  const actifs = products.filter(p => p.status === 'approved').length;
  const enModeration = products.filter(p => p.status === 'submitted').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">

        {/* En-tête fournisseur */}
        <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-3xl space-y-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
              <Store className="w-3.5 h-3.5" />
              <span>Espace fournisseur</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              {supplier?.companyName || 'Dossier fournisseur incomplet'}
            </h1>
            <p className="text-xs text-slate-500">
              {supplier?.warehouseAddress
                ? `Entrepôt : ${supplier.warehouseAddress} (${supplier.warehouseNeighborhood || 'quartier non précisé'})`
                : 'Complétez votre dossier depuis la page d\'inscription pour renseigner votre entrepôt.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button href="/supplier/products/new" variant="primary">
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Ajouter un produit</span>
            </Button>
            <Button href="/supplier/inventory" variant="ghost">
              <Package className="w-4 h-4" />
              <span>Gérer les stocks</span>
            </Button>
            <Button href="/supplier/ambassadors" variant="ghost">
              <Users className="w-4 h-4" />
              <span>Ma boutique &amp; mes revendeurs</span>
            </Button>
            {supplier?.slug && (
              <Button href={`/s/${supplier.slug}`} target="_blank" variant="ghost">
                <Store className="w-4 h-4" />
                <span>Voir ma boutique</span>
              </Button>
            )}
          </div>
        </div>

        {/* Indicateurs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Indicateur titre="Produits déposés" valeur={products.length} note="Toutes références" />
          <Indicateur titre="En vente" valeur={actifs} note="Visibles par les revendeurs" accent />
          <Indicateur titre="En modération" valeur={enModeration} note="Vérification Suguba" />
          <Indicateur
            titre="Catalogue en vente"
            valeur={<>{valeurCatalogue.toLocaleString('fr-FR')} <span className="text-xs font-bold">F</span></>}
            note="Somme des prix publics"
          />
        </div>

        {/* Liste des produits */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-4">
          <h2 className="font-black text-base text-slate-900">Mon catalogue</h2>

          {products.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-slate-500">Aucun produit déposé pour le moment.</p>
              <Button href="/supplier/products/new" variant="primary">
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Déposer mon premier produit</span>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {products.map((product) => (
                <div key={product.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                      {product.images[0] && (
                        <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <h3 className="font-bold text-sm text-slate-900 truncate">{product.name}</h3>
                      <p className="text-[11px] text-slate-500">
                        {product.category} • Stock : <strong>{product.stockQuantity}</strong>
                      </p>
                      <p className="text-[11px] font-bold text-slate-700">
                        Mon prix : {product.supplierPrice.toLocaleString('fr-FR')} F
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <Button
                      onClick={() => setPhotosPour(product)}
                      variant={product.images.length === 0 ? 'primary' : 'ghost'}
                      size="sm"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{product.images.length === 0 ? 'Ajouter des photos' : `Photos (${product.images.length})`}</span>
                    </Button>
                    <Statut status={product.status} />
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">Prix public</span>
                      <span className="text-xs font-bold text-slate-800">
                        {product.publicPrice ? `${product.publicPrice.toLocaleString('fr-FR')} F` : 'En attente'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {photosPour && (
        <PhotosProduitModal
          produit={{ id: photosPour.id, nom: photosPour.name, images: photosPour.images }}
          onClose={() => setPhotosPour(null)}
          onEnregistre={(images) => {
            setProducts((prev) => prev.map((p) => (p.id === photosPour.id ? { ...p, images } : p)));
            setPhotosPour(null);
            // Une première photo peut avoir mis le produit en vente (prix et
            // statut calculés par le serveur) : on relit la fiche à jour.
            fetch('/api/supplier/me')
              .then((r) => r.json())
              .then((j) => { if (Array.isArray(j.products)) setProducts(j.products); })
              .catch(() => {});
          }}
        />
      )}

      <BottomNav />
    </div>
  );
}

function Indicateur({ titre, valeur, note, accent }: {
  titre: string; valeur: React.ReactNode; note: string; accent?: boolean;
}) {
  return (
    <div className="bg-white p-4 rounded-3xl border border-slate-200 space-y-1">
      <span className="text-[11px] font-bold text-slate-500 uppercase">{titre}</span>
      <p className={`text-2xl font-black ${accent ? 'text-suguba-brand' : 'text-slate-900'}`}>{valeur}</p>
      <p className="text-[11px] text-slate-400">{note}</p>
    </div>
  );
}

function Statut({ status }: { status: string }) {
  if (status === 'approved') {
    return (
      <span className="px-2.5 py-1 rounded-full bg-suguba-brand/10 text-suguba-brand text-[11px] font-bold inline-flex items-center gap-1">
        <ShieldCheck className="w-3 h-3" />
        <span>En vente</span>
      </span>
    );
  }
  if (status === 'submitted') {
    return (
      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold inline-flex items-center gap-1">
        <Clock className="w-3 h-3" />
        <span>En modération</span>
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold inline-flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        <span>Refusé</span>
      </span>
    );
  }
  return null;
}
