'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSugubaStore, useCatalogueCharge, useQuartierClient, definirQuartierClient } from '@/lib/store';
import { useOrderCheckout } from '@/lib/useOrderCheckout';
import { useOrderQuote } from '@/lib/useOrderQuote';
import type { OrderInput } from '@/lib/order-input';
import OrderRecovery from '@/components/common/OrderRecovery';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { normaliserCodeRevendeur, revendeurAncre } from '@/lib/ancrage-revendeur';
import { Minus, Plus, Navigation, PackageX } from 'lucide-react';
import {
  BarreCommande, CodePromoCommande, CoordonneesCommande, EnteteCommande, GarantiesCommande,
  LivraisonCommande, SectionCommande, TEXTE_PAIEMENT, type ReglagesLivraison,
} from '@/components/commande/FormulaireCommande';
import { avisCodePromo, erreursCommande, premierChampEnErreur, telephoneNormalise, type ModeReception } from '@/lib/formulaire-commande';
import { formatF } from '@/lib/montant';

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

const fcfa = formatF;

export default function CommanderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const state = useSugubaStore();
  const catalogueCharge = useCatalogueCharge();
  const product = state.products.find((p) => p.slug === slug);

  // Code de l'adresse, sinon revendeur d'origine gardé sur l'appareil (lot B) :
  // passer par l'accueil ou la boutique du fournisseur ne le fait plus perdre.
  const [refAncre, setRefAncre] = useState<string | null>(null);
  useEffect(() => { setRefAncre(revendeurAncre()); }, []);
  // refUrl : l'offre choisie par le client (lien du revendeur) — seule
  // transmise telle quelle. refAncre : simple provenance, que le serveur
  // n'applique qu'après le revendeur déjà rattaché au téléphone du client.
  const refUrl = normaliserCodeRevendeur(searchParams.get('ref'));
  const refCode = refUrl || refAncre;
  const promoParam = (searchParams.get('promo') || '').toUpperCase();
  const quantiteInitiale = Math.min(50, Math.max(1, parseInt(searchParams.get('q') || '1', 10) || 1));

  const [quantity, setQuantity] = useState(quantiteInitiale);
  // Quantité minimale du vendeur (« minimum 2 m », 2026-09-27) : le
  // sélecteur démarre et s'arrête au minimum ; le serveur l'impose aussi.
  const quantiteMini = Math.max(1, Number(product?.quantiteMin) || 1);
  useEffect(() => { setQuantity((q) => Math.max(q, quantiteMini)); }, [quantiteMini]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [mode, setMode] = useState<ModeReception>('home_delivery');
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

  const [choix, setChoix] = useState<ReglagesLivraison | null>(null);
  useEffect(() => {
    fetch('/api/settings/public')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setChoix(j))
      .catch(() => {});
  }, []);

  const pointsRelais = choix?.pointsRelais || [];
  const relais = pointsRelais.find((p) => p.id === pickupPointId) || pointsRelais[0];

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

  // PUB-10 : mêmes règles que le panier (lib/formulaire-commande).
  const telephone = telephoneNormalise(customerPhone);
  const erreurs = erreursCommande({ nom: customerName, telephone: customerPhone, mode, quartier: neighborhood, repere: landmark });
  const erreursVisibles = tentative ? erreurs : {};
  const coordonneesOk = !erreurs.nom && !erreurs.tel;
  const livraisonOk = mode === 'pickup_point' ? Boolean(relais) : !erreurs.quartier && !erreurs.repere;

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

    const premierChamp = premierChampEnErreur(erreurs);
    if (premierChamp) {
      const champ = document.getElementById(premierChamp);
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
      // Code du lien seulement : la provenance (cookie) est appliquée par le
      // serveur APRÈS le revendeur déjà rattaché au client (premier contact).
      resellerCode: refUrl || undefined,
      pickupPointId: retrait?.id,
      promoCode: devis.codePromo || undefined,
      positionClient: retrait ? undefined : positionClient || undefined,
    });
  };

  const barre = <EnteteCommande titre="Finaliser la commande" onRetour={retour} libelleRetour="Retour au produit" refUrl={refUrl} />;
  const avisPromo = avisCodePromo({
    soumis: devis?.codePromo || promoSoumis,
    reconnu: !devis || !promoSoumis ? null : devis.avisPromo === 'invalide' ? false : devis.codePromo ? true : null,
    remise: devis?.remise ?? 0, plafonnee: devis?.avisPromo === 'plafonnee', formater: fcfa,
  });

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

          <SectionCommande numero={1} titre="Votre article" complete>
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
                      onClick={() => setQuantity((q) => Math.max(quantiteMini, q - 1))}
                      disabled={quantity <= quantiteMini}
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
          </SectionCommande>

          <SectionCommande numero={2} titre="Vos coordonnées" complete={coordonneesOk}>
            <CoordonneesCommande nom={customerName} onNom={setCustomerName} telephone={customerPhone} onTelephone={setCustomerPhone}
              erreurs={erreursVisibles}
              onDestinataire={(c) => { setCustomerName(c.nom); setCustomerPhone(c.telephone); if (c.quartier) setNeighborhood(c.quartier); setLandmark(c.repere || ''); }} />
          </SectionCommande>

          <SectionCommande numero={3} titre={remiseVendeur ? 'Remise' : 'Livraison'} complete={livraisonOk}>
            <LivraisonCommande reglages={choix} mode={mode} onMode={setMode}
              remiseVendeur={remiseVendeur ? { type: product?.modeRemise === 'retrait' ? 'retrait' : 'fournisseur', avecService: Boolean(product?.typeOffre && product.typeOffre !== 'produit') } : null}
              ville={city} onVille={(v) => { setCity(v); setNeighborhood(''); setPositionClient(null); }}
              quartier={neighborhood} onQuartier={(q) => { setNeighborhood(q); definirQuartierClient(q); }} onPosition={setPositionClient}
              repere={landmark} onRepere={setLandmark} instructions={deliveryNotes} onInstructions={setDeliveryNotes}
              relaisChoisiId={relais?.id} onRelais={setPickupPointId} erreurs={erreursVisibles} />
          </SectionCommande>

          <CodePromoCommande saisi={promoSaisi} onSaisi={setPromoSaisi} onAppliquer={appliquerPromo} avis={avisPromo} ouvertInitial={Boolean(promoParam)} />
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
            <p className="text-xs text-slate-500">{TEXTE_PAIEMENT}</p>
            <Button type="submit" size="lg" fullWidth loading={isSubmitting} disabled={product.stockQuantity <= 0} className="hidden md:inline-flex">
              Confirmer la commande
            </Button>
          </Card>

          <GarantiesCommande />
        </aside>
      </form>

      <BarreCommande formulaire="formulaire-commande" libelle="Total à la livraison" total={devis ? fcfa(devis.total) : '…'}
        envoi={isSubmitting} desactive={product.stockQuantity <= 0} />
    </div>
  );
}
