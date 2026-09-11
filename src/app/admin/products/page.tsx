'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import ProductImage from '@/components/common/ProductImage';
import PhotosProduitModal from '@/components/product/PhotosProduitModal';
import Button from '@/components/ui/Button';
import { ArrowLeft, Camera, ImageOff, Loader2, Plus } from 'lucide-react';

interface ProduitAdmin {
  id: string;
  nom: string;
  slug: string;
  categorie: string;
  statut: string;
  images: string[];
  prix: number;
  stock: number;
  fournisseur: string;
}

const LIBELLE_STATUT: Record<string, string> = {
  approved: 'En vente', submitted: 'En modération', pending: 'En attente', draft: 'Brouillon', rejected: 'Refusé',
};

/**
 * Catalogue complet côté admin (2026-09-11), pensé d'abord pour la chose qui
 * bloque les ventes : les produits sans photo. Ils s'affichent en premier et
 * un bouton permet d'en ajouter directement, sans recréer le produit.
 */
export default function AdminProductsPage() {
  const [produits, setProduits] = useState<ProduitAdmin[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [filtre, setFiltre] = useState<'sans_photo' | 'tous'>('sans_photo');
  const [edition, setEdition] = useState<ProduitAdmin | null>(null);

  useEffect(() => {
    fetch('/api/admin/products')
      .then((r) => r.json())
      .then((j) => {
        if (!j.produits) { setErreur(j.error || 'Chargement impossible.'); setProduits([]); return; }
        setProduits(j.produits);
        if (!j.produits.some((p: ProduitAdmin) => p.images.length === 0)) setFiltre('tous');
      })
      .catch(() => { setErreur('Erreur réseau.'); setProduits([]); });
  }, []);

  const sansPhoto = (produits || []).filter((p) => p.images.length === 0);
  const affiches = filtre === 'sans_photo' ? sansPhoto : produits || [];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-5">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" />
          <span>Tableau de bord</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">Produits</h1>
            <p className="text-xs text-slate-500">Un produit sans photo se vend et se partage très mal : commencez par eux.</p>
          </div>
          <Button href="/admin/products/new" size="sm">
            <Plus className="w-4 h-4" />
            <span>Nouveau produit</span>
          </Button>
        </div>

        {produits && sansPhoto.length > 0 && (
          <div className="rounded-3xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
            <ImageOff className="w-6 h-6 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-900">
              <strong>{sansPhoto.length} produit{sansPhoto.length > 1 ? 's' : ''} sur {produits.length}</strong> sans photo.
              Ils partent sans image dans les partages WhatsApp.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          {([['sans_photo', `Sans photo (${sansPhoto.length})`], ['tous', `Tous (${produits?.length ?? 0})`]] as const).map(([cle, libelle]) => (
            <button
              key={cle}
              onClick={() => setFiltre(cle)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold ${
                filtre === cle ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {libelle}
            </button>
          ))}
        </div>

        {erreur && <p className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-xs font-bold text-rose-700">{erreur}</p>}

        {produits === null ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>
        ) : affiches.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            {filtre === 'sans_photo' ? 'Tous les produits ont au moins une photo. 👍' : 'Aucun produit pour le moment.'}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100">
            {affiches.map((p) => (
              <div key={p.id} className="p-3 sm:p-4 flex items-center gap-3">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                  <ProductImage src={p.images[0] || ''} alt={p.nom} fill sizes="64px" className="object-cover" compact />
                  {p.images.length > 1 && (
                    <span className="absolute bottom-1 right-1 px-1.5 rounded-md bg-slate-900/80 text-white text-[11px] font-bold">
                      {p.images.length}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/p/${p.slug}`} target="_blank" className="font-bold text-sm text-slate-900 line-clamp-1 hover:underline">
                    {p.nom}
                  </Link>
                  <p className="text-[11px] text-slate-500">
                    {p.prix ? `${p.prix.toLocaleString('fr-FR')} F` : 'Sans prix'} • {LIBELLE_STATUT[p.statut] || p.statut} • {p.fournisseur}
                  </p>
                </div>
                <Button
                  onClick={() => setEdition(p)}
                  variant={p.images.length === 0 ? 'primary' : 'ghost'}
                  size="sm"
                  className="shrink-0"
                  aria-label={`${p.images.length === 0 ? 'Ajouter des photos à' : 'Modifier les photos de'} ${p.nom}`}
                >
                  <Camera className="w-4 h-4" />
                  <span className="hidden sm:inline">{p.images.length === 0 ? 'Ajouter des photos' : 'Photos'}</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>

      {edition && (
        <PhotosProduitModal
          produit={{ id: edition.id, nom: edition.nom, images: edition.images }}
          onClose={() => setEdition(null)}
          onEnregistre={(images) => {
            setProduits((prev) => (prev || []).map((p) => (p.id === edition.id ? { ...p, images } : p)));
            setEdition(null);
          }}
        />
      )}

      <BottomNav />
    </div>
  );
}
