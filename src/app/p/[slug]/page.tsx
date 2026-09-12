'use client';

import React, { useState, use, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/common/Header';
import Carrousel from '@/components/product/Carrousel';
import Sheet from '@/components/ui/Sheet';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { partagerProduit, prechargerImage, useCodeRevendeur } from '@/lib/partage';
import { useToast } from '@/components/ui/Toast';
import { useSugubaStore, useCatalogueCharge } from '@/lib/store';
import { useClavierOuvert } from '@/lib/useClavierOuvert';
import { useOrderCheckout } from '@/lib/useOrderCheckout';
import OrderRecovery from '@/components/common/OrderRecovery';
import { useOrderQuote } from '@/lib/useOrderQuote';
import type { OrderInput } from '@/lib/order-input';
import Button from '@/components/ui/Button';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import {
  ShieldCheck, Truck, Clock, MapPin, Phone, Minus, Plus,
  User, CheckCircle2, ArrowRight, ArrowLeft, Star, Sparkles,
  Navigation, Tag, ChevronDown, Receipt, Bike, Store, Info,
} from 'lucide-react';

interface ChoixLivraison {
  fraisLivraisonClient: number;
  livraisonParVille: Record<string, number>;
  pointsRelais: { id: string; nom: string; frais: number; horaires: string }[];
}

/** Précision affichée pour les villes livrées en gare routière. */
const PRECISION_VILLE: Record<string, string> = {
  Sikasso: 'Gare SONEF',
  'Ségou': 'Gare BTM',
  Kayes: 'Gare SONEF',
  Mopti: 'Sévaré - Gare',
};

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const state = useSugubaStore();
  // Un revendeur connecté partage avec SON code ; sinon le lien garde celui
  // de la visite en cours.
  const monCode = useCodeRevendeur();
  const { toast } = useToast();

  const refCode = searchParams.get('ref');
  const promoParam = searchParams.get('promo');
  // Corrige BUG-009 : un slug inexistant/mal recopié retombait silencieusement
  // sur state.products[0], affichant un article différent comme s'il était
  // légitime — grave puisque le modèle repose entièrement sur des liens
  // partagés sur WhatsApp. On distingue maintenant "pas encore trouvé" (le
  // catalogue vient peut-être de se charger) de "vraiment introuvable".
  const product = state.products.find(p => p.slug === resolvedParams.slug);

  const catalogueCharge = useCatalogueCharge();
  const clavierOuvert = useClavierOuvert();

  // « Recommandé par … » : le vrai revendeur derrière le code du lien (il
  // lisait les revendeurs de démonstration et ne s'affichait donc jamais).
  const [nomRecommandeur, setNomRecommandeur] = useState<string | null>(null);
  useEffect(() => {
    if (!refCode) return;
    fetch(`/api/shop/revendeur?code=${encodeURIComponent(refCode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.nom && setNomRecommandeur(j.nom))
      .catch(() => {});
  }, [refCode]);

  // Checkout form states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'home_delivery' | 'pickup_point'>('home_delivery');
  const [pickupPointId, setPickupPointId] = useState<string>('hub-aci');
  const [city, setCity] = useState('Bamako');
  const [neighborhood, setNeighborhood] = useState('');
  const [landmark, setLandmark] = useState('');
  const [quantity, setQuantity] = useState(1);
  // L'option « acompte prioritaire » a été retirée : choisie, elle faisait
  // baisser de 3 000 F le « reste à payer au livreur » affiché, alors que
  // personne n'encaissait jamais cet acompte. Le client croyait avoir moins à
  // payer, et le livreur lui réclamait la totalité.
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const { submitOrder, isSubmitting, resetAttempt, recovery } = useOrderCheckout(`product:${resolvedParams.slug}`);
  // Fenêtre de commande (2026-09-11) : le formulaire complet (nom, téléphone,
  // livraison, code promo…) restait affiché EN PERMANENCE sur la page, sous
  // la description — beaucoup trop chargé, signalé par capture vidéo. La
  // fiche produit ne montre plus que l'essentiel ; « Commander » ouvre une
  // fenêtre dédiée (feuille en bas sur téléphone, boîte centrée sur
  // ordinateur — voir Sheet.tsx) pour les informations de livraison. La
  // quantité, elle, reste réglable directement sur la page : c'est la seule
  // chose qu'on change souvent avant même de vouloir commander.
  const [commandeOuverte, setCommandeOuverte] = useState(false);

  // Code promo : saisi ici, VÉRIFIÉ par le serveur. La liste des codes et leurs
  // montants étaient en dur dans cette page, et la remise affichée n'était
  // jamais appliquée à la commande enregistrée.
  const [promoCodeInput, setPromoCodeInput] = useState(promoParam ? promoParam.toUpperCase() : '');
  const [promoSoumis, setPromoSoumis] = useState(promoParam ? promoParam.toUpperCase() : '');
  // Replié par défaut : un champ que la plupart des commandes n'utilisent
  // jamais n'a pas à occuper de la place dans une fenêtre déjà signalée
  // "trop chargée" — sauf s'il arrive déjà rempli par un lien partagé.
  const [promoOuvert, setPromoOuvert] = useState(Boolean(promoParam));

  // Livraisons réussies de ce produit : chiffre réel, affiché seulement s'il
  // est supérieur à zéro (voir /api/products/livraisons).
  const [livraisons, setLivraisons] = useState(0);
  useEffect(() => {
    fetch(`/api/products/livraisons?slug=${encodeURIComponent(resolvedParams.slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setLivraisons(Number(j.livraisons) || 0))
      .catch(() => {});
  }, [resolvedParams.slug]);

  // Villes et points relais proposés : ceux des réglages de la plateforme.
  const [choixLivraison, setChoixLivraison] = useState<ChoixLivraison | null>(null);
  useEffect(() => {
    fetch('/api/settings/public')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setChoixLivraison(j))
      .catch(() => {});
  }, []);

  const { devis, loading: devisEnCours, error: erreurDevis } = useOrderQuote(product ? {
    productId: product.id, quantity, city, neighborhood,
    pickupPointId: fulfillmentMethod === 'pickup_point' ? pickupPointId : undefined,
    promoCode: promoSoumis || undefined, resellerCode: refCode || undefined,
  } : null);

  const finishOrder = async (data?: OrderInput) => {
    try {
      const order = await submitOrder(data);
      void fetch('/api/sms/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: order.orderNumber }),
      }).catch(() => {});
      router.push(`/order-success/${order.orderNumber}`);
      resetAttempt();
    } catch (error) {
      toast(error instanceof Error ? error.message : "La commande n'a pas pu être enregistrée.", { ton: 'erreur' });
    }
  };
  const recoveryNotice = <OrderRecovery attempt={recovery} disabled={isSubmitting}
    onResume={() => { void finishOrder(); }} />;

  // Catalogue pas encore arrivé : squelette, pas « Produit introuvable ».
  if (!product && !catalogueCharge) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full" aria-busy="true" aria-label="Chargement du produit">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
            <div className="aspect-square rounded-3xl bg-slate-200" />
            <div className="space-y-3">
              <div className="h-6 w-3/4 rounded-lg bg-slate-200" />
              <div className="h-8 w-1/3 rounded-lg bg-slate-200" />
              <div className="h-40 rounded-3xl bg-slate-200" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto text-2xl font-black">
              !
            </div>
            {recoveryNotice}
            <h1 className="text-lg font-black text-slate-900">Produit introuvable</h1>
            <p className="text-sm text-slate-500">
              Ce lien ne correspond à aucun produit disponible sur Suguba — il a peut-être expiré ou été mal recopié.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors"
            >
              Voir le catalogue Suguba
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Produit connu du téléphone mais PAS en vente (en attente de prix, refusé…).
  // Bug du 2026-09-11 : sur le téléphone de l'admin, le tableau de bord charge
  // les produits en attente dans la mémoire locale ; cette page, qui cherche
  // le produit dans cette mémoire sans regarder son statut, l'affichait à
  // « 0 F » avec le bouton de partage. Le lien partagé menait chez le
  // destinataire à « Produit introuvable ». Ni commande ni partage ici.
  if (!(product.status === 'approved' && product.publicPrice > 0)) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <Clock className="w-7 h-7" />
            </div>
            {recoveryNotice}
            <h1 className="text-lg font-black text-slate-900">Pas encore en vente</h1>
            <p className="text-sm text-slate-500">
              « {product.name} » attend son prix de vente. Tant qu&apos;il n&apos;est pas publié, il ne peut être ni commandé ni partagé.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-sm transition-colors"
            >
              Voir le catalogue
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const handleApplyPromo = () => {
    setPromoSoumis(promoCodeInput.trim().toUpperCase());
  };

  const pointsRelais = choixLivraison?.pointsRelais || [];
  const villes = choixLivraison?.livraisonParVille || { Bamako: 1500 };
  const pointRelaisChoisi = pointsRelais.find((p) => p.id === pickupPointId) || pointsRelais[0];

  // En attendant le devis, on n'affiche que le prix de l'article. Le bouton de
  // commande reste bloqué tant que le devis n'est pas arrivé : c'est lui qui
  // fait foi, pas une estimation locale.
  const unitPrice = devis?.prixUnitaire ?? (product.publicPrice || product.supplierPrice);
  const totalAmount = devis?.total ?? unitPrice * quantity;

  const fraisRelaisMin = pointsRelais.length ? Math.min(...pointsRelais.map((p) => p.frais)) : null;
  const libelleRelais = fraisRelaisMin === null
    ? 'Retrait au comptoir'
    : fraisRelaisMin === 0 ? 'Gratuit à Bamako' : `Dès ${fraisRelaisMin.toLocaleString('fr-FR')} F à Bamako`;

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone) {
      toast('Indiquez votre nom et votre numéro de téléphone.', { ton: 'erreur' });
      return;
    }

    if (fulfillmentMethod === 'home_delivery' && (!neighborhood || !landmark)) {
      toast('Indiquez votre quartier et un repère pour que le livreur vous trouve.', { ton: 'erreur' });
      return;
    }

    if (!devis) {
      toast('Le total est en cours de calcul, réessayez dans un instant.', { ton: 'info' });
      return;
    }

    const relais = fulfillmentMethod === 'pickup_point' ? pointRelaisChoisi : undefined;
    const finalNeighborhood = relais ? 'Point Relais Partenaire' : neighborhood;
    const finalLandmark = relais ? relais.nom : landmark;

    await finishOrder({
        productId: product.id,
        quantity: devis.quantite,
        customerName,
        customerPhone,
        city: relais ? 'Bamako' : city,
        neighborhood: finalNeighborhood,
        landmark: finalLandmark,
        deliveryNotes: relais ? `Retrait en Point Relais : ${relais.nom}` : deliveryNotes,
        resellerCode: refCode || undefined,
        pickupPointId: relais?.id,
        promoCode: devis.codePromo || undefined,
      });
  };

  // Corrige un défaut signalé par vidéo : ouvrir une fiche produit ne laissait
  // aucun moyen de revenir à la boutique — le Header du site n'a qu'un logo et
  // un menu, jamais de flèche retour. `history.length` distingue une vraie
  // navigation interne (bouton produit, lien partagé cliqué depuis l'app) d'un
  // lien WhatsApp ouvert directement dans un onglet neuf, où il n'y a rien
  // dans l'historique vers quoi revenir.
  const revenirEnArriere = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-32 md:pb-16">
      <Header />

      <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <button
            type="button"
            onClick={revenirEnArriere}
            className="h-11 -ml-1 pl-1 pr-3 inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 hover:text-slate-900 active:text-slate-950"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {recoveryNotice}
        {/* Referral info banner if referred */}
        {nomRecommandeur && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                {nomRecommandeur.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  Recommandé par {nomRecommandeur}
                </p>
                <p className="text-[11px] text-emerald-700">
                  Partenaire revendeur officiel Suguba
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
              Code : {refCode}
            </span>
          </div>
        )}

        {/* Product Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* Left: Product Images & Quality Guarantees */}
          <div className="space-y-4">
            {/* Galerie : toutes les photos, à balayer, avec vignettes. */}
            <div className="relative">
              <Carrousel
                images={product.images}
                alt={product.name}
                className="aspect-square rounded-3xl border border-slate-200"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
                miniatures
              />
              <div className="absolute top-3 left-3 pointer-events-none">
                <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-xs text-white text-xs font-bold">
                  {product.category}
                </span>
              </div>
              <button
                type="button"
                onClick={() => partagerProduit(
                  { nom: product.name, prix: product.publicPrice, slug: product.slug, images: product.images },
                  monCode || refCode,
                )}
                onPointerDown={() => prechargerImage(product.images[0], product.slug)}
                aria-label="Partager ce produit sur WhatsApp"
                className="absolute top-3 right-3 h-9 px-3 rounded-full bg-[#25D366] hover:bg-[#1ebe5b] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md active:scale-[0.97] transition-all"
              >
                <WhatsAppIcon className="w-4 h-4" />
                <span>Partager</span>
              </button>
            </div>

            {/* Téléphone : nom et prix juste sous la photo. Ils étaient dans la
                colonne de droite, donc SOUS la description, à ~3 écrans. */}
            <div className="md:hidden space-y-1">
              <h1 className="text-xl font-black text-slate-900 leading-tight">{product.name}</h1>
              <p className="text-2xl font-black text-suguba-brand">{unitPrice.toLocaleString('fr-FR')} FCFA</p>
            </div>

            {/* Réassurance : uniquement des engagements réels et vérifiables.
                Jusqu'au 2026-09-11, « Garantie 6 mois — Service certifié »
                s'affichait sur TOUS les produits : la base n'a aucune colonne
                garantie, ce 6 était écrit en dur dans cloud-sync.ts. */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { Icone: CheckCircle2, titre: 'Payez à la livraison', detail: 'Rien à payer avant' },
                { Icone: ShieldCheck, titre: 'Code secret', detail: 'Remis au livreur après vérification' },
                { Icone: Truck, titre: 'Livré par Suguba', detail: 'Bamako et régions' },
              ].map(({ Icone, titre, detail }) => (
                <div key={titre} className="bg-white p-3 rounded-2xl border border-slate-200 text-slate-800 space-y-1">
                  <Icone className="w-5 h-5 mx-auto text-suguba-brand" />
                  <p className="font-bold text-[11px] leading-tight">{titre}</p>
                  <p className="text-[11px] text-slate-500 leading-tight">{detail}</p>
                </div>
              ))}
            </div>

            {livraisons > 0 && (
              <p className="text-xs text-slate-700 bg-white border border-slate-200 rounded-2xl px-3 py-2.5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-suguba-brand shrink-0" />
                <span>
                  <strong>{livraisons}</strong> livraison{livraisons > 1 ? 's' : ''} réussie{livraisons > 1 ? 's' : ''} de ce produit
                </span>
              </p>
            )}

            {/* Une question avant d'acheter : un clic vers le service client,
                le produit déjà nommé dans le message. */}
            <a
              href={`https://wa.me/22389460000?text=${encodeURIComponent(
                `Bonjour Suguba, j'ai une question sur « ${product.name} » : https://app.sugubaml.com/p/${product.slug}`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-11 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-bold text-slate-800 transition-colors"
            >
              <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
              <span>Une question ? Écrivez-nous</span>
            </a>

            {/* Description */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-2">
              <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                Description du Produit
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {product.description}
              </p>
            </div>
          </div>

          {/* Boîte d'achat — compacte. Le formulaire complet (nom, téléphone,
              livraison, promo…) s'affichait ici en PERMANENCE, sous la
              description : beaucoup trop chargé (capture vidéo). Cette carte
              ne garde que ce qu'on règle AVANT de vouloir commander — le
              prix et la quantité — et ouvre la fenêtre « Sheet » pour tout
              le reste, exactement comme un panier d'e-commerce classique. */}
          <div className="md:sticky md:top-20 bg-white rounded-3xl p-5 sm:p-6 border-2 border-suguba-brand/70 shadow-xl space-y-4">
            <div className="hidden md:block space-y-1">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">{product.name}</h1>
              {/* Le prix barré affiché ici valait `unitPrice * 1.2` : un prix
                  de référence inventé en code, jamais pratiqué. Retiré le
                  2026-09-09 — afficher un prix barré fictif est une pratique
                  commerciale trompeuse. */}
              <span className="block text-2xl sm:text-3xl font-black text-suguba-brand">
                {unitPrice.toLocaleString('fr-FR')} FCFA
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Quantité</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label="Diminuer la quantité"
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-black text-lg text-slate-900 w-6 text-center" aria-live="polite">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(50, quantity + 1))}
                  aria-label="Augmenter la quantité"
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-3">
              <span className="text-slate-600">Total {quantity > 1 ? `(${quantity} articles)` : ''}</span>
              <span className="font-black text-slate-900">{totalAmount.toLocaleString('fr-FR')} FCFA</span>
            </div>

            <Button type="button" onClick={() => setCommandeOuverte(true)} size="lg" fullWidth>
              <Sparkles className="w-4 h-4" />
              <span>Commander</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <p className="text-[11px] text-slate-500 text-center">
              Sans créer de compte · Payez en espèces ou Mobile Money à la livraison
            </p>
          </div>

        </div>

        {/* Les avis clients ont été retirés le 2026-08-21 : cette section
            affichait trois témoignages entièrement inventés (noms, quartiers,
            citations) sous un label « 100% Authentifiés par OTP » et une note
            « 4.9/5 (42 avis) » tout aussi fictive, alors qu'aucun avis n'a
            jamais été collecté. Présenter de la fausse preuve sociale comme
            vérifiée à des clients qui paient réellement est trompeur.
            À réintroduire uniquement branché sur de vrais avis, collectés
            après livraison confirmée par OTP — jamais en dur. */}

      </main>

      {/* Barre d'achat fixe sur téléphone : le prix et « Commander » restent
          toujours à portée de pouce, même une fois la boîte d'achat passée
          en défilant la description (masquée pendant la saisie). */}
      {!clavierOuvert && (
        <div
          className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 px-4 pt-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500">Total ({quantity} art.)</p>
              <p className="text-lg font-black text-slate-900 whitespace-nowrap">{totalAmount.toLocaleString('fr-FR')} F</p>
            </div>
            <Button type="button" onClick={() => setCommandeOuverte(true)} fullWidth className="flex-1">
              <span>Commander</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Fenêtre de commande : feuille du bas sur téléphone, boîte centrée
          sur ordinateur (voir Sheet.tsx). Ne contient que ce qui reste à
          régler une fois la quantité choisie — livraison et coordonnées. */}
      <Sheet
        ouvert={commandeOuverte}
        onFermer={() => setCommandeOuverte(false)}
        titre="Finaliser ma commande"
        sousTitre={`${product.name} · ${quantity} × ${unitPrice.toLocaleString('fr-FR')} F`}
        pied={
          <Button type="submit" form="formulaire-commande" disabled={isSubmitting || !devis} size="lg" fullWidth>
            <span>Confirmer ({totalAmount.toLocaleString('fr-FR')} F)</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        }
      >
        <form id="formulaire-commande" onSubmit={handleOrderSubmit} className="space-y-5">

          <p className="text-[11px] text-slate-500 -mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-suguba-brand shrink-0" />
            Payez en espèces ou Mobile Money uniquement quand le livreur arrive chez vous.
          </p>

          {/* ── Section : vos coordonnées ── */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Vos coordonnées</p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nom & prénom *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="champ-nom"
                  type="text"
                  required
                  autoFocus
                  autoComplete="name"
                  placeholder="Ex: Moussa Traoré"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm font-bold text-slate-900 focus:bg-white focus:outline-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Téléphone (appel / WhatsApp) *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Ex: 70 12 34 56"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm font-bold text-slate-900 focus:bg-white focus:outline-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* ── Section : livraison ── */}
          <div className="space-y-3 pt-1 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-4">Livraison</p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFulfillmentMethod('home_delivery')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  fulfillmentMethod === 'home_delivery'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-1 font-black text-xs">
                  <Bike className="w-3.5 h-3.5" />À domicile
                </span>
                <span className={`text-[11px] block ${fulfillmentMethod === 'home_delivery' ? 'text-slate-300' : 'text-slate-500'}`}>
                  Livré devant votre porte
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFulfillmentMethod('pickup_point')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  fulfillmentMethod === 'pickup_point'
                    ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                    : 'bg-emerald-50/50 text-emerald-950 border-emerald-200 hover:bg-emerald-100/50'
                }`}
              >
                <span className="flex items-center gap-1 font-black text-xs">
                  <Store className="w-3.5 h-3.5" />Point relais
                </span>
                <span className={`text-[11px] block ${fulfillmentMethod === 'pickup_point' ? 'text-emerald-200' : 'text-emerald-700'}`}>
                  {libelleRelais}
                </span>
              </button>
            </div>

            {fulfillmentMethod === 'pickup_point' ? (
              <div className="space-y-2 bg-emerald-50/40 p-3.5 rounded-2xl border border-emerald-200">
                <label className="block text-xs font-bold text-emerald-950">
                  Point relais partenaire à Bamako
                </label>
                <select
                  value={pickupPointId}
                  onChange={(e) => setPickupPointId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-emerald-300 rounded-xl text-base sm:text-sm font-bold text-slate-900 focus:outline-emerald-600"
                >
                  {pointsRelais.map(point => (
                    <option key={point.id} value={point.id}>
                      {point.nom} — {point.frais === 0 ? 'GRATUIT' : `${point.frais} F`} ({point.horaires})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-emerald-800 flex items-start gap-1">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Votre colis sera déposé sous 24h. Vous recevrez un SMS avec votre code de retrait OTP.
                </p>
              </div>
            ) : (
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ville *</label>
                    <div className="relative">
                      <select
                        value={city}
                        onChange={(e) => { setCity(e.target.value); setNeighborhood(''); }}
                        className="w-full appearance-none px-3 py-2.5 pr-9 bg-white border border-slate-300 rounded-xl text-base sm:text-sm font-bold text-slate-900 focus:outline-emerald-600"
                      >
                        {Object.entries(villes).map(([ville, frais]) => (
                          <option key={ville} value={ville}>
                            {ville}{PRECISION_VILLE[ville] ? ` - ${PRECISION_VILLE[ville]}` : ''} ({Number(frais).toLocaleString('fr-FR')} F)
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Quartier *</label>
                    {city.trim().toLowerCase() === 'bamako' ? (
                      // Quartier reconnu (voir bamako-quartiers.ts) : le tarif
                      // de livraison se calcule alors sur la vraie distance
                      // jusqu'au quartier du fournisseur, pas un tarif plat.
                      // Même sélecteur que pour l'inscription fournisseur, la
                      // même liste de quartiers partout dans l'app.
                      <NeighborhoodPicker
                        value={neighborhood || 'Choisir…'}
                        onChange={setNeighborhood}
                      />
                    ) : (
                      <input
                        type="text"
                        required={fulfillmentMethod === 'home_delivery'}
                        placeholder="Ex: Centre-ville"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-base sm:text-sm font-bold text-slate-900 focus:outline-emerald-600"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Repère visuel précis (pharmacie, école, station...) *
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required={fulfillmentMethod === 'home_delivery'}
                      placeholder="Ex: En face de la boulangerie de l'ACI, portail blanc"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-base sm:text-sm font-bold text-slate-900 focus:outline-emerald-600"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Code promo : replié par défaut, la plupart des commandes n'en ont pas. */}
          <div className="pt-1 border-t border-slate-100">
            {!promoOuvert ? (
              <button
                type="button"
                onClick={() => setPromoOuvert(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 pt-4"
              >
                <Tag className="w-3.5 h-3.5" />
                J&apos;ai un code promo
              </button>
            ) : (
              <div className="space-y-1.5 pt-4">
                <label className="block text-xs font-bold text-slate-700">
                  Code promo / réduction partenaire
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Ex: RAMADAN, TABASKI, SUGUBAVIP"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm font-mono font-bold text-slate-900 focus:bg-white uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs transition-colors shrink-0"
                  >
                    Appliquer
                  </button>
                </div>
                {promoSoumis && devis?.avisPromo === 'invalide' && (
                  <p className="text-[11px] font-bold text-rose-600">Code promo invalide ou expiré</p>
                )}
                {devis?.codePromo && devis.remise > 0 && (
                  <p className="text-[11px] font-bold text-emerald-700 flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Code {devis.codePromo} validé : -{devis.remise.toLocaleString('fr-FR')} FCFA
                    {devis.avisPromo === 'plafonnee' ? ' (remise maximale sur cet article)' : ' de réduction !'}
                  </p>
                )}
                {devis?.codePromo && devis.remise === 0 && (
                  <p className="text-[11px] font-bold text-amber-700">
                    Code {devis.codePromo} reconnu, mais aucune remise n&apos;est possible sur cet article.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Récapitulatif — entièrement issu du devis serveur. ── */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-1.5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-1">
              <Receipt className="w-3.5 h-3.5" />Récapitulatif
            </p>
            {devis ? (
              <>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Produit ({devis.quantite}x)</span>
                  <span className="font-semibold text-white">{devis.montantArticles.toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1">
                    {devis.modeLivraison === 'relais' ? 'Retrait en point relais' : `Livraison (${devis.ville})`}
                    {devis.distanceLivraisonKm !== null && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400">
                        <Navigation className="w-3 h-3" />~{devis.distanceLivraisonKm.toFixed(1)} km
                      </span>
                    )}
                  </span>
                  <span className="font-semibold text-white">{devis.fraisLivraison === 0 ? 'Gratuit' : `${devis.fraisLivraison.toLocaleString('fr-FR')} FCFA`}</span>
                </div>
                {devis.remise > 0 && (
                  <div className="flex justify-between text-xs font-bold text-emerald-400">
                    <span>Remise ({devis.codePromo})</span>
                    <span>- {devis.remise.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black pt-2 mt-1 border-t border-white/10">
                  <span>Total à payer au livreur</span>
                  <span className="text-emerald-400">{devis.total.toLocaleString('fr-FR')} FCFA</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400">{devisEnCours ? 'Calcul du total…' : erreurDevis || 'Total indisponible pour le moment.'}</p>
            )}
          </div>
        </form>
      </Sheet>
    </div>
  );
}
