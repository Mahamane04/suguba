'use client';


import { createPortal } from 'react-dom';
import { useModalFocus } from '@/hooks/useModalFocus';
import DeliveryCodeNotice from '@/components/common/DeliveryCodeNotice';
import React, { useEffect, useState } from 'react';
import { Product } from '@/types';
import { ArrowLeft, CheckCircle, Minus, Plus, Loader2, Check, X } from 'lucide-react';
import OrderRecovery from '@/components/common/OrderRecovery';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import { Field, Input } from '@/components/ui/Field';
import ChoicePicker from '@/components/ui/ChoicePicker';
import Button from '@/components/ui/Button';
import { useOrderQuote } from '@/lib/useOrderQuote';
import type { OrderInput } from '@/lib/order-input';
import Image from 'next/image';
import { useOrderCheckout } from '@/lib/useOrderCheckout';
import { useCodeRevendeur } from '@/lib/partage';
import { useToast } from '@/components/ui/Toast';
import { MARGE_BAS_FLOTTANT } from '@/lib/mise-en-page';

interface CreateOrderModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (orderNumber: string) => void;
}

const QUANTITE_MAX = 10;

/**
 * Saisie d'une vente par un revendeur (« + Vente »).
 *
 * Refonte du 2026-09-18 :
 * - téléphone : écran PLEIN (plus de pop-up à 92 % de hauteur que le clavier
 *   recouvrait), barre du haut avec retour, total et validation fixés en bas ;
 * - champs du design system en 16 px : en 12 px, Safari zoomait à chaque
 *   saisie et la page restait décalée ;
 * - quartier choisi dans la liste officielle ET transmis au devis : les frais
 *   de livraison affichés étaient calculés sans lui (1 500 F affichés quand
 *   le vrai tarif du quartier était 900 F).
 * Sur ordinateur, la fenêtre reste centrée.
 */
