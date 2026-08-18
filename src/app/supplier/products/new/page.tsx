'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import { sugubaStore, useSugubaStore } from '@/lib/store';
import { 
  PackagePlus, Image as ImageIcon, MapPin, 
  ShieldCheck, Clock, CheckCircle2, ArrowRight, ArrowLeft 
} from 'lucide-react';
import Link from 'next/link';

export default function NewSupplierProductPage() {
  const router = useRouter();
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
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description || !supplierPrice || !stockQuantity) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    setIsSubmitting(true);

    const images = imageUrl ? [imageUrl] : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80'];

    sugubaStore.addSupplierProduct({
      supplierId: supplier.id,
      supplierName: supplier.companyName,
      name,
      category,
      description,
      images,
      supplierPrice: Number(supplierPrice),
      stockQuantity: Number(stockQuantity),
      warrantyMonths: Number(warrantyMonths),
      preparationDelayHours: Number(preparationDelayHours),
      stockLocationAddress,
    });

    setIsSubmitting(false);
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
            Le produit passera par la validation Suguba avant d&apos;être visible par des milliers de revendeurs.
          </p>
        </div>

        {/* Workflow reminder card */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 space-y-1">
          <p className="font-bold flex items-center">
            <ShieldCheck className="w-4 h-4 mr-1.5 text-blue-700" />
            Processus de validation Suguba :
          </p>
          <p className="text-[11px] text-blue-800">
            Brouillon $\rightarrow$ Soumis $\rightarrow$ Vérification Suguba (Qualité & Marge) $\rightarrow$ Approuvé & Publié.
          </p>
        </div>

        {isSuccess ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Produit Soumis avec Succès !</h2>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                Notre équipe Suguba va vérifier les spécifications et fixer le prix public et la commission revendeur sous quelques heures.
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

            {/* Photo URL */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lien de la photo / visuel du produit (URL)
              </label>
              <div className="relative">
                <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="url"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
                />
              </div>
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
