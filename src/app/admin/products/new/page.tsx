'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import {
  PackagePlus, Image as ImageIcon, ShieldCheck, CheckCircle2,
  ArrowLeft, Loader2, X, AlertTriangle
} from 'lucide-react';

const CATEGORIES = [
  'Électroménager',
  'Électronique & TV',
  'Téléphones & Tablettes',
  'Énergie Solaire',
  'Mode & Beauté',
  'Maison & Déco',
];

/**
 * Création de produit par l'admin — l'équivalent côté Suguba de
 * /supplier/products/new, avec une différence de fond : l'admin fixe
 * lui-même toute l'économie (prix public, commission, marge) et le produit
 * naît donc directement `approved`, sans repasser par la file de modération
 * qu'il est justement chargé de tenir.
 *
 * Existe parce que jusqu'ici SEUL un compte fournisseur pouvait déposer un
 * produit : Suguba ne pouvait pas référencer son propre stock, ni saisir le
 * catalogue d'un fournisseur qui n'a pas encore de compte — un blocage réel
 * au démarrage, quand le catalogue est vide et qu'aucun fournisseur n'est
 * encore inscrit.
 */
export default function AdminNewProductPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPrice, setSupplierPrice] = useState<number>(0);
  const [publicPrice, setPublicPrice] = useState<number>(0);
  const [resellerCommission, setResellerCommission] = useState<number>(0);
  const [stockQuantity, setStockQuantity] = useState<number>(10);

  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Prix public = prix fournisseur + commission revendeur + marge Suguba.
  // La marge est donc le reste, jamais une saisie libre : la laisser saisir
  // permettrait d'enregistrer un produit dont les trois montants ne
  // s'additionnent pas au prix réellement facturé au client.
  const sugubaMargin = publicPrice - supplierPrice - resellerCommission;
  const margeInvalide = publicPrice > 0 && sugubaMargin < 0;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageError('');
    setImagePreview(URL.createObjectURL(file));
    setIsUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/products/upload-image', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setImageError(json.error || "Échec de l'envoi de la photo.");
        setImagePreview(null);
        setImageUrl('');
      } else {
        setImageUrl(json.url);
      }
    } catch (err) {
      setImageError("Erreur réseau lors de l'envoi de la photo.");
      setImagePreview(null);
      setImageUrl('');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const slugify = (value: string) =>
    value.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!name || !description || !publicPrice || !stockQuantity) {
      setSubmitError('Nom, description, prix public et stock sont obligatoires.');
      return;
    }
    if (margeInvalide) {
      setSubmitError('La marge Suguba est négative : le prix public doit couvrir le prix fournisseur et la commission revendeur.');
      return;
    }
    if (isUploadingImage) {
      setSubmitError("Attendez la fin de l'envoi de la photo.");
      return;
    }

    setIsSubmitting(true);

    const produit = {
      id: `prd-${Date.now()}`,
      slug: `${slugify(name)}-${Date.now().toString(36).slice(-4)}`,
      name,
      category,
      description,
      images: imageUrl ? [imageUrl] : [],
      supplierPrice: Number(supplierPrice),
      publicPrice: Number(publicPrice),
      resellerCommission: Number(resellerCommission),
      stockQuantity: Number(stockQuantity),
      // Publié immédiatement : c'est l'admin qui tient la file de modération,
      // se soumettre une fiche à soi-même n'aurait aucun sens.
      status: 'approved',
      supplierId: null,
      supplierName: supplierName || 'Suguba',
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: produit }),
      });
      const json = await res.json();
      setIsSubmitting(false);

      if (!res.ok || !json.success) {
        setSubmitError(json.error || "Le produit n'a pas pu être enregistré.");
        return;
      }
      setIsSuccess(true);
    } catch (err) {
      setIsSubmitting(false);
      setSubmitError('Erreur réseau, réessayez.');
    }
  };

  const resetForm = () => {
    setName(''); setDescription(''); setSupplierName('');
    setSupplierPrice(0); setPublicPrice(0); setResellerCommission(0); setStockQuantity(10);
    setImageUrl(''); setImagePreview(null); setImageError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsSuccess(false); setSubmitError('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full space-y-5">

        <Link
          href="/admin"
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour au tableau de bord</span>
        </Link>

        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Ajouter un produit au catalogue
          </h1>
          <p className="text-xs text-slate-500">
            Réservé à Suguba : le produit est publié immédiatement, sans passer par la file de modération.
          </p>
        </div>

        {isSuccess ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Produit publié !</h2>
              <p className="text-xs text-slate-600 mt-1">
                Il est désormais visible dans le catalogue public et partageable par les revendeurs.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={resetForm}
                className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 px-6 rounded-2xl text-xs transition-colors"
              >
                Ajouter un autre produit
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="bg-slate-900 hover:bg-black text-white font-bold py-3 px-6 rounded-2xl text-xs transition-colors"
              >
                Retour au tableau de bord
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom du produit *</label>
              <input
                type="text"
                required
                placeholder="Ex: Ventilateur Rechargeable 16 pouces"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catégorie *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fournisseur (optionnel)</label>
                <input
                  type="text"
                  placeholder="Laisser vide = stock Suguba"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Description *</label>
              <textarea
                rows={3}
                required
                placeholder="Caractéristiques, garantie, contenu de la boîte..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Photo du produit</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />

              {imagePreview ? (
                <div className="relative w-28 h-28 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Aperçu" className="w-full h-full object-cover" />
                  {isUploadingImage && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    </div>
                  )}
                  {!isUploadingImage && (
                    <button
                      type="button"
                      onClick={() => { setImagePreview(null); setImageUrl(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center gap-1 text-slate-400 transition-colors"
                >
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-[10px] font-bold">Ajouter</span>
                </button>
              )}
              <p className="text-[10px] text-slate-400 mt-1">JPEG, PNG ou WEBP — 5MB max.</p>
              {imageError && <p className="text-[10px] font-bold text-red-600 mt-1">{imageError}</p>}
            </div>

            {/* Économie du produit */}
            <div className="pt-2 border-t border-slate-100 space-y-4">
              <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                Économie du produit
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prix fournisseur (FCFA)</label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={supplierPrice}
                    onChange={(e) => setSupplierPrice(parseInt(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prix public (FCFA) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={500}
                    value={publicPrice}
                    onChange={(e) => setPublicPrice(parseInt(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-blue-700 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Commission revendeur (FCFA)</label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={resellerCommission}
                    onChange={(e) => setResellerCommission(parseInt(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-emerald-700 focus:bg-white"
                  />
                </div>
              </div>

              <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                margeInvalide
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <span className="flex items-center gap-1.5">
                  {margeInvalide && <AlertTriangle className="w-4 h-4" />}
                  Marge Suguba (calculée)
                </span>
                <span className={margeInvalide ? 'text-red-700' : 'text-slate-900'}>
                  {sugubaMargin.toLocaleString('fr-FR')} FCFA
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quantité en stock *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(parseInt(e.target.value) || 1)}
                  className="w-full sm:w-48 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            {submitError && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || margeInvalide}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-2xl text-xs shadow-lg shadow-blue-800/20 flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]"
            >
              <PackagePlus className="w-4 h-4" />
              <span>{isSubmitting ? 'Publication...' : 'Publier le produit'}</span>
            </button>

          </form>
        )}

      </main>

      <BottomNav />
    </div>
  );
}
