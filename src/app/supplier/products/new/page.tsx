'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import PhotosUploader from '@/components/product/PhotosUploader';
import { useToast } from '@/components/ui/Toast';
import { sugubaStore, useSugubaStore } from '@/lib/store';
import {
  PackagePlus, MapPin, ShieldCheck, CheckCircle2, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export default function NewSupplierProductPage() {
  const router = useRouter();
  const { toast } = useToast();
  const state = useSugubaStore();
  const supplier = state.suppliers.find(s => s.userId === state.currentUser.id) || state.suppliers[0];

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Électroménager');
  const [description, setDescription] = useState('');
  const [supplierPrice, setSupplierPrice] = useState<number>(30000);
  const [stockQuantity, setStockQuantity] = useState<number>(20);
  const [warrantyMonths, setWarrantyMonths] = useState<number>(6);
  const [preparationDelayHours, setPreparationDelayHours] = useState<number>(2);
  const [stockLocationAddress, setStockLocationAddress] = useState(supplier?.warehouseAddress || 'Grand Marché, Bamako');
  // Photos envoyées au stockage Suguba (jamais une URL collée à la main, voir
  // BUG-011) — plusieurs désormais, la première étant la photo principale.
  const [images, setImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // Résultat de la publication automatique : en vente à tel prix, ou en
  // attente avec la raison (voir src/lib/publication-auto.ts).
  const [publication, setPublication] = useState<{ publie: boolean; prix?: number; commission?: number; raison?: string } | null>(null);

  // Part laissée au revendeur, choisie par le fournisseur (2026-09-11). Le prix
  // client en découle, calculé par le SERVEUR (/api/products/apercu-prix) : la
  // structure de coûts de Suguba ne part pas dans le navigateur.
  const [partRevendeur, setPartRevendeur] = useState<number>(3000);
  const [apercu, setApercu] = useState<{
    prixVente: number; commission: number; partChoisieUtilisee: boolean; mode: string;
    releveAuPlancher?: boolean; commissionFaible?: boolean; commissionMinimale: number;
  } | null>(null);
  useEffect(() => {
    if (!(supplierPrice > 0)) { setApercu(null); return; }
    const controle = new AbortController();
    const minuteur = setTimeout(() => {
      fetch(`/api/products/apercu-prix?prixFournisseur=${supplierPrice}&partRevendeur=${partRevendeur || 0}`, { signal: controle.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => setApercu(j && typeof j.prixVente === 'number' ? j : null))
        .catch(() => {});
    }, 350);
    return () => { clearTimeout(minuteur); controle.abort(); };
  }, [supplierPrice, partRevendeur]);
  const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description || !supplierPrice || !stockQuantity) {
      toast('Remplissez le nom, la description, le prix et le stock.', { ton: 'erreur' });
      return;
    }
    if (isUploadingImage) {
      toast("Attendez la fin de l'envoi des photos.", { ton: 'info' });
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    const { cloud, publication: resultat } = await sugubaStore.addSupplierProduct({
      supplierId: supplier.id,
      supplierName: supplier.companyName,
      name,
      category,
      description,
      images,
      supplierPrice: Number(supplierPrice),
      resellerCommissionProposee: Number(partRevendeur) || 0,
      stockQuantity: Number(stockQuantity),
      warrantyMonths: Number(warrantyMonths),
      preparationDelayHours: Number(preparationDelayHours),
      stockLocationAddress,
    });

    setIsSubmitting(false);

    // Sans cette vérification, un échec réseau ou de session afficherait
    // quand même "Produit soumis avec succès" alors que l'admin (qui modère
    // via Supabase, jamais le localStorage du fournisseur) ne verrait jamais
    // rien — panne silencieuse, exactement le piège déjà rencontré côté n8n.
    if (!cloud) {
      setSubmitError('Le produit n\'a pas pu être envoyé au serveur Suguba (session expirée ou connexion instable). Rien n\'a été soumis à la modération — réessayez.');
      return;
    }

    setPublication(resultat ?? null);
    setIsSuccess(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full space-y-5">
        
        {/* Navigation back */}
        <Link 
          href="/supplier" 
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à mon espace fournisseur</span>
        </Link>

        {/* Page Title */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Ajouter un Nouveau Produit au Réseau
          </h1>
          <p className="text-xs text-slate-500">
            Avec au moins une photo, votre produit est mis en vente tout de suite, au prix calculé par Suguba.
          </p>
        </div>

        {/* Workflow reminder card */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 space-y-1">
          <p className="font-bold flex items-center">
            <ShieldCheck className="w-4 h-4 mr-1.5 text-blue-700" />
            Comment ça marche :
          </p>
          <p className="text-[11px] text-blue-800">
            Vous déposez → Suguba calcule le prix de vente et la commission des revendeurs → le produit est en vente
            aussitôt. Suguba peut ajuster le prix ou retirer un produit après coup.
          </p>
        </div>

        {submitError && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
            {submitError}
          </div>
        )}

        {isSuccess ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {publication?.publie ? 'Produit en vente !' : 'Produit enregistré'}
              </h2>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                {publication?.publie
                  ? `Il est visible dans le catalogue au prix de ${(publication.prix ?? 0).toLocaleString('fr-FR')} F. Vous toucherez votre prix fournisseur sur chaque vente livrée.`
                  : `Pas encore en vente : ${publication?.raison || 'Suguba doit fixer son prix.'}`}
              </p>
            </div>
            <button
              onClick={() => router.push('/supplier')}
              className="bg-slate-900 hover:bg-black text-white font-bold py-3 px-6 rounded-2xl text-xs transition-colors"
            >
              Retourner à mon catalogue
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            
            {/* Nom du produit */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nom du Produit *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Smart TV Samsung 43 Pouces Full HD"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-blue-600"
              />
            </div>

            {/* Catégorie */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catégorie *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
              >
                <option value="Électroménager">Électroménager</option>
                <option value="Électronique & TV">Électronique & TV</option>
                <option value="Téléphones & Tablettes">Téléphones & Tablettes</option>
                <option value="Énergie Solaire">Énergie Solaire</option>
                <option value="Mode & Beauté">Mode & Beauté</option>
                <option value="Maison & Déco">Maison & Déco</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Description Détaillée & Spécifications *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Ex: Écran Full HD, 2 ports HDMI, garantie 1 an, livré avec support mural..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-blue-600"
              />
            </div>

            {/* Photos du produit — plusieurs, envoyées au stockage Suguba */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Photos du produit
              </label>
              <PhotosUploader value={images} onChange={setImages} onUploadingChange={setIsUploadingImage} />
            </div>

            {/* Prix Fournisseur & Stock */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Prix Fournisseur Plancher Garanti (FCFA) *
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  step={500}
                  placeholder="Ex: 30000"
                  value={supplierPrice}
                  onChange={(e) => setSupplierPrice(parseInt(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-blue-700 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Montant exact que vous toucherez sur chaque vente livrée.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantité en Stock Réel *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="Ex: 25"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            {/* Part revendeur fixée par le fournisseur + aperçu du prix client */}
            <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Part du revendeur par vente (FCFA)
                </label>
                <input
                  type="number"
                  min={0}
                  step={250}
                  value={partRevendeur}
                  onChange={(e) => setPartRevendeur(parseInt(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Ce que vous laissez au revendeur qui vend votre produit. Plus elle est élevée, plus les revendeurs le partageront.
                </span>
              </div>

              {apercu && (
                <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5">
                  <div className="flex justify-between"><span className="text-slate-600">Prix payé par le client</span><strong className="text-slate-900 text-sm">{fmt(apercu.prixVente)}</strong></div>
                  <div className="flex justify-between"><span className="text-slate-600">Vous touchez</span><strong className="text-slate-900">{fmt(supplierPrice)}</strong></div>
                  <div className="flex justify-between"><span className="text-slate-600">Le revendeur touche</span><strong className="text-suguba-brand">{fmt(apercu.commission)}</strong></div>
                  {!apercu.partChoisieUtilisee && (
                    <p className="text-[11px] text-slate-500 pt-1">
                      {apercu.mode === 'auto' ? 'La part du revendeur est actuellement calculée par Suguba.' : 'Sans part indiquée, Suguba la calcule.'}
                    </p>
                  )}
                  {apercu.releveAuPlancher && (
                    <p className="text-[11px] text-amber-700 pt-1">Prix ajusté pour couvrir la livraison et les frais de service.</p>
                  )}
                  {apercu.commissionFaible && (
                    <p className="text-[11px] text-amber-700 pt-1">
                      Part inférieure à {fmt(apercu.commissionMinimale)} : le produit sera en vente, mais pas proposé au partage des revendeurs.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Garantie & Délai de préparation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Garantie (en mois)
                </label>
                <input
                  type="number"
                  min={0}
                  value={warrantyMonths}
                  onChange={(e) => setWarrantyMonths(parseInt(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Délai de préparation (heures)
                </label>
                <input
                  type="number"
                  min={1}
                  value={preparationDelayHours}
                  onChange={(e) => setPreparationDelayHours(parseInt(e.target.value) || 1)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            {/* Localisation du stock */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Adresse & Localisation du Stock à Bamako *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={stockLocationAddress}
                  onChange={(e) => setStockLocationAddress(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-2xl text-xs shadow-lg shadow-blue-800/20 flex items-center justify-center space-x-2 transition-transform active:scale-[0.98]"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Soumettre le produit pour modération Suguba</span>
            </button>

          </form>
        )}

      </main>

      <BottomNav />
    </div>
  );
}
