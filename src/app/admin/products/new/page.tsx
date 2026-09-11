'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import PhotosUploader from '@/components/product/PhotosUploader';
import { FAMILLES_CATEGORIES } from '@/lib/product-categories';
import {
  PackagePlus, ShieldCheck, CheckCircle2, ArrowLeft, AlertTriangle, ChevronDown
} from 'lucide-react';

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
  const [category, setCategory] = useState(FAMILLES_CATEGORIES[0].categories[0]);
  const [description, setDescription] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPrice, setSupplierPrice] = useState<number>(0);
  const [publicPrice, setPublicPrice] = useState<number>(0);
  const [stockQuantity, setStockQuantity] = useState<number>(10);

  const [images, setImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  // Changer cette clé remonte PhotosUploader à vide (« Ajouter un autre produit »).
  const [uploaderKey, setUploaderKey] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Commission calculée par le moteur de tarification (src/lib/pricing.ts),
  // renvoyée par /api/admin/products/price à la publication.
  //
  // Bug corrigé le 2026-09-11 : ce formulaire enregistrait le produit via
  // /api/products/sync — qui, depuis la tarification automatique, crée
  // TOUJOURS un produit « submitted » à prix 0 — puis affichait « Produit
  // publié ! ». Le produit restait invisible, et partagé, il annonçait « 0 F »
  // avec un lien « Produit introuvable ». La publication passe désormais par
  // la route de tarification, seule habilitée à fixer un prix et à approuver.
  const [commissionCalculee, setCommissionCalculee] = useState<number | null>(null);
  const [publieOk, setPublieOk] = useState(false);

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
    if (!supplierPrice) {
      setSubmitError("Indiquez le prix fournisseur : c'est lui qui détermine le prix minimal et la commission.");
      return;
    }
    if (isUploadingImage) {
      setSubmitError("Attendez la fin de l'envoi des photos.");
      return;
    }

    setIsSubmitting(true);

    const produit = {
      id: `prd-${Date.now()}`,
      slug: `${slugify(name)}-${Date.now().toString(36).slice(-4)}`,
      name,
      category,
      description,
      images,
      supplierPrice: Number(supplierPrice),
      stockQuantity: Number(stockQuantity),
      // Créé en attente ; la publication (prix + commission) suit juste après
      // via /api/admin/products/price.
      status: 'submitted',
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
      if (!res.ok || !json.success) {
        setIsSubmitting(false);
        setSubmitError(json.error || "Le produit n'a pas pu être enregistré.");
        return;
      }

      // Publication : prix de vente + commission calculée, approbation.
      const resPrix = await fetch('/api/admin/products/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: produit.id, publicPrice: Number(publicPrice) }),
      });
      const jsonPrix = await resPrix.json();
      setIsSubmitting(false);
      if (!resPrix.ok || !jsonPrix.success) {
        // Enregistré mais pas publié : on le dit franchement, le produit reste
        // dans « Modération » pour être tarifé.
        setPublieOk(false);
        setSubmitError(
          `Produit enregistré, mais PAS publié : ${jsonPrix.error || 'prix refusé.'} ` +
          'Corrigez le prix depuis « Modération » sur le tableau de bord.',
        );
        setIsSuccess(true);
        return;
      }
      setCommissionCalculee(Number(jsonPrix.tarif?.commission) || 0);
      setPublieOk(true);
      setIsSuccess(true);
    } catch (err) {
      setIsSubmitting(false);
      setSubmitError('Erreur réseau, réessayez.');
    }
  };

  const resetForm = () => {
    setName(''); setDescription(''); setSupplierName('');
    setSupplierPrice(0); setPublicPrice(0); setStockQuantity(10);
    setCommissionCalculee(null); setPublieOk(false);
    setImages([]); setUploaderKey((k) => k + 1);
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
              <h2 className="text-xl font-black text-slate-900">
                {publieOk ? 'Produit publié !' : 'Produit enregistré, pas encore publié'}
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                {publieOk
                  ? `Il est visible dans le catalogue et partageable. Commission revendeur calculée : ${(commissionCalculee ?? 0).toLocaleString('fr-FR')} F.`
                  : submitError}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={resetForm}
                className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-2xl text-xs transition-colors"
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
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-slate-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catégorie *</label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 pr-9 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
                  >
                    {FAMILLES_CATEGORIES.map(({ famille, categories }) => (
                      <optgroup key={famille} label={famille}>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
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
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Photos du produit</label>
              <PhotosUploader key={uploaderKey} value={images} onChange={setImages} onUploadingChange={setIsUploadingImage} />
            </div>

            {/* Économie du produit */}
            <div className="pt-2 border-t border-slate-100 space-y-4">
              <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-slate-700" />
                Économie du produit
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prix fournisseur (FCFA) *</label>
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-700 focus:bg-white"
                  />
                </div>

              </div>

              <p className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  La commission revendeur est calculée automatiquement à partir des réglages économiques.
                  Un prix trop bas pour couvrir les coûts est refusé, avec le prix minimal indiqué.
                </span>
              </p>

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
              disabled={isSubmitting}
              className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-2xl text-xs shadow-lg shadow-slate-800/20 flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]"
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
