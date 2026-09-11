'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import ProductImage from '@/components/common/ProductImage';
import PhotosProduitModal from '@/components/product/PhotosProduitModal';
import ProductPricingModal from '@/components/admin/ProductPricingModal';
import Button from '@/components/ui/Button';
import type { Product } from '@/types';
import { ArrowLeft, Camera, ImageOff, Loader2, Plus, Tag, Ban } from 'lucide-react';

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
  prixFournisseur: number;
  partProposee: number;
  commission: number;
  fournisseurId: string | null;
  creeLe: string;
}

type Filtre = 'nouveautes' | 'sans_photo' | 'tous';

const LIBELLE_STATUT: Record<string, string> = {
  approved: 'En vente', submitted: 'En attente', pending: 'En attente', draft: 'Brouillon', rejected: 'Retiré',
};

const QUATORZE_JOURS = 14 * 24 * 60 * 60 * 1000;

// ProductPricingModal attend un Product complet ; seuls l'identifiant, le nom,
// les prix et le statut servent au calcul.
function versProduct(p: ProduitAdmin): Product {
  return {
    id: p.id, supplierId: p.fournisseurId || '', supplierName: p.fournisseur, name: p.nom, slug: p.slug,
    category: p.categorie, description: '', images: p.images, supplierPrice: p.prixFournisseur,
    publicPrice: p.prix, resellerCommission: p.commission, resellerCommissionProposee: p.partProposee, sugubaMargin: 0, stockQuantity: p.stock, warrantyMonths: 0,
    preparationDelayHours: 0, stockLocationType: 'supplier', stockLocationAddress: '',
    status: p.statut as Product['status'], marketingPitch: '', createdAt: p.creeLe,
  };
}

/**
 * Catalogue complet côté admin.
 *
 * Depuis le 2026-09-11, les dépôts fournisseurs sont publiés AUTOMATIQUEMENT
 * au prix recommandé (src/lib/publication-auto.ts) : la validation se fait
 * après coup, ici. « Nouveautés fournisseurs » liste ce qui est parti en vente
 * ces 14 derniers jours ; chaque produit peut être retarifé (« Prix ») ou
 * retiré de la vente (« Retirer »). « Sans photo » regroupe ce qui ne peut pas
 * être publié tant qu'il n'a pas de photo.
 */
