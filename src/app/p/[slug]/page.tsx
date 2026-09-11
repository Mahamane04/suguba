'use client';

import React, { useState, use, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/common/Header';
import Carrousel from '@/components/product/Carrousel';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { partagerProduit, prechargerImage, useCodeRevendeur } from '@/lib/partage';
import { useSugubaStore } from '@/lib/store';
import { useOrderCheckout } from '@/lib/useOrderCheckout';
import OrderRecovery from '@/components/common/OrderRecovery';
import { useOrderQuote } from '@/lib/useOrderQuote';
import type { OrderInput } from '@/lib/order-input';
import Button from '@/components/ui/Button';
import { 
  ShieldCheck, Truck, Clock, MapPin, Phone, 
  User, CheckCircle2, ArrowRight, ArrowLeft, Star, Sparkles
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

  const refCode = searchParams.get('ref');
  const promoParam = searchParams.get('promo');
  // Corrige BUG-009 : un slug inexistant/mal recopié retombait silencieusement
  // sur state.products[0], affichant un article différent comme s'il était
  // légitime — grave puisque le modèle repose entièrement sur des liens
  // partagés sur WhatsApp. On distingue maintenant "pas encore trouvé" (le
  // catalogue vient peut-être de se charger) de "vraiment introuvable".
  const product = state.products.find(p => p.slug === resolvedParams.slug);

  const reseller = refCode ? state.resellers.find(r => r.referralCode.toUpperCase() === refCode.toUpperCase()) : null;
  const resellerUser = reseller ? state.users.find(u => u.id === reseller.userId) : null;

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

  // Code promo : saisi ici, VÉRIFIÉ par le serveur. La liste des codes et leurs
  // montants étaient en dur dans cette page, et la remise affichée n'était
  // jamais appliquée à la commande enregistrée.
  const [promoCodeInput, setPromoCodeInput] = useState(promoParam ? promoParam.toUpperCase() : '');
  const [promoSoumis, setPromoSoumis] = useState(promoParam ? promoParam.toUpperCase() : '');

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
    productId: product.id, quantity, city,
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
      alert(error instanceof Error ? error.message : 'Erreur lors de la validation');
    }
  };
  const recoveryNotice = <OrderRecovery attempt={recovery} disabled={isSubmitting}
    onResume={() => { void finishOrder(); }} />;

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
            <p className="text-xs text-slate-400">
              Administrateur : fixez son prix depuis « Modération » sur le tableau de bord.
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

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone) {
      alert('Veuillez renseigner votre nom et votre numéro de téléphone.');
      return;
    }

    if (fulfillmentMethod === 'home_delivery' && (!neighborhood || !landmark)) {
      alert('Veuillez renseigner votre quartier et votre repère visuel pour la livraison à domicile.');
      return;
    }

    if (!devis) {
      alert('Le total est en cours de calcul, réessayez dans un instant.');
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-16">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {recoveryNotice}
        {/* Referral info banner if referred */}
        {resellerUser && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                {resellerUser.fullName.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  Offre recommandée par {resellerUser.fullName}
                </p>
                <p className="text-[10px] text-emerald-700">
                  Partenaire revendeur officiel Suguba
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
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

          {/* Right: 1-Click Order Form (Zero Friction) */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border-2 border-emerald-500/80 shadow-xl space-y-5">
            
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                {product.name}
              </h1>
              
              {/* Le prix barré affiché ici valait `unitPrice * 1.2` : un prix
                  de référence inventé en code, jamais pratiqué. Retiré le
                  2026-09-09 — même famille que les faux avis et le « N°1 au
                  Mali » déjà supprimés, mais plus grave : afficher un prix
                  barré fictif est une pratique commerciale trompeuse. */}
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-2xl sm:text-3xl font-black text-suguba-brand">
                  {unitPrice.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>

            <form onSubmit={handleOrderSubmit} className="space-y-4 pt-2 border-t border-slate-100">
              
              <div className="space-y-1">
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  Commander en 1 minute (Sans créer de compte)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Payez en espèces ou Mobile Money uniquement quand le livreur arrive chez vous.
                </p>
              </div>

              {/* Quantité */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quantité</label>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-slate-800 text-sm flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="font-black text-base text-slate-900 w-8 text-center">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(50, quantity + 1))}
                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-slate-800 text-sm flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Nom */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Votre Nom & Prénom *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Moussa Traoré"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-emerald-600"
                  />
                </div>
              </div>

              {/* Téléphone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Numéro de Téléphone (Appel / WhatsApp) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    placeholder="Ex: 70 12 34 56"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-emerald-600"
                  />
                </div>
              </div>

              {/* Choix du mode de livraison */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold text-slate-700">
                  Mode de Réception du Colis :
                </label>
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
                    <span className="block font-black text-xs">🛵 À Domicile</span>
                    <span className={`text-[10px] block ${fulfillmentMethod === 'home_delivery' ? 'text-slate-300' : 'text-slate-500'}`}>
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
                    <span className="block font-black text-xs">🏪 Point Relais</span>
                    <span className={`text-[10px] block ${fulfillmentMethod === 'pickup_point' ? 'text-emerald-200' : 'text-emerald-700'}`}>
                      Gratuit ou 500 F à Bamako
                    </span>
                  </button>
                </div>
              </div>

              {/* Si Point Relais Partenaire sélectionné */}
              {fulfillmentMethod === 'pickup_point' ? (
                <div className="space-y-2 bg-emerald-50/40 p-3.5 rounded-2xl border border-emerald-200">
                  <label className="block text-xs font-bold text-emerald-950">
                    Sélectionner le Point Relais Partenaire à Bamako :
                  </label>
                  <select
                    value={pickupPointId}
                    onChange={(e) => setPickupPointId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-emerald-600"
                  >
                    {pointsRelais.map(point => (
                      <option key={point.id} value={point.id}>
                        {point.nom} — {point.frais === 0 ? 'GRATUIT' : `${point.frais} F`} ({point.horaires})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-emerald-800">
                    💡 Votre colis sera déposé sous 24h. Vous recevrez un SMS avec votre code de retrait OTP.
                  </p>
                </div>
              ) : (
                <>
                  {/* Ville & Quartier pour Livraison à Domicile */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Ville *</label>
                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                      >
                        {Object.entries(villes).map(([ville, frais]) => (
                          <option key={ville} value={ville}>
                            {ville}{PRECISION_VILLE[ville] ? ` - ${PRECISION_VILLE[ville]}` : ''} ({Number(frais).toLocaleString('fr-FR')} F)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Quartier *</label>
                      <input
                        type="text"
                        required={fulfillmentMethod === 'home_delivery'}
                        placeholder="Ex: Hamdallaye ACI"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                      />
                    </div>
                  </div>

                  {/* Repère visuel (Indispensable) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Repère Visuel Précis (Pharmacie, École, Station...) *
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required={fulfillmentMethod === 'home_delivery'}
                        placeholder="Ex: En face de la boulangerie de l'ACI, portail blanc"
                        value={landmark}
                        onChange={(e) => setLandmark(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Champ Code Promo */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-bold text-slate-700">
                  Code Promo / Réduction Partenaire :
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Ex: RAMADAN, TABASKI, SUGUBAVIP"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs transition-colors"
                  >
                    Appliquer
                  </button>
                </div>
                {promoSoumis && devis?.avisPromo === 'invalide' && (
                  <p className="text-[10px] font-bold text-rose-600">Code promo invalide ou expiré</p>
                )}
                {devis?.codePromo && devis.remise > 0 && (
                  <p className="text-[10px] font-bold text-emerald-700 flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Code {devis.codePromo} validé : -{devis.remise.toLocaleString('fr-FR')} FCFA
                    {devis.avisPromo === 'plafonnee' ? ' (remise maximale sur cet article)' : ' de réduction !'}
                  </p>
                )}
                {devis?.codePromo && devis.remise === 0 && (
                  <p className="text-[10px] font-bold text-amber-700">
                    Code {devis.codePromo} reconnu, mais aucune remise n&apos;est possible sur cet article.
                  </p>
                )}
              </div>

              {/* Récapitulatif — entièrement issu du devis serveur. */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                {devis ? (
                  <>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Produit ({devis.quantite}x) :</span>
                      <span className="font-semibold">{devis.montantArticles.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{devis.modeLivraison === 'relais' ? 'Retrait en point relais' : `Livraison (${devis.ville})`} :</span>
                      <span className="font-semibold">{devis.fraisLivraison === 0 ? 'Gratuit' : `${devis.fraisLivraison.toLocaleString('fr-FR')} FCFA`}</span>
                    </div>
                    {devis.remise > 0 && (
                      <div className="flex justify-between text-xs font-bold text-emerald-700 bg-emerald-100/50 p-1.5 rounded-lg">
                        <span>Remise ({devis.codePromo}) :</span>
                        <span>- {devis.remise.toLocaleString('fr-FR')} FCFA</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200">
                      <span>Total à payer au livreur :</span>
                      <span className="text-emerald-700">{devis.total.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">{devisEnCours ? 'Calcul du total…' : erreurDevis || 'Total indisponible pour le moment.'}</p>
                )}
              </div>

              {/* Submit CTA — l'action principale de toute l'application.
                  Elle était en `emerald-600`, pas au vert de marque : le
                  bouton le plus important du parcours n'était pas à la
                  couleur de Suguba. */}
              <Button type="submit" disabled={isSubmitting || !devis} size="lg" fullWidth>
                <span>Confirmer Ma Commande ({totalAmount.toLocaleString('fr-FR')} F)</span>
                <ArrowRight className="w-4 h-4" />
              </Button>

            </form>

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
    </div>
  );
}
