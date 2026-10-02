'use client';

import SugubaLoader from '@/components/ui/SugubaLoader';

import { orderAccessKey } from '@/lib/order-access-client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ProductImage from '@/components/common/ProductImage';
import DeliveryCodeNotice from '@/components/common/DeliveryCodeNotice';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import SasPayPaymentDesk from '@/components/common/SasPayPaymentDesk';
import { useSugubaStore } from '@/lib/store';
import { whatsappHelper } from '@/lib/whatsapp-helper';
import { CheckCircle2, Clock, ArrowLeft, RefreshCw, XCircle, Smartphone, ShieldCheck, AlertCircle } from 'lucide-react';
import { formatF } from '@/lib/montant';
import { etapesSuivi, maintenantSuivi, commandeArretee } from '@/lib/suivi-commande';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';

export default function OrderTrackingPage() {
  const params = useParams();
  const orderNumber = params?.orderNumber as string;
  const state = useSugubaStore();

  // Commande retrouvée par le serveur après vérification du téléphone. Elle
  // prend le pas sur le store local, qui ne contient rien sur un autre appareil.
  const [commandeDistante, setCommandeDistante] = useState<any>(null);
  const [telephone, setTelephone] = useState('');
  const [erreurSuivi, setErreurSuivi] = useState('');
  const [recherche, setRecherche] = useState(false);

  const orderLocal = state.orders.find(
    (o) => o.creationConfirmed && o.orderNumber.toUpperCase() === orderNumber?.toUpperCase()
  );
  const order = commandeDistante || orderLocal;

  // La copie locale est figée au moment de l'achat : le client ne reçoit
  // aucune mise à jour (le flux des commandes est réservé à l'équipe). Sans
  // cette relecture, sa commande restait « En attente d'appel » pour toujours,
  // même livrée. Le téléphone de la commande locale sert de preuve.
  const [actualisation, setActualisation] = useState(false);
  // Reçu gardé sur ce téléphone (lu après montage : stockage du navigateur).
  const [recuIci, setRecuIci] = useState(false);
  useEffect(() => { setRecuIci(Boolean(orderNumber && orderAccessKey(orderNumber))); }, [orderNumber]);
  const actualiser = useCallback(async (tel: string) => {
    setActualisation(true);
    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, phone: tel, accessKey: orderAccessKey(orderNumber) }),
      });
      const json = await res.json();
      if (res.ok && json.success) setCommandeDistante(json.commande);
    } catch {
      /* hors connexion : on garde la dernière version connue */
    } finally {
      setActualisation(false);
    }
  }, [orderNumber]);

  const telLocal = orderLocal?.customerPhone;
  useEffect(() => {
    if (telLocal) void actualiser(telLocal);
  }, [telLocal, actualiser]);

  const rechercher = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreurSuivi('');
    setRecherche(true);
    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, phone: telephone, accessKey: orderAccessKey(orderNumber) }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErreurSuivi(json.error || 'Commande introuvable avec ces informations.');
        return;
      }
      setCommandeDistante(json.commande);
    } catch {
      setErreurSuivi('Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setRecherche(false);
    }
  };

  // Le store local ne contient les commandes que sur l'appareil qui les a
  // passées. Ailleurs — téléphone changé, cache vidé, cybercafé — on demande
  // le numéro du client pour prouver que la commande est bien la sienne,
  // plutôt que d'annoncer bêtement « introuvable ».
  if (!order) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 max-w-lg mx-auto p-6 w-full flex flex-col justify-center space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-suguba-profond text-white flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Confirmez que c&apos;est bien vous</h1>
            <p className="text-xs text-slate-600">
              Entrez le numéro de téléphone donné lors de la commande
              <strong className="text-slate-900"> #{orderNumber}</strong>.
            </p>
          </div>

          <form onSubmit={rechercher} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="space-y-2">
              <label htmlFor="tel-suivi" className="text-xs font-semibold text-slate-600">
                Votre numéro de téléphone
              </label>
              <input
                id="tel-suivi"
                type="tel"
                inputMode="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="Ex : 70 12 34 56"
                className="w-full h-12 px-4 rounded-2xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-slate-900"
              />
            </div>

            {erreurSuivi && (
              <div className="flex items-start space-x-2 bg-red-50 border border-red-200 rounded-2xl p-3">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-800 font-medium">{erreurSuivi}</p>
              </div>
            )}

            <Button type="submit" size="lg" fullWidth loading={recherche}
              disabled={telephone.replace(/\D/g, '').length < 8}>
              Voir ma commande
            </Button>

            <p className="text-xs text-slate-500 text-center">
              Ce numéro nous sert uniquement à vérifier que la commande est la vôtre.
            </p>
          </form>

          <Link href="/" className="text-center text-xs font-bold text-slate-500 hover:text-slate-900">
            Retour au catalogue
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  // Étapes et « maintenant » calculés par lib/suivi-commande (PUB-03).
  const etapes = etapesSuivi(order);
  const maintenant = maintenantSuivi(order);
  const arretee = commandeArretee(order.status);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://sugubaml.com';
  const whatsappReceiptLink = whatsappHelper.getCustomerReceiptLink(order, appUrl);
  const supportChatLink = whatsappHelper.getSupportChatLink(order.orderNumber);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-16">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        <Link 
          href="/" 
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour au catalogue</span>
        </Link>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-base font-bold text-slate-900">Commande {order.orderNumber}</h1>
            <button
              type="button"
              onClick={() => order.customerPhone && actualiser(order.customerPhone)}
              disabled={actualisation || !order.customerPhone}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60"
            >
              {actualisation ? <SugubaLoader className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {actualisation ? 'Mise à jour…' : 'Actualiser'}
            </button>
          </div>

          {/* PUB-03 : ce qui se passe maintenant, en premier et en grand. */}
          <div
            aria-live="polite"
            className={`flex items-start gap-3 rounded-2xl p-4 ${arretee ? 'bg-rose-50 border border-rose-200' : 'bg-suguba-menthe'}`}
          >
            {arretee
              ? <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
              : <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-suguba-profond" />}
            <div className="space-y-0.5">
              <p className={`text-lg font-bold ${arretee ? 'text-rose-900' : 'text-suguba-profond'}`}>{maintenant.titre}</p>
              <p className={`text-sm ${arretee ? 'text-rose-900' : 'text-slate-800'}`}>{maintenant.texte}</p>
            </div>
          </div>

          {/* Product Summary */}
          <div className="flex items-center space-x-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-200 shrink-0">
              <ProductImage src={order.productImage} alt={order.productName} fill className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-slate-900 truncate">{order.productName}</p>
              <p className="text-xs text-slate-500">Quantité : {order.quantity}</p>
              <p className="text-sm font-bold text-slate-900 tabular-nums">{formatF(order.totalAmount)}{order.paymentCollected ? ' · payé' : ''}</p>
            </div>
          </div>

          {!['delivered', 'cancelled', 'returned'].includes(order.status) && (
            <DeliveryCodeNotice orderNumber={order.orderNumber} />
          )}

          {/* Après livraison, le reçu sert au SAV (2026-09-25). */}
          {order.status === 'delivered' && recuIci && (
            <Link href={`/recu/${encodeURIComponent(order.orderNumber)}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 hover:bg-slate-50">
              <span className="text-sm font-bold text-slate-900">Mon reçu · signaler un problème</span>
              <span aria-hidden className="text-slate-400">›</span>
            </Link>
          )}

          {/* Frise : faite (coche), en cours (anneau + « En cours »), à venir (gris). */}
          {!arretee && (
            <div className="space-y-4 pt-2">
              <h2 className="text-sm font-bold text-slate-900">Les étapes</h2>
              <ol className="relative pl-7 space-y-5 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {etapes.map((etape) => (
                  <li key={etape.id} className="relative" aria-current={etape.enCours ? 'step' : undefined}>
                    <span className={`absolute -left-7 top-0 flex h-5 w-5 items-center justify-center rounded-full ${
                      etape.faite ? 'bg-suguba-brand text-white'
                        : etape.enCours ? 'bg-white ring-4 ring-suguba-citron border-2 border-suguba-profond'
                          : 'bg-slate-200 text-slate-500'
                    }`}>
                      {etape.faite ? <CheckCircle2 className="h-3.5 w-3.5" /> : !etape.enCours && <Clock className="h-3 w-3" />}
                    </span>
                    <p className={`text-sm font-bold ${etape.faite || etape.enCours ? 'text-slate-900' : 'text-slate-500'}`}>
                      {etape.titre}
                      {etape.enCours && <span className="ml-2 rounded-full bg-suguba-citron px-2 py-0.5 text-[11px] font-bold text-suguba-profond">En cours</span>}
                    </p>
                    <p className="text-xs text-slate-600">{etape.detail}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Mobile Money replié et facultatif, comme sur « Commande reçue ». Le
              composant vérifie lui-même à l'ouverture si la commande est déjà réglée. */}
          {!['delivered', 'cancelled', 'returned'].includes(order.status) && !order.paymentCollected && (
            <details className="group rounded-2xl border border-slate-200">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
                <Smartphone className="h-4 w-4 text-suguba-profond" />
                Payer maintenant par Mobile Money
                <span className="ml-auto text-xs font-normal text-slate-500 group-open:hidden">facultatif</span>
              </summary>
              <div className="px-2 pb-3">
                <SasPayPaymentDesk
                  amount={order.totalAmount}
                  orderNumber={order.orderNumber}
                  defaultPhone={order.customerPhone}
                />
              </div>
            </details>
          )}

          {/* Deux liens WhatsApp : l'icône dit WhatsApp (l'ancien bouton « Assistance »
              montrait un téléphone et ouvrait WhatsApp). */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-100">
            <Button href={supportChatLink} variant="whatsapp" fullWidth target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon className="w-5 h-5" />Écrire à Suguba
            </Button>
            <Button href={whatsappReceiptLink} variant="ghost" fullWidth target="_blank" rel="noopener noreferrer">
              Garder mon reçu sur WhatsApp
            </Button>
          </div>

        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