export default function AdminProductsPage() {
  const [produits, setProduits] = useState<ProduitAdmin[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('nouveautes');
  const [photosPour, setPhotosPour] = useState<ProduitAdmin | null>(null);
  const [prixPour, setPrixPour] = useState<ProduitAdmin | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  const recharger = useCallback(async (choisirFiltre = false) => {
    try {
      const j = await fetch('/api/admin/products').then((r) => r.json());
      if (!j.produits) { setErreur(j.error || 'Chargement impossible.'); setProduits([]); return; }
      setProduits(j.produits);
      if (choisirFiltre) {
        const liste: ProduitAdmin[] = j.produits;
        const aDesNouveautes = liste.some((p) => p.statut === 'approved' && p.fournisseurId && Date.now() - Date.parse(p.creeLe) < QUATORZE_JOURS);
        setFiltre(aDesNouveautes ? 'nouveautes' : liste.some((p) => p.images.length === 0) ? 'sans_photo' : 'tous');
      }
    } catch {
      setErreur('Erreur réseau.');
      setProduits((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => { recharger(true); }, [recharger]);

  const tous = produits || [];
  const nouveautes = tous.filter((p) => p.statut === 'approved' && p.fournisseurId && Date.now() - Date.parse(p.creeLe) < QUATORZE_JOURS);
  const sansPhoto = tous.filter((p) => p.images.length === 0);
  const affiches = filtre === 'nouveautes' ? nouveautes : filtre === 'sans_photo' ? sansPhoto : tous;

  const retirer = async (p: ProduitAdmin) => {
    if (!window.confirm(`Retirer « ${p.nom} » de la vente ? Il ne sera plus visible ni partageable. Vous pourrez le remettre en vente en fixant son prix.`)) return;
    setErreur('');
    setEnCours(p.id);
    try {
      const res = await fetch('/api/admin/products/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: p.id, statut: 'rejected' }),
      });
      const json = await res.json();
      if (!res.ok) { setErreur(json.error || 'Retrait impossible.'); return; }
      setProduits((prev) => (prev || []).map((x) => (x.id === p.id ? { ...x, statut: 'rejected' } : x)));
    } catch {
      setErreur('Erreur réseau.');
    } finally {
      setEnCours(null);
    }
  };

  const onglets: [Filtre, string][] = [
    ['nouveautes', `Nouveautés fournisseurs (${nouveautes.length})`],
    ['sans_photo', `Sans photo (${sansPhoto.length})`],
    ['tous', `Tous (${tous.length})`],
  ];

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
            <p className="text-xs text-slate-500">
              Les dépôts des fournisseurs partent en vente automatiquement au prix recommandé. Vérifiez-les ici après coup.
            </p>
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
              <strong>{sansPhoto.length} produit{sansPhoto.length > 1 ? 's' : ''}</strong> sans photo : ils ne peuvent pas
              être publiés automatiquement, et partent sans image dans les partages.
            </p>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {onglets.map(([cle, libelle]) => (
            <button
              key={cle}
              onClick={() => setFiltre(cle)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
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
            {filtre === 'nouveautes'
              ? 'Aucun produit fournisseur publié ces 14 derniers jours.'
              : filtre === 'sans_photo'
                ? 'Tous les produits ont au moins une photo. 👍'
                : 'Aucun produit pour le moment.'}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100">
            {affiches.map((p) => (
              <div key={p.id} className="p-3 sm:p-4 space-y-2.5">
                <div className="flex items-center gap-3">
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
                      {p.prix ? `${p.prix.toLocaleString('fr-FR')} F` : 'Sans prix'}
                      {p.prixFournisseur ? ` (fournisseur ${p.prixFournisseur.toLocaleString('fr-FR')} F)` : ''}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Revendeur : {p.commission.toLocaleString('fr-FR')} F
                      {p.partProposee > 0 ? ' (part choisie par le fournisseur)' : ' (calculée par Suguba)'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      <span className={p.statut === 'approved' ? 'text-suguba-brand font-bold' : p.statut === 'rejected' ? 'text-rose-600 font-bold' : 'text-amber-700 font-bold'}>
                        {LIBELLE_STATUT[p.statut] || p.statut}
                      </span>
                      {' • '}{p.fournisseur}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPhotosPour(p)}
                    variant={p.images.length === 0 ? 'primary' : 'ghost'}
                    size="sm"
                    className="flex-1"
                    aria-label={`${p.images.length === 0 ? 'Ajouter des photos à' : 'Modifier les photos de'} ${p.nom}`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>{p.images.length === 0 ? 'Photos' : `Photos (${p.images.length})`}</span>
                  </Button>
                  <Button onClick={() => setPrixPour(p)} variant="ghost" size="sm" className="flex-1" aria-label={`Fixer le prix de ${p.nom}`}>
                    <Tag className="w-4 h-4" />
                    <span>{p.statut === 'approved' ? 'Prix' : 'Mettre en vente'}</span>
                  </Button>
                  {p.statut === 'approved' && (
                    <Button
                      onClick={() => retirer(p)}
                      disabled={enCours === p.id}
                      variant="ghost"
                      size="sm"
                      className="flex-1 !text-rose-700"
                      aria-label={`Retirer ${p.nom} de la vente`}
                    >
                      <Ban className="w-4 h-4" />
                      <span>Retirer</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {photosPour && (
        <PhotosProduitModal
          produit={{ id: photosPour.id, nom: photosPour.nom, images: photosPour.images }}
          onClose={() => setPhotosPour(null)}
          onEnregistre={() => {
            setPhotosPour(null);
            // Une première photo peut avoir publié le produit : on relit tout.
            recharger();
          }}
        />
      )}

      <ProductPricingModal
        product={prixPour ? versProduct(prixPour) : null}
        isOpen={!!prixPour}
        onClose={() => {
          setPrixPour(null);
          recharger();
        }}
      />

      <BottomNav />
    </div>
  );
}
