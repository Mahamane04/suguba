'use client';

import React, { use } from 'react';
import Link from 'next/link';
import ProductImage from '@/components/common/ProductImage';
import DeliveryCodeNotice from '@/components/common/DeliveryCodeNotice';
import Header from '@/components/common/Header';
import SasPayPaymentDesk from '@/components/common/SasPayPaymentDesk';
import { useSugubaStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { CheckCircle2, Truck, Copy, Smartphone } from 'lucide-react';
import { formatF } from '@/lib/montant';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';

export default function OrderSuccessPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const resolvedParams = use(params);
  const state = useSugubaStore();
  const { toast } = useToast();

  const order = state.orders.find(o => o.orderNumber === resolvedParams.orderNumber);

  // Le numéro est la seule clé d'un client sans compte : un geste pour le garder.
  const copierNumero = async () => {
    try {
      await navigator.clipboard.writeText(resolvedParams.orderNumber);
      toast('Numéro de commande copié.', { ton: 'succes' });
    } catch {
      toast(`Notez votre numéro : ${resolvedParams.orderNumber}`, { ton: 'info', duree: 8000 });
    }
  };

  if (!order?.creationConfirmed) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-12 space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Retrouvez votre commande</h1>
          <p className="text-sm text-slate-600">
            Le reçu de cette commande n’est pas disponible sur cet appareil.
            Vérifiez son enregistrement avec votre numéro de commande et votre téléphone.
          </p>
          <Button href={`/track/${encodeURIComponent(resolvedParams.orderNumber)}`} size="lg">
            Vérifier ma commande
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-16">
      <Header />

      <main className="flex-1 max-w-xl mx-auto px-4 sm:px-6 py-8 w-full">
        
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xl text-center space-y-6">
          
          {/* PUB-02 (audit UI/UX du 2026-10-02) : la vraie prochaine étape était écrite en
              petit, sous trois boutons pleins de trois couleurs. Elle passe en premier. */}
          <div className="w-16 h-16 bg-suguba-brand text-white rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Commande reçue</h1>
            <p className="text-base text-slate-800 max-w-sm mx-auto">
              Suguba appelle le <strong className="whitespace-nowrap">{order.customerPhone}</strong> pour confirmer la commande. Gardez ce téléphone allumé.
            </p>
            <button
              type="button"
              onClick={copierNumero}
              aria-label={`Copier le numéro de commande ${order.orderNumber}`}
              className="inline-flex items-center gap-1.5 min-h-10 text-sm font-semibold text-suguba-profond bg-suguba-menthe hover:bg-suguba-sauge px-4 rounded-full"
            >
              Commande {order.orderNumber}
              <Copy className="w-4 h-4" />
            </button>
          </div>

          <DeliveryCodeNotice orderNumber={order.orderNumber} autoSend />

          {/* Order Details Summary */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2.5 text-xs">
            <div className="flex items-center space-x-3 pb-2 border-b border-slate-200">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-200 shrink-0">
                <ProductImage src={order.productImage} alt={order.productName} fill sizes="48px" className="object-cover" compact />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 truncate">{order.productName}</p>
                <p className="text-slate-500">Quantité : {order.quantity}</p>
              </div>
            </div>

            <p className="text-sm text-slate-700">Livraison : <strong className="text-slate-900">{order.neighborhood}</strong>{order.landmark ? ` — ${order.landmark}` : ''}</p>

            <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
              <span>{order.paymentCollected ? 'Payé par Mobile Money' : 'À payer à la livraison'}</span>
              <span className="text-suguba-profond tabular-nums">{formatF(order.totalAmount)}</span>
            </div>
          </div>

          {/* Encaissement mobile money via SasPay, replié : le client a choisi de payer
              à la livraison, le paiement en ligne reste une option, pas une deuxième
              consigne. Masqué une fois la commande réglée (le desk affiche alors son
              propre écran de confirmation). */}
          {!order.paymentCollected && (
            <details className="group rounded-2xl border border-slate-200 text-left">
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

          {/* Un seul bouton plein : suivre la commande. */}
          <div className="space-y-2 pt-2">
            <Button href={`/track/${order.orderNumber}`} size="lg" fullWidth>
              <Truck className="w-4 h-4" />Suivre ma commande
            </Button>
            <Button variant="ghost" fullWidth target="_blank" rel="noopener noreferrer"
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                `🎉 *SUGUBA.ML — Reçu Commande #${order.orderNumber}*\n\nProduit : ${order.productName}\nTotal : ${formatF(order.totalAmount)}\nLe code de remise s’affiche sur le reçu Suguba de la commande.\n📍 Repère : ${order.landmark} (${order.neighborhood})`
              )}`}>
              <WhatsAppIcon className="w-5 h-5" />Garder mon reçu sur WhatsApp
            </Button>
            <Button href="/" variant="ghost" fullWidth>Continuer mes achats</Button>
            {/* Compte client (C1) : facultatif, pour retrouver ses commandes sur tous ses téléphones. */}
            <p className="pt-2 text-xs text-slate-600">
              Retrouvez vos commandes sur tous vos téléphones :{' '}
              <Link href="/compte/commandes" className="font-semibold text-suguba-profond underline underline-offset-2">créer un compte gratuit</Link>
            </p>
          </div>

        </div>

      </main>
    </div>
  );
}
