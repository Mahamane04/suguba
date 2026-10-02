'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import PhotosUploader from '@/components/product/PhotosUploader';
import { FAMILLES_CATEGORIES } from '@/lib/product-categories';
import ChoicePicker from '@/components/ui/ChoicePicker';
import {
  PackagePlus, ShieldCheck, CheckCircle2, ArrowLeft, AlertTriangle
} from 'lucide-react';
import { formatF } from '@/lib/montant';
import { MontantInput } from '@/components/ui/Field';
import Button from '@/components/ui/Button';

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
  const [supplierId,setSupplierId] = useState('');
  const [fournisseurs,setFournisseurs] = useState<{profile_id:string;company_name:string}[]>([]);
  const [erreurFournisseurs,setErreurFournisseurs] = useState('');
  useEffect(()=>{fetch('/api/admin/products/suppliers').then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);setFournisseurs(j.fournisseurs);}).catch(()=>setErreurFournisseurs('Liste des fournisseurs indisponible. Rechargez avant de rattacher un produit.'));},[]);
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
      supplierId: supplierId || null,
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
    setName(''); setDescription(''); setSupplierName('');setSupplierId('');
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
          href="/admin/products"
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Produits</span>
        </Link>

        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
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
              <h2 className="text-xl font-bold text-slate-900">
                {publieOk ? 'Produit publié !' : 'Produit enregistré, pas encore publié'}
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                {publieOk
                  ? `Il est visible dans le catalogue et partageable. Commission revendeur calculée : ${formatF((commissionCalculee ?? 0))}.`
                  : submitError}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button type="button" onClick={() => router.push('/admin/products')}>Voir les produits</Button>
              <Button type="button" variant="ghost" onClick={resetForm}>Ajouter un autre produit</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">

            <div>
              <label htmlFor="champ-Nom-du-produit-" className="block text-xs font-bold text-slate-700 mb-1">Nom du produit *</label>
              <input id="champ-Nom-du-produit-"
                type="text"
                required
                placeholder="Ex: Ventilateur Rechargeable 16 pouces"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-medium text-slate-900 focus:bg-white focus:outline-slate-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catégorie *</label>
                <ChoicePicker
                  valeur={category}
                  onChange={setCategory}
                  ariaLabel="Catégorie"
                  choix={FAMILLES_CATEGORIES.flatMap(({ famille, categories }) =>
                    categories.map((c) => ({ valeur: c, libelle: c, groupe: famille })),
                  )}
                />
              </div>

              <div>
                <label htmlFor="fournisseur" className="block text-sm font-bold text-slate-700 mb-1">Propriétaire du stock</label>
                <ChoicePicker id="fournisseur" ariaLabel="Propriétaire du stock" valeur={supplierId} onChange={v=>{setSupplierId(v);setSupplierName(fournisseurs.find(f=>f.profile_id===v)?.company_name || 'Suguba');}} choix={[{valeur:'',libelle:'Stock Suguba'},...fournisseurs.map(f=>({valeur:f.profile_id,libelle:f.company_name}))]}/>{erreurFournisseurs && <p role="alert" className="text-rose-800 text-sm">{erreurFournisseurs}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="champ-Description-" className="block text-xs font-bold text-slate-700 mb-1">Description *</label>
              <textarea id="champ-Description-"
                rows={3}
                required
                placeholder="Caractéristiques, garantie, contenu de la boîte..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-medium text-slate-900 focus:bg-white focus:outline-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Photos du produit</label>
              <PhotosUploader key={uploaderKey} value={images} onChange={setImages} onUploadingChange={setIsUploadingImage} />
            </div>

            {/* Économie du produit */}
            <div className="pt-2 border-t border-slate-100 space-y-4">
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-slate-700" />
                Économie du produit
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="champ-Prix-fournisseur-FCFA-" className="block text-xs font-bold text-slate-700 mb-1">Prix fournisseur *</label>
              <MontantInput id="champ-Prix-fournisseur-FCFA-"
                    min={0}
                    step={500}
                    value={supplierPrice}
                    onChange={(e) => setSupplierPrice(parseInt(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <label htmlFor="champ-Prix-public-FCFA-" className="block text-xs font-bold text-slate-700 mb-1">Prix public *</label>
              <MontantInput id="champ-Prix-public-FCFA-"
                    required
                    min={0}
                    step={500}
                    value={publicPrice}
                    onChange={(e) => setPublicPrice(parseInt(e.target.value) || 0)}
                  />
                </div>

              </div>

              <p className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  La commission revendeur est calculée automatiquement à partir des réglages économiques.
                  Un prix trop bas pour couvrir les coûts est refusé, avec le prix minimal indiqué.
                </span>
              </p>

              <div>
                <label htmlFor="champ-Quantit-en-stock-" className="block text-xs font-bold text-slate-700 mb-1">Quantité en stock *</label>
              <input id="champ-Quantit-en-stock-"
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

            {/* ADM-08 (audit UI/UX du 2026-10-02) : bouton commun, au lieu d'un gris
                ardoise hors charte sur le geste qui publie un produit. */}
            <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
              <PackagePlus className="w-4 h-4" />
              Publier le produit
            </Button>

          </form>
        )}

      </main>

      <BottomNav />
    </div>
  );
}
