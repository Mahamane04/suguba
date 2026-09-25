'use client';


import React, { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSugubaStore, useCatalogueCharge, useQuartierClient, definirQuartierClient } from '@/lib/store';
import { useOrderCheckout } from '@/lib/useOrderCheckout';
import { useOrderQuote } from '@/lib/useOrderQuote';
import { useClavierOuvert } from '@/lib/useClavierOuvert';
import type { OrderInput } from '@/lib/order-input';
import OrderRecovery from '@/components/common/OrderRecovery';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import Button from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import ChoicePicker from '@/components/ui/ChoicePicker';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { MARGE_BAS_FLOTTANT } from '@/lib/mise-en-page';
import {
  ArrowLeft, Minus, Plus, Bike, Store, Tag, ShieldCheck, Lock, Check,
  Navigation, Clock, PackageX, Info,
} from 'lucide-react';

/**
 * Page de commande (2026-09-13) — remplace la fenêtre « Finaliser ma
 * commande » ouverte par-dessus la fiche produit : sur téléphone, une feuille
 * à faire défiler sous le pouce, avec la page encore visible derrière, restait
 * encombrée (signalé par capture). Une page dédiée, construite uniquement
 * avec les composants du design system (Card, Field, Input, Button), donne
 * toute la hauteur de l'écran à la commande et un parcours en étapes lisible.
 *
 * Même identifiant de reprise que l'ancienne fenêtre (`product:<slug>`) : une
 * tentative interrompue avant le changement se retrouve ici.
 */

interface ChoixLivraison {
  fraisLivraisonClient: number;
  livraisonParVille: Record<string, number>;
  pointsRelais: { id: string; nom: string; frais: number; horaires: string }[];
}

const PRECISION_VILLE: Record<string, string> = {
  Sikasso: 'Gare SONEF',
  'Ségou': 'Gare BTM',
  Kayes: 'Gare SONEF',
  Mopti: 'Sévaré - Gare',
};

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