export default function CreateOrderModal({ product, isOpen, onClose, onSuccess }: CreateOrderModalProps) {
  const { toast } = useToast();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [city, setCity] = useState('Bamako');
  const [neighborhood, setNeighborhood] = useState('');
  const [landmark, setLandmark] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const { submitOrder, isSubmitting, resetAttempt, recovery } = useOrderCheckout(`reseller:${product?.id || ''}`);
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);

  // Code RÉEL du revendeur connecté (2026-09-11). Il venait des données de
  // démonstration (state.resellers) : les commandes saisies ici portaient le
  // code d'un revendeur fictif, ou aucun — et le vrai revendeur perdait sa
  // commission.
  const codeRevendeur = useCodeRevendeur();
  // Article au prix de gros (2026-09-24) : le revendeur saisit le prix
  // négocié avec son client. Vide = son prix enregistré, sinon le conseillé.
  const estGros = product?.modePrix === 'gros';
  const [prixSaisi, setPrixSaisi] = useState('');
  const prixNegocie = estGros && parseInt(prixSaisi, 10) > 0 ? parseInt(prixSaisi, 10) : undefined;
  const { devis, pourLeRevendeur, loading: devisEnCours, error: erreurDevis } = useOrderQuote(isOpen && product ? {
    productId: product.id, quantity, city, neighborhood: neighborhood || undefined, resellerCode: codeRevendeur || undefined,
    prixNegocie,
  } : null);

  const { host, ref } = useModalFocus(isOpen && Boolean(product), () => handleReset());
  useEffect(() => {
    // Le formulaire disparaît après succès : déplacer le focus sur le reçu.
    if (createdOrder && isOpen) ref.current?.focus();
  }, [createdOrder, isOpen, ref]);
  if (!isOpen || !product || !host) return null;

  const unitPrice = devis?.prixUnitaire ?? product.publicPrice;
  // Gain RÉEL calculé par le serveur pour ce revendeur (prix négocié compris),
  // sinon la commission affichée au catalogue.
  const totalCommission = pourLeRevendeur ? pourLeRevendeur.gain : product.resellerCommission * quantity;
  const commissionPerUnit = Math.round(totalCommission / Math.max(1, quantity));
  const totalAmount = devis?.total;
  const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} F`;

  const finishOrder = async (data?: OrderInput) => {
    try {
      const order = await submitOrder(data);

      setCreatedOrder(order);
      onSuccess?.(order.orderNumber);
    } catch (error) {
      toast(error instanceof Error ? error.message : "La commande n'a pas pu être créée.", { ton: 'erreur' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !neighborhood || !landmark) {
      toast('Remplissez le nom, le téléphone, le quartier et le repère du client.', { ton: 'erreur' });
      return;
    }

    if (!devis) return;
    await finishOrder({
        productId: product.id,
        quantity,
        customerName,
        customerPhone,
        city,
        neighborhood,
        landmark,
        deliveryNotes,
        resellerCode: codeRevendeur || undefined,
        prixNegocie,
      });
  };

  const handleReset = () => {
    if (isSubmitting) return;
    if (createdOrder) resetAttempt();
    setCreatedOrder(null);
    setCustomerName('');
    setCustomerPhone('');
    setNeighborhood('');
    setLandmark('');
    setDeliveryNotes('');
    setQuantity(1);
    setPrixSaisi('');
    onClose();
  };

  return createPortal(
    <div
      ref={ref}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-4 sm:bg-slate-900/60 sm:backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titre-vente"
    >
      <div className="bg-slate-50 sm:bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-lg sm:rounded-3xl sm:shadow-2xl sm:border sm:border-slate-100 overflow-hidden flex flex-col">

        {/* Barre du haut : le retour est toujours visible (même logique que le panier). */}
        <header
          className="shrink-0 bg-white border-b border-slate-200 px-2 sm:px-4 flex items-center gap-1"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <button
            type="button"
            onClick={handleReset}
            aria-label={createdOrder ? 'Fermer' : 'Retour'}
            className="w-11 h-11 my-1.5 shrink-0 rounded-full hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5 sm:hidden" />
            <X className="w-5 h-5 hidden sm:block" />
          </button>
          <h2 id="titre-vente" className="text-base font-bold text-slate-900 truncate">
            {createdOrder ? 'Commande enregistrée' : 'Nouvelle vente'}
          </h2>
        </header>

        {createdOrder ? (
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-8 text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">Commande {createdOrder.orderNumber} créée</h3>
              <p className="text-sm text-slate-600 max-w-sm mx-auto">
                Suguba va appeler <strong>{createdOrder.customerName}</strong> pour confirmer avant d’envoyer le livreur.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-4 text-left space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Client</span>
                <span className="font-bold text-slate-900 text-right">{createdOrder.customerName}<br /><span className="font-medium text-slate-600">{createdOrder.customerPhone}</span></span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Quartier</span>
                <span className="font-bold text-slate-900">{createdOrder.neighborhood}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">À encaisser</span>
                <span className="font-bold text-slate-900 tabular-nums">{fcfa(createdOrder.totalAmount)}</span>
              </div>
              <div className="flex justify-between gap-3 pt-2.5 border-t border-slate-100">
                <span className="text-suguba-brand-dark font-bold">Ta commission</span>
                <span className="font-bold text-suguba-brand-dark tabular-nums">+{fcfa(createdOrder.resellerCommission)}</span>
              </div>
            </div>

            <DeliveryCodeNotice orderNumber={createdOrder.orderNumber} autoSend />
            <Button onClick={handleReset} fullWidth size="lg">Retour au catalogue</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
              <OrderRecovery attempt={recovery} disabled={isSubmitting} onResume={() => { void finishOrder(); }} />

              {/* Produit + quantité */}
              <div className="flex items-center gap-3 bg-white p-3 rounded-3xl border border-slate-200">
                <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                  <Image src={product.images[0]} alt="" fill className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-900 line-clamp-2">{product.name}</p>
                  <p className="text-xs text-suguba-brand-dark font-bold">+{fcfa(commissionPerUnit)} / unité pour toi</p>
                </div>
                <div className="flex items-center rounded-full border border-slate-200 shrink-0" role="group" aria-label="Quantité">
                  <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}
                    aria-label="Retirer un" className="w-10 h-10 flex items-center justify-center text-slate-700 disabled:text-slate-300">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold tabular-nums">{quantity}</span>
                  <button type="button" onClick={() => setQuantity((q) => Math.min(QUANTITE_MAX, q + 1))} disabled={quantity >= QUANTITE_MAX}
                    aria-label="Ajouter un" className="w-10 h-10 flex items-center justify-center text-slate-700 disabled:text-slate-300">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Prix négocié : articles au prix de gros uniquement */}
              {estGros && (
                <section className="bg-white rounded-3xl border border-slate-200 p-4 space-y-2">
                  <h3 className="text-sm font-bold text-slate-900">Prix de vente au client</h3>
                  <Field label="Prix par article (F)" htmlFor="vente-prix"
                    aide={pourLeRevendeur
                      ? `Minimum ${fcfa(pourLeRevendeur.prixMinimal)} · conseillé ${fcfa(pourLeRevendeur.prixConseille)}. Laissez vide pour votre prix habituel.`
                      : 'Le prix sur lequel vous vous êtes mis d’accord avec votre client.'}>
                    <Input id="vente-prix" inputMode="numeric" autoComplete="off" placeholder={pourLeRevendeur ? String(pourLeRevendeur.prixConseille) : 'Ex. : 25000'}
                      value={prixSaisi} onChange={(e) => setPrixSaisi(e.target.value.replace(/\D/g, ''))} />
                  </Field>
                </section>
              )}

              {/* Client */}
              <section className="bg-white rounded-3xl border border-slate-200 p-4 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Le client</h3>
                <Field label="Nom et prénom" htmlFor="vente-nom" requis>
                  <Input id="vente-nom" required autoComplete="off" placeholder="Ex. : Ibrahim Keita"
                    value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </Field>
                <Field label="Téléphone (WhatsApp ou appel)" htmlFor="vente-tel" requis aide="Suguba l’appelle pour confirmer.">
                  <Input id="vente-tel" type="tel" inputMode="tel" required autoComplete="off" placeholder="Ex. : 76 12 34 56"
                    value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                </Field>
              </section>

              {/* Livraison */}
              <section className="bg-white rounded-3xl border border-slate-200 p-4 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Livraison</h3>
                <Field label="Ville" htmlFor="vente-ville" requis>
                  <ChoicePicker id="vente-ville" valeur={city} onChange={setCity}
                    choix={['Bamako', 'Kati', 'Sikasso', 'Ségou'].map((v) => ({ valeur: v, libelle: v }))} />
                </Field>
                <Field label="Quartier" htmlFor="vente-quartier" requis>
                  <NeighborhoodPicker id="vente-quartier" value={neighborhood} onChange={setNeighborhood} placeholder="Choisir le quartier du client" />
                </Field>
                <Field label="Repère" htmlFor="vente-repere" requis aide="Ex. : en face de la pharmacie du pont, portail bleu.">
                  <Input id="vente-repere" required autoComplete="off" value={landmark} onChange={(e) => setLandmark(e.target.value)} />
                </Field>
                <Field label="Instructions (facultatif)" htmlFor="vente-notes">
                  <Input id="vente-notes" autoComplete="off" placeholder="Ex. : préfère être livré après 16 h"
                    value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} />
                </Field>
              </section>

              {/* Récapitulatif */}
              <section className="bg-white rounded-3xl border border-slate-200 p-4 space-y-2 text-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-1">Récapitulatif</h3>
                <div className="flex justify-between text-slate-600">
                  <span>Article{quantity > 1 ? `s (${quantity})` : ''}</span>
                  <span className="font-semibold tabular-nums">{fcfa(unitPrice * quantity)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Livraison</span>
                  <span className="font-semibold tabular-nums">{devis ? fcfa(devis.fraisLivraison) : '…'}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-100">
                  <span>Le client paie</span>
                  <span className="tabular-nums">{totalAmount !== undefined ? fcfa(totalAmount) : '…'}</span>
                </div>
                <div className="flex justify-between font-bold text-suguba-brand-dark">
                  <span>Ta commission</span>
                  <span className="tabular-nums">+{fcfa(totalCommission)}</span>
                </div>
              </section>

              {erreurDevis && <p role="alert" className="text-sm text-red-700">{erreurDevis}</p>}
            </div>

            {/* Validation toujours sous le pouce. */}
            <div
              className="shrink-0 bg-white border-t border-slate-200 px-4 pt-3 flex items-center justify-between gap-3"
              style={{ paddingBottom: MARGE_BAS_FLOTTANT }}
            >
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Le client paie</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">
                  {totalAmount !== undefined ? fcfa(totalAmount) : '…'}
                  {devisEnCours && <Loader2 className="inline w-3.5 h-3.5 ml-1 animate-spin text-slate-400" />}
                </p>
              </div>
              <Button type="submit" size="lg" disabled={isSubmitting || !devis}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Valider la vente
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>, host
  );
}
