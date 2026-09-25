'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import PhotosUploader from '@/components/product/PhotosUploader';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import ChoicePicker from '@/components/ui/ChoicePicker';
import { sugubaStore } from '@/lib/store';
import { FAMILLES_CATEGORIES } from '@/lib/product-categories';
import { ETAPES, MODES_REMISE, TYPES_OFFRE, type CleEtape, type ModeRemise, type TypeOffre } from '@/lib/offre';
import {
  PackagePlus, ShieldCheck, CheckCircle2, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export default function NewSupplierProductPage() {
  const router = useRouter();
  const { toast } = useToast();
  // Fiche fournisseur RÉELLE. Elle venait du store de démonstration
  // (state.suppliers[0]) : le nom envoyé au serveur était celui du fournisseur
  // fictif. Le serveur (/api/products/sync) impose de toute façon
  // l'identifiant de la session : aucun dépôt n'a pu partir sous un autre nom.
  const [fiche, setFiche] = useState<{ companyName: string } | null>(null);
  useEffect(() => {
    fetch('/api/supplier/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.supplier) setFiche(j.supplier); })
      .catch(() => {});
  }, []);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Électroménager');
  const [description, setDescription] = useState('');
  const [supplierPrice, setSupplierPrice] = useState<number>(30000);
  const [stockQuantity, setStockQuantity] = useState<number>(20);
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
  // Vente au prix de gros (2026-09-24) : le revendeur fixe son propre prix
  // (jamais sous le minimal) et peut négocier avec son client.
  const [modePrix, setModePrix] = useState<'fixe' | 'gros'>('fixe');
  // Offre (2026-09-26) : nature et qui la remet au client.
  const [typeOffre, setTypeOffre] = useState<TypeOffre>('produit');
  const [modeRemise, setModeRemise] = useState<ModeRemise>('livreur');
  const [fraisRemise, setFraisRemise] = useState<number>(0);
  const [offreInclus, setOffreInclus] = useState('');
  const [modeCommande, setModeCommande] = useState<'achat' | 'devis'>('achat');
  const [etapes, setEtapes] = useState<CleEtape[]>([]);
  const [prixConseille, setPrixConseille] = useState<number>(0);
  const [apercuGros, setApercuGros] = useState<{
    prixMinimal: number; prixConseille: number; conseilFournisseurRetenu: boolean;
    gainRevendeurAuConseil: number; modeGain?: string; taux?: number; montantFixe?: number;
  } | null>(null);
  const [apercu, setApercu] = useState<{
    prixVente: number; commission: number; partChoisieUtilisee: boolean; mode: string;
    releveAuPlancher?: boolean; commissionFaible?: boolean; commissionMinimale: number;
    commissionBrute?: number; prelevementSuguba?: number; tauxPrelevement?: number; partSuguba?: number;
  } | null>(null);
  useEffect(() => {
    if (!(supplierPrice > 0)) { setApercu(null); setApercuGros(null); return; }
    const controle = new AbortController();
    const minuteur = setTimeout(() => {
      const url = modePrix === 'gros'
        ? `/api/products/apercu-prix?prixFournisseur=${supplierPrice}&modePrix=gros&prixConseille=${prixConseille || 0}`
        : `/api/products/apercu-prix?prixFournisseur=${supplierPrice}&partRevendeur=${partRevendeur || 0}`;
      fetch(url, { signal: controle.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (modePrix === 'gros') setApercuGros(j && j.mode === 'gros' ? j : null);
          else setApercu(j && typeof j.prixVente === 'number' ? j : null);
        })
        .catch(() => {});
    }, 350);
    return () => { clearTimeout(minuteur); controle.abort(); };
  }, [supplierPrice, partRevendeur, modePrix, prixConseille]);
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
      // Remplacé côté serveur par le fournisseur de la session.
      supplierId: '',
      supplierName: fiche?.companyName || '',
      name,
      category,
      description,
      images,
      supplierPrice: Number(supplierPrice),
      resellerCommissionProposee: modePrix === 'gros' ? 0 : Number(partRevendeur) || 0,
      modePrix,
      prixConseille: modePrix === 'gros' ? Number(prixConseille) || null : null,
      stockQuantity: Number(stockQuantity),
      typeOffre,
      modeRemise,
      fraisRemise: modeRemise === 'fournisseur' ? Number(fraisRemise) || 0 : 0,
      offreInclus: offreInclus.trim() || null,
      modeCommande,
      etapes: modeRemise !== 'livreur' ? etapes : [],
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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Ajouter une offre
          </h1>
          <p className="text-xs text-slate-500">
            Un produit, un service ou les deux. Avec au moins une photo, votre offre est mise en vente tout de suite, au prix calculé par Suguba.
          </p>
        </div>

        {/* Workflow reminder card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-900 space-y-1">
          <p className="font-bold flex items-center">
            <ShieldCheck className="w-4 h-4 mr-1.5 text-suguba-brand-dark" />
            Comment ça marche :
          </p>
          <p className="text-xs text-slate-600">
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
              <h2 className="text-xl font-bold text-slate-900">
                {publication?.publie ? 'Produit en vente !' : 'Produit enregistré'}
              </h2>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                {publication?.publie
                  ? `Il est visible dans le catalogue au prix de ${(publication.prix ?? 0).toLocaleString('fr-FR')} F. Vous toucherez votre prix fournisseur sur chaque vente livrée.`
                  : `Pas encore en vente : ${publication?.raison || 'Suguba doit fixer son prix.'}`}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={() => router.push('/supplier')} variant="secondary">
                Retourner à mon catalogue
              </Button>
              {/* Enchaîner les dépôts sans repasser par le tableau de bord. */}
              <Button onClick={() => { setIsSuccess(false); setPublication(null); setName(''); setDescription(''); setImages([]); }} variant="ghost">
                Ajouter un autre produit
              </Button>
            </div>
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
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm font-medium text-slate-900 focus:bg-white focus:outline-emerald-600"
              />
            </div>

            {/* Catégorie */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catégorie *
              </label>
              <ChoicePicker
                valeur={category}
                onChange={setCategory}
                ariaLabel="Catégorie"
                choix={FAMILLES_CATEGORIES.flatMap(({ famille, categories }) =>
                  categories.map((c) => ({ valeur: c, libelle: c, groupe: famille })),
                )}
              />
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
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm font-medium text-slate-900 focus:bg-white focus:outline-emerald-600"
              />
            </div>

            {/* Photos du produit — plusieurs, envoyées au stockage Suguba */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Photos du produit
              </label>
              <PhotosUploader value={images} onChange={setImages} onUploadingChange={setIsUploadingImage} />
            </div>

            {/* Votre offre (2026-09-26) : nature et qui la remet au client.
                Les deux choix sont indépendants (kit solaire installé par vous,
                téléphone livré par Suguba…). */}
            <fieldset className="rounded-2xl border border-slate-200 p-4 space-y-4">
              <legend className="px-1 text-xs font-bold text-slate-700">Votre offre</legend>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">Que proposez-vous ?</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Nature de l’offre">
                  {TYPES_OFFRE.map((t) => {
                    const actif = typeOffre === t.valeur;
                    return (
                      <button key={t.valeur} type="button" role="radio" aria-checked={actif} onClick={() => setTypeOffre(t.valeur)}
                        className={`text-left p-3 rounded-2xl border ${actif ? 'border-suguba-profond bg-suguba-menthe ring-1 ring-suguba-profond' : 'border-slate-200 bg-white'}`}>
                        <span className="block text-sm font-semibold text-slate-900">{t.libelle}</span>
                        <span className="block text-xs text-slate-600 mt-0.5">{t.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">Qui la remet au client ?</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Qui remet l’offre">
                  {MODES_REMISE.map((m) => {
                    const actif = modeRemise === m.valeur;
                    return (
                      <button key={m.valeur} type="button" role="radio" aria-checked={actif} onClick={() => setModeRemise(m.valeur)}
                        className={`text-left p-3 rounded-2xl border ${actif ? 'border-suguba-profond bg-suguba-menthe ring-1 ring-suguba-profond' : 'border-slate-200 bg-white'}`}>
                        <span className="block text-sm font-semibold text-slate-900">{m.libelle}</span>
                        <span className="block text-xs text-slate-600 mt-0.5">{m.detail}</span>
                      </button>
                    );
                  })}
                </div>
                {modeRemise !== 'livreur' && (
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5">
                    Aucun livreur Suguba ne sera envoyé. Après la confirmation de Suguba, vous organisez la remise avec le client,
                    puis vous scannez son reçu QR. Si le client paie en espèces, vous remettez l’argent à la caisse Suguba ;
                    vous touchez votre prix comme pour toute vente.
                  </p>
                )}
              </div>
              {modeRemise !== 'livreur' && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700">Étapes de la prestation (facultatif)</p>
                  <p className="text-xs text-slate-600">
                    Cochez les étapes de votre intervention. Vous déclarez chacune avec une preuve (photo, date…),
                    le client la valide depuis son reçu. La réception finale se fait en scannant son reçu, une fois tout validé.
                    Ne cochez rien pour une remise en une seule fois.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ETAPES.map((e) => {
                      const coche = etapes.includes(e.cle);
                      return (
                        <label key={e.cle} className={`flex items-start gap-2.5 p-3 rounded-2xl border cursor-pointer ${coche ? 'border-suguba-profond bg-suguba-menthe' : 'border-slate-200 bg-white'}`}>
                          <input type="checkbox" checked={coche} className="mt-0.5 w-4 h-4 accent-suguba-profond"
                            onChange={() => setEtapes((l) => (coche ? l.filter((k) => k !== e.cle) : ETAPES.map((x) => x.cle).filter((k) => k === e.cle || l.includes(k))))} />
                          <span>
                            <span className="block text-sm font-semibold text-slate-900">{e.libelle}</span>
                            <span className="block text-xs text-slate-600">{e.detail}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">Comment le client commande ?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Comment le client commande">
                  {([
                    ['achat', 'Il achète directement', 'Prix fixe, commande en un clic'],
                    ['devis', 'Il demande un devis', 'Vous répondez avec un prix adapté à son besoin'],
                  ] as const).map(([valeur, libelle, detail]) => {
                    const actif = modeCommande === valeur;
                    return (
                      <button key={valeur} type="button" role="radio" aria-checked={actif} onClick={() => setModeCommande(valeur)}
                        className={`text-left p-3 rounded-2xl border ${actif ? 'border-suguba-profond bg-suguba-menthe ring-1 ring-suguba-profond' : 'border-slate-200 bg-white'}`}>
                        <span className="block text-sm font-semibold text-slate-900">{libelle}</span>
                        <span className="block text-xs text-slate-600 mt-0.5">{detail}</span>
                      </button>
                    );
                  })}
                </div>
                {modeCommande === 'devis' && (
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5">
                    Le prix ci-dessous sert de prix « à partir de ». Les demandes arrivent dans « Demandes de devis » :
                    vous répondez avec votre prix, le client accepte ou refuse.
                  </p>
                )}
              </div>
              {modeRemise === 'fournisseur' && (
                <div>
                  <label htmlFor="frais-remise" className="block text-xs font-bold text-slate-700 mb-1">Frais de déplacement ou de remise (FCFA)</label>
                  <input id="frais-remise" type="number" min={0} step={500} value={fraisRemise}
                    onChange={(e) => setFraisRemise(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm font-bold text-slate-900 focus:bg-white" />
                  <span className="text-xs text-slate-500 mt-1 block">Payés par le client en plus du prix, à la place de la livraison Suguba. Mettez 0 si c’est inclus.</span>
                </div>
              )}
              {(typeOffre !== 'produit' || modeRemise !== 'livreur') && (
                <div>
                  <label htmlFor="offre-inclus" className="block text-xs font-bold text-slate-700 mb-1">Ce qui est inclus (facultatif)</label>
                  <textarea id="offre-inclus" rows={3} maxLength={1000} value={offreInclus} onChange={(e) => setOffreInclus(e.target.value)}
                    placeholder="Ex : panneau 300 W, batterie, câblage, installation et mise en service. Zone : Bamako. Hors travaux de maçonnerie."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm text-slate-900 focus:bg-white" />
                  <span className="text-xs text-slate-500 mt-1 block">Dites clairement ce qui est compris et ce qui ne l’est pas : un supplément ne peut pas être ajouté après coup.</span>
                </div>
              )}
            </fieldset>

            {/* Comment le revendeur vend cet article (2026-09-24) */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700">Comment les revendeurs vendent cet article ?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Mode de prix">
                {([
                  ['fixe', 'Prix fixe + part revendeur', 'Vous fixez votre prix et ce que vous laissez au revendeur. Le prix client est calculé.'],
                  ['gros', 'Prix de gros', 'Vous donnez votre prix de gros. Le revendeur vend au prix qu’il veut et peut négocier avec son client.'],
                ] as const).map(([valeur, titre, detail]) => {
                  const actif = modePrix === valeur;
                  return (
                    <button key={valeur} type="button" role="radio" aria-checked={actif} onClick={() => setModePrix(valeur)}
                      className={`text-left p-3 rounded-2xl border ${actif ? 'border-suguba-profond bg-suguba-menthe ring-1 ring-suguba-profond' : 'border-slate-200 bg-white'}`}>
                      <span className="block text-sm font-semibold text-slate-900">{titre}</span>
                      <span className="block text-xs text-slate-600 mt-0.5">{detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prix Fournisseur & Stock */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {modePrix === 'gros' ? 'Prix de gros (FCFA) *' : 'Prix Fournisseur Plancher Garanti (FCFA) *'}
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  step={500}
                  placeholder="Ex: 30000"
                  value={supplierPrice}
                  onChange={(e) => setSupplierPrice(parseInt(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm font-bold text-slate-900 focus:bg-white"
                />
                <span className="text-xs text-slate-500 mt-1 block">
                  Montant exact que vous toucherez sur chaque vente livrée.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {typeOffre === 'service' ? 'Nombre de prestations possibles *' : 'Quantité en Stock Réel *'}
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="Ex: 25"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm font-bold text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            {/* Prix de gros : prix conseillé facultatif + bornes calculées par le serveur */}
            {modePrix === 'gros' && (
              <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Prix conseillé au client (facultatif)
                  </label>
                  <input
                    type="number" min={0} step={500} placeholder="Ex : 35000"
                    value={prixConseille || ''}
                    onChange={(e) => setPrixConseille(parseInt(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm font-bold text-slate-900 focus:bg-white"
                  />
                  <span className="text-xs text-slate-500 mt-1 block">
                    Affiché aux clients qui achètent sans revendeur, et proposé aux revendeurs. Sans prix, Suguba en calcule un.
                  </span>
                </div>
                {apercuGros && (
                  <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-0.5">Sur chaque vente</p>
                    <div className="flex justify-between"><span className="text-slate-600">Vous touchez toujours</span><strong className="text-slate-900">{fmt(supplierPrice)}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-600">Prix minimal de revente</span><strong className="text-slate-900">{fmt(apercuGros.prixMinimal)}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-600">Prix conseillé</span><strong className="text-slate-900 text-sm">{fmt(apercuGros.prixConseille)}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-600">Le revendeur gagne (au prix conseillé)</span><strong className="text-suguba-brand-dark">{fmt(apercuGros.gainRevendeurAuConseil)}</strong></div>
                    {prixConseille > 0 && !apercuGros.conseilFournisseurRetenu && (
                      <p className="text-xs text-amber-700 pt-1">Votre prix conseillé ne couvre pas la livraison et les frais : il a été relevé.</p>
                    )}
                    <p className="text-xs text-slate-500 pt-1">
                      Le revendeur peut vendre plus cher (il gagne plus), jamais moins que le prix minimal. Vous touchez votre prix de gros dans tous les cas.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Part revendeur fixée par le fournisseur + aperçu du prix client */}
            <div className={`rounded-2xl border border-slate-200 p-4 space-y-3 ${modePrix === 'gros' ? 'hidden' : ''}`}>
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm font-bold text-slate-900 focus:bg-white"
                />
                <span className="text-xs text-slate-500 mt-1 block">
                  C’est vous qui décidez : ce que vous laissez au revendeur qui vend votre produit, en plus de votre prix.
                  Plus elle est élevée, plus les revendeurs le partageront.
                </span>
              </div>

              {/* Détail du partage (2026-09-23) : qui touche quoi sur chaque vente. */}
              {apercu && (
                <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-0.5">Sur chaque vente</p>
                  <div className="flex justify-between"><span className="text-slate-600">Le client paie</span><strong className="text-slate-900 text-sm">{fmt(apercu.prixVente)}</strong></div>
                  <div className="flex justify-between"><span className="text-slate-600">Vous touchez</span><strong className="text-slate-900">{fmt(supplierPrice)}</strong></div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Le revendeur reçoit</span>
                    <strong className="text-suguba-brand-dark">{fmt(apercu.commission)}</strong>
                  </div>
                  {(apercu.prelevementSuguba ?? 0) > 0 && (
                    <p className="text-xs text-slate-500 -mt-1 text-right">
                      soit votre part de {fmt(apercu.commissionBrute ?? 0)} moins {apercu.tauxPrelevement} % pour Suguba ({fmt(apercu.prelevementSuguba ?? 0)})
                    </p>
                  )}
                  {typeof apercu.partSuguba === 'number' && (
                    <div className="flex justify-between gap-3 border-t border-slate-200 pt-1.5">
                      <span className="text-slate-600">Suguba (livraison, paiement, service)</span>
                      <strong className="text-slate-900 whitespace-nowrap">{fmt(apercu.partSuguba)}</strong>
                    </div>
                  )}
                  {!apercu.partChoisieUtilisee && (
                    <p className="text-xs text-slate-500 pt-1">
                      {apercu.mode === 'auto' ? 'La part du revendeur est actuellement calculée par Suguba.' : 'Sans part indiquée, Suguba la calcule.'}
                    </p>
                  )}
                  {apercu.releveAuPlancher && (
                    <p className="text-xs text-amber-700 pt-1">Prix ajusté pour couvrir la livraison et les frais de service.</p>
                  )}
                  {apercu.commissionFaible && (
                    <p className="text-xs text-amber-700 pt-1">
                      Part inférieure à {fmt(apercu.commissionMinimale)} : le produit sera en vente, mais pas proposé au partage des revendeurs.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Garantie, délai de préparation et adresse de stock retirés le
                2026-09-11 : le fournisseur les remplissait, mais aucune
                colonne ne les enregistrait nulle part (voir
                /api/products/sync) — 3 champs qui ne servaient à rien. À
                réintroduire seulement avec de vraies colonnes en base et un
                affichage réel côté client. */}

            {/* Submit button */}
            {/* « Soumettre pour modération » : faux depuis la publication
                automatique (2026-09-11). Le bouton dit ce qui se passe. */}
            <Button type="submit" disabled={isSubmitting} size="lg" fullWidth>
              <PackagePlus className="w-4 h-4" />
              <span>{isSubmitting ? 'Envoi…' : images.length > 0 ? 'Mettre en vente' : 'Enregistrer (photo à ajouter)'}</span>
            </Button>

          </form>
        )}

      </main>

      <BottomNav />
    </div>
  );
}