function Section({
  numero,
  titre,
  complete,
  children,
}: {
  numero: number;
  titre: string;
  complete: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card padding="p-4 sm:p-5" className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span
          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 transition-colors ${
            complete ? 'bg-suguba-profond' : 'bg-slate-900'
          }`}
        >
          {complete ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : numero}
        </span>
        <h2 className="text-sm font-bold text-slate-900">{titre}</h2>
      </div>
      {children}
    </Card>
  );
}

const CARTE_CHOIX_ACTIVE = 'border-suguba-brand bg-suguba-brand/5 ring-1 ring-suguba-brand';
const CARTE_CHOIX_INACTIVE = 'border-slate-200 bg-white hover:border-slate-300';

export default function CommanderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const state = useSugubaStore();
  const catalogueCharge = useCatalogueCharge();
  const clavierOuvert = useClavierOuvert();
  const product = state.products.find((p) => p.slug === slug);

  const refCode = searchParams.get('ref');
  const promoParam = (searchParams.get('promo') || '').toUpperCase();
  const quantiteInitiale = Math.min(50, Math.max(1, parseInt(searchParams.get('q') || '1', 10) || 1));

  const [quantity, setQuantity] = useState(quantiteInitiale);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [mode, setMode] = useState<'home_delivery' | 'pickup_point'>('home_delivery');
  // Offre remise par le vendeur (2026-09-26) : pas de point relais possible.
  const remiseVendeur = Boolean(product?.modeRemise && product.modeRemise !== 'livreur');
  useEffect(() => { if (remiseVendeur) setMode('home_delivery'); }, [remiseVendeur]);
  const [pickupPointId, setPickupPointId] = useState('');
  const [city, setCity] = useState('Bamako');
  const [neighborhood, setNeighborhood] = useState('');
  // Position GPS exacte (« Utiliser ma position actuelle »), 2026-09-24 :
  // livraison calculée jusqu'à la porte et itinéraire précis pour le livreur.
  const [positionClient, setPositionClient] = useState<{ lat: number; lng: number } | null>(null);
  const [landmark, setLandmark] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [promoOuvert, setPromoOuvert] = useState(Boolean(promoParam));
  const [promoSaisi, setPromoSaisi] = useState(promoParam);
  const [promoSoumis, setPromoSoumis] = useState(promoParam);
  // Les erreurs de champ ne s'affichent qu'après une première tentative :
  // un formulaire vierge couvert de rouge décourage avant même de commencer.
  const [tentative, setTentative] = useState(false);

  const quartierClient = useQuartierClient();
  useEffect(() => {
    if (quartierClient && !neighborhood) setNeighborhood(quartierClient);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quartierClient]);

  const [choix, setChoix] = useState<ChoixLivraison | null>(null);
  useEffect(() => {
    fetch('/api/settings/public')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setChoix(j))
      .catch(() => {});
  }, []);

  const pointsRelais = choix?.pointsRelais || [];
  const villes = choix?.livraisonParVille || { Bamako: 1500 };
  const relais = pointsRelais.find((p) => p.id === pickupPointId) || pointsRelais[0];
  const estBamako = city.trim().toLowerCase() === 'bamako';

  const { submitOrder, isSubmitting, resetAttempt, recovery } = useOrderCheckout(`product:${slug}`);
  const { devis, loading: devisEnCours, error: erreurDevis } = useOrderQuote(product ? {
    productId: product.id,
    quantity,
    city,
    neighborhood,
    positionClient: mode === 'pickup_point' ? null : positionClient,
    pickupPointId: mode === 'pickup_point' ? relais?.id : undefined,
    promoCode: promoSoumis || undefined,
    resellerCode: refCode || undefined,
  } : null);

  const telephone = customerPhone.replace(/[\s().-]/g, '');
  const erreurs = {
    nom: customerName.trim().length < 2 ? 'Indiquez votre nom et prénom.' : undefined,
    tel: !/^\+?\d{8,15}$/.test(telephone) ? 'Numéro invalide : 8 chiffres minimum.' : undefined,
    quartier: mode === 'home_delivery' && !neighborhood.trim() ? 'Choisissez votre quartier.' : undefined,
    repere: mode === 'home_delivery' && !landmark.trim() ? 'Un repère aide le livreur à vous trouver.' : undefined,
  };
  const afficher = (erreur?: string) => (tentative ? erreur : undefined);
  const coordonneesOk = !erreurs.nom && !erreurs.tel;
  const livraisonOk = mode === 'pickup_point' ? Boolean(relais) : !erreurs.quartier && !erreurs.repere;

  const fraisRelaisMin = pointsRelais.length ? Math.min(...pointsRelais.map((p) => p.frais)) : null;
  const libelleRelais = fraisRelaisMin === null
    ? 'Retrait au comptoir'
    : fraisRelaisMin === 0 ? 'Gratuit à Bamako' : `Dès ${fcfa(fraisRelaisMin)}`;

  const unitPrice = devis?.prixUnitaire ?? (product?.publicPrice || 0);

  const finishOrder = async (data?: OrderInput) => {
    try {
      const order = await submitOrder(data);

      router.push(`/order-success/${order.orderNumber}`);
      resetAttempt();
    } catch (error) {
      toast(error instanceof Error ? error.message : "La commande n'a pas pu être enregistrée.", { ton: 'erreur' });
    }
  };

  const retour = () => {
    if (window.history.length > 1) router.back();
    else router.push(`/p/${slug}`);
  };

  const appliquerPromo = () => setPromoSoumis(promoSaisi.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setTentative(true);

    const premiereErreur = ([
      ['champ-nom', erreurs.nom],
      ['champ-tel', erreurs.tel],
      ['champ-quartier', erreurs.quartier],
      ['champ-repere', erreurs.repere],
    ] as const).find(([, erreur]) => erreur);
    if (premiereErreur) {
      const champ = document.getElementById(premiereErreur[0]);
      champ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      champ?.focus({ preventScroll: true });
      return;
    }

    if (!devis) {
      toast(erreurDevis || 'Le total est en cours de calcul, réessayez dans un instant.', { ton: 'info' });
      return;
    }

    if (product.stockQuantity <= 0) { toast('Article indisponible. Consultez le catalogue.', { ton: 'erreur' }); return; }
    const retrait = mode === 'pickup_point' ? relais : undefined;
    await finishOrder({
      productId: product.id,
      quantity: devis.quantite,
      customerName: customerName.trim(),
      customerPhone: telephone,
      city: retrait ? 'Bamako' : city,
      neighborhood: retrait ? 'Point Relais Partenaire' : neighborhood,
      landmark: retrait ? retrait.nom : landmark.trim(),
      deliveryNotes: retrait ? `Retrait en Point Relais : ${retrait.nom}` : deliveryNotes.trim() || undefined,
      resellerCode: refCode || undefined,
      pickupPointId: retrait?.id,
      promoCode: devis.codePromo || undefined,
      positionClient: retrait ? undefined : positionClient || undefined,
    });
  };

  const barre = (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-2 sm:px-4 h-14 flex items-center gap-1">
        <button
          type="button"
          onClick={retour}
          aria-label="Retour au produit"
          className="w-11 h-11 rounded-full hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center text-slate-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-900 leading-tight">Finaliser la commande</h1>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Rien à payer maintenant
          </p>
        </div>
      </div>
    </header>
  );

  if (!product && !catalogueCharge) {
    return (
      <div className="min-h-screen bg-slate-50">
        {barre}
        <main className="max-w-lg mx-auto p-4 space-y-4" aria-busy="true" aria-label="Chargement de la commande">
          <Skeleton className="h-28" />
          <Skeleton className="h-44" />
          <Skeleton className="h-64" />
        </main>
      </div>
    );
  }

  if (!product || !(product.status === 'approved' && product.publicPrice > 0)) {
    return (
      <div className="min-h-screen bg-slate-50">
        {barre}
        <main className="max-w-lg mx-auto p-4 space-y-4">
          {product && product.stockQuantity <= 0 && <p role="status" className="p-3 rounded-2xl bg-amber-50 text-amber-900">Article actuellement indisponible. Une commande déjà envoyée reste récupérable ci-dessous.</p>}
          <OrderRecovery attempt={recovery} disabled={isSubmitting} onResume={() => { void finishOrder(); }} />
          <EmptyState
            icone={PackageX}
            titre={product ? 'Pas encore en vente' : 'Produit introuvable'}
            texte={product
              ? 'Ce produit attend son prix de vente : il ne peut pas encore être commandé.'
              : 'Ce lien ne correspond à aucun produit disponible — il a peut-être expiré.'}
            action={<Button href="/" variant="secondary">Voir le catalogue</Button>}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {barre}

      <form
        id="formulaire-commande"
        onSubmit={handleSubmit}
        noValidate
        className="max-w-5xl mx-auto px-4 py-4 md:py-8 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_340px] gap-4 md:gap-6 items-start pb-36 md:pb-10"
      >
        <div className="space-y-4 min-w-0">
          {product && product.stockQuantity <= 0 && <p role="status" className="p-3 rounded-2xl bg-amber-50 text-amber-900">Article actuellement indisponible. Une commande déjà envoyée reste récupérable ci-dessous.</p>}
          <OrderRecovery attempt={recovery} disabled={isSubmitting} onResume={() => { void finishOrder(); }} />

          <Section numero={1} titre="Votre article" complete>
            <div className="flex gap-3">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                {product.images?.[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{product.name}</p>
                  <p className="text-sm font-bold text-suguba-brand-dark mt-0.5">{fcfa(unitPrice)}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">Quantité</span>
                  <div className="flex items-center rounded-2xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      aria-label="Diminuer la quantité"
                      className="w-10 h-10 flex items-center justify-center text-slate-700 disabled:text-slate-300"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-slate-900" aria-live="polite">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(50, product.stockQuantity, q + 1))}
                      disabled={quantity >= Math.min(50, product.stockQuantity)}
                      aria-label="Augmenter la quantité"
                      className="w-10 h-10 flex items-center justify-center text-slate-700 disabled:text-slate-300"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section numero={2} titre="Vos coordonnées" complete={coordonneesOk}>
            <Field label="Nom et prénom" htmlFor="champ-nom" requis erreur={afficher(erreurs.nom)}>
              <Input
                id="champ-nom"
                autoComplete="name"
                autoCapitalize="words"
                placeholder="Ex : Moussa Traoré"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                aria-invalid={Boolean(afficher(erreurs.nom))}
              />
            </Field>
            <Field
              label="Téléphone"
              htmlFor="champ-tel"
              requis
              aide="Le livreur vous appelle ou vous écrit sur WhatsApp avant de passer."
              erreur={afficher(erreurs.tel)}
            >
              <Input
                id="champ-tel"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Ex : 70 12 34 56"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                aria-invalid={Boolean(afficher(erreurs.tel))}
              />
            </Field>
          </Section>

          <Section numero={3} titre={remiseVendeur ? 'Remise' : 'Livraison'} complete={livraisonOk}>
            {/* Offre remise par le vendeur (2026-09-26) : ni livreur Suguba ni
                point relais. Le vendeur contacte le client après la
                confirmation de Suguba ; l'adresse lui sert pour le rendez-vous. */}
            {remiseVendeur ? (
              <div className="rounded-2xl bg-suguba-sauge p-3 text-sm text-slate-800 flex items-start gap-2.5">
                <Store className="w-5 h-5 text-suguba-profond shrink-0 mt-0.5" />
                <p>
                  {product?.modeRemise === 'retrait'
                    ? <><strong>À retirer chez le vendeur.</strong> Après la confirmation de Suguba, il vous appelle pour convenir du moment et vous indiquer l’adresse.</>
                    : <><strong>Remis par le vendeur lui-même</strong>{product?.typeOffre && product.typeOffre !== 'produit' ? ' (livraison et prestation)' : ''}. Après la confirmation de Suguba, il vous appelle pour convenir du rendez-vous.</>}
                  {' '}Vous présenterez votre reçu QR au moment de la remise.
                </p>
              </div>
            ) : (
            <div role="radiogroup" aria-label="Mode de réception" className="grid grid-cols-2 gap-2">
              {([
                { valeur: 'home_delivery', Icone: Bike, titre: 'À domicile', detail: 'Livré chez vous' },
                { valeur: 'pickup_point', Icone: Store, titre: 'Point relais', detail: libelleRelais },
              ] as const).map(({ valeur, Icone, titre, detail }) => {
                const actif = mode === valeur;
                return (
                  <button
                    key={valeur}
                    type="button"
                    role="radio"
                    aria-checked={actif}
                    onClick={() => setMode(valeur)}
                    className={`relative text-left rounded-2xl border p-3 transition-all ${actif ? CARTE_CHOIX_ACTIVE : CARTE_CHOIX_INACTIVE}`}
                  >
                    <Icone className={`w-5 h-5 ${actif ? 'text-suguba-brand-dark' : 'text-slate-400'}`} />
                    <span className="block text-sm font-bold text-slate-900 mt-1.5">{titre}</span>
                    <span className="block text-xs text-slate-500">{detail}</span>
                    {actif && (
                      <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-suguba-profond text-white flex items-center justify-center">
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            )}

            {mode === 'home_delivery' ? (
              <div className="space-y-4">
                <Field label="Ville" htmlFor="champ-ville" requis>
                  <ChoicePicker
                    id="champ-ville"
                    valeur={city}
                    onChange={(v) => { setCity(v); setNeighborhood(''); setPositionClient(null); }}
                    // Bamako en tête (livraison la plus demandée, prix au
                    // quartier) ; les autres villes : livraison en gare.
                    choix={Object.entries(villes)
                      .sort(([a], [b]) => (a.toLowerCase() === 'bamako' ? -1 : b.toLowerCase() === 'bamako' ? 1 : a.localeCompare(b, 'fr')))
                      .map(([ville, frais]) => ({
                        valeur: ville,
                        libelle: PRECISION_VILLE[ville] ? `${ville} (${PRECISION_VILLE[ville]})` : ville,
                        detail: ville.toLowerCase() === 'bamako' ? 'Selon le quartier' : fcfa(Number(frais)),
                      }))}
                  />
                </Field>

                <Field label="Quartier" htmlFor="champ-quartier" requis erreur={afficher(erreurs.quartier)}>
                  {estBamako ? (
                    <NeighborhoodPicker
                      id="champ-quartier"
                      value={neighborhood}
                      placeholder="Choisir votre quartier"
                      invalide={Boolean(afficher(erreurs.quartier))}
                      onChange={(q) => { setNeighborhood(q); definirQuartierClient(q); }}
                      onPosition={setPositionClient}
                    />
                  ) : (
                    <Input
                      id="champ-quartier"
                      placeholder="Ex : Centre-ville"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      aria-invalid={Boolean(afficher(erreurs.quartier))}
                    />
                  )}
                </Field>

                <Field
                  label="Repère pour le livreur"
                  htmlFor="champ-repere"
                  requis
                  aide="Pharmacie, école, mosquée, station… la plus proche de chez vous."
                  erreur={afficher(erreurs.repere)}
                >
                  <Input
                    id="champ-repere"
                    placeholder="Ex : en face de la pharmacie, portail bleu"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    aria-invalid={Boolean(afficher(erreurs.repere))}
                  />
                </Field>

                <Field label="Instructions (facultatif)" htmlFor="champ-notes">
                  <Textarea
                    id="champ-notes"
                    rows={2}
                    placeholder="Ex : appelez en arrivant, 2e étage"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                  />
                </Field>
              </div>
            ) : (
              <div role="radiogroup" aria-label="Point relais" className="space-y-2">
                {pointsRelais.length === 0 ? (
                  <>
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </>
                ) : (
                  pointsRelais.map((point) => {
                    const actif = relais?.id === point.id;
                    return (
                      <button
                        key={point.id}
                        type="button"
                        role="radio"
                        aria-checked={actif}
                        onClick={() => setPickupPointId(point.id)}
                        className={`w-full text-left rounded-2xl border p-3 flex items-start gap-3 transition-all ${actif ? CARTE_CHOIX_ACTIVE : CARTE_CHOIX_INACTIVE}`}
                      >
                        <span
                          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${actif ? 'border-suguba-brand' : 'border-slate-300'}`}
                        >
                          {actif && <span className="w-2.5 h-2.5 rounded-full bg-suguba-brand" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-slate-900 leading-snug">{point.nom}</span>
                          <span className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {point.horaires}
                          </span>
                        </span>
                        <span className={`text-xs font-bold whitespace-nowrap ${point.frais === 0 ? 'text-suguba-brand-dark' : 'text-slate-900'}`}>
                          {point.frais === 0 ? 'Gratuit' : fcfa(point.frais)}
                        </span>
                      </button>
                    );
                  })
                )}
                <p className="text-xs text-slate-500 flex items-start gap-1.5 pt-1">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                  Colis déposé sous 24 h. Un SMS vous donne le code de retrait.
                </p>
              </div>
            )}
          </Section>

          <Card padding="p-4 sm:p-5">
            {!promoOuvert ? (
              <button
                type="button"
                onClick={() => setPromoOuvert(true)}
                className="w-full min-h-[28px] flex items-center justify-between text-sm font-bold text-slate-700"
              >
                <span className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-slate-400" />
                  Ajouter un code promo
                </span>
                <Plus className="w-4 h-4 text-slate-400" />
              </button>
            ) : (
              <Field
                label="Code promo"
                htmlFor="champ-promo"
                erreur={promoSoumis && devis?.avisPromo === 'invalide' ? 'Code invalide ou expiré.' : undefined}
              >
                <div className="flex gap-2">
                  <Input
                    id="champ-promo"
                    autoFocus={!promoParam}
                    autoCapitalize="characters"
                    placeholder="Ex : TABASKI"
                    value={promoSaisi}
                    onChange={(e) => setPromoSaisi(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); appliquerPromo(); } }}
                    className="uppercase"
                  />
                  <Button type="button" variant="secondary" onClick={appliquerPromo} className="h-12 shrink-0">
                    Appliquer
                  </Button>
                </div>
                {devis?.codePromo && devis.remise > 0 && (
                  <p className="text-xs font-semibold text-suguba-brand-dark flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    Code {devis.codePromo} appliqué : −{fcfa(devis.remise)}
                    {devis.avisPromo === 'plafonnee' ? ' (remise maximale sur cet article)' : ''}
                  </p>
                )}
                {devis?.codePromo && devis.remise === 0 && (
                  <p className="text-xs font-semibold text-amber-700">
                    Code {devis.codePromo} reconnu, mais aucune remise n&apos;est possible sur cet article.
                  </p>
                )}
              </Field>
            )}
          </Card>
        </div>

        <aside className="md:sticky md:top-20 space-y-3">
          <Card padding="p-4 sm:p-5" className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Récapitulatif</h2>
            {devis ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">Articles ({devis.quantite})</dt>
                  <dd className="font-bold text-slate-900 whitespace-nowrap">{fcfa(devis.montantArticles)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">
                    {devis.modeLivraison === 'relais' ? 'Retrait en point relais'
                      : devis.modeLivraison === 'fournisseur' ? 'Remise par le vendeur'
                        : devis.modeLivraison === 'retrait' ? 'Retrait chez le vendeur' : 'Livraison'}
                    {devis.distanceLivraisonKm !== null && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-slate-400">
                        <Navigation className="w-3 h-3" />~{devis.distanceLivraisonKm.toFixed(1)} km
                        {devis.positionClientUtilisee ? ' depuis votre position' : ''}
                      </span>
                    )}
                  </dt>
                  <dd className="font-bold text-slate-900 whitespace-nowrap">
                    {devis.fraisLivraison === 0 ? 'Gratuit' : fcfa(devis.fraisLivraison)}
                  </dd>
                </div>
                {devis.remise > 0 && (
                  <div className="flex justify-between gap-3 text-suguba-brand-dark">
                    <dt className="font-semibold">Remise</dt>
                    <dd className="font-bold whitespace-nowrap">−{fcfa(devis.remise)}</dd>
                  </div>
                )}
                <div className="flex justify-between items-baseline gap-3 pt-3 border-t border-slate-100">
                  <dt className="font-bold text-slate-900">Total</dt>
                  <dd className="text-xl font-bold text-slate-900 whitespace-nowrap">{fcfa(devis.total)}</dd>
                </div>
              </dl>
            ) : devisEnCours || !erreurDevis ? (
              <div className="space-y-2" aria-busy="true">
                <Skeleton className="h-4" />
                <Skeleton className="h-4" />
                <Skeleton className="h-7" />
              </div>
            ) : (
              <p className="text-xs font-semibold text-rose-600">{erreurDevis}</p>
            )}
            <p className="text-xs text-slate-500">
              À payer au livreur, en espèces ou Mobile Money, après vérification du colis.
            </p>
            <Button type="submit" size="lg" fullWidth disabled={isSubmitting || product.stockQuantity <= 0} className="hidden md:inline-flex">
              {isSubmitting ? 'Envoi…' : 'Confirmer la commande'}
            </Button>
          </Card>

          <ul className="px-1 space-y-1.5 text-xs text-slate-500">
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-suguba-brand-dark shrink-0" />
              Code secret remis au livreur à la réception
            </li>
            <li className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-suguba-brand-dark shrink-0" />
              Aucun compte à créer, aucun paiement en ligne
            </li>
          </ul>
        </aside>
      </form>

      {/* Téléphone : total et confirmation toujours sous le pouce. Masquée
          pendant la saisie pour ne pas recouvrir le champ actif.
          Barre FLOTTANTE, décollée du bord (2026-09-18) : collée en bas, elle
          passait sous les coins arrondis et la barre d'accueil de l'iPhone. */}
      {!clavierOuvert && (
        <div
          className="md:hidden fixed inset-x-3 z-40 bg-white border border-slate-200 rounded-3xl shadow-float"
          style={{ bottom: MARGE_BAS_FLOTTANT }}
        >
          <div className="px-4 py-2.5 flex items-center gap-4">
            <div className="min-w-0">
              <p className="text-xs text-slate-500 leading-none">Total à la livraison</p>
              <p className="text-lg font-bold text-slate-900 whitespace-nowrap mt-1">
                {devis ? fcfa(devis.total) : '…'}
              </p>
            </div>
            <Button type="submit" form="formulaire-commande" size="lg" disabled={isSubmitting || product.stockQuantity <= 0} className="flex-1">
              {isSubmitting ? 'Envoi…' : 'Confirmer'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
