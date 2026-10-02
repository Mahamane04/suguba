'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Package, Smartphone, Truck } from 'lucide-react';
import DeliveryCodeNotice from '@/components/common/DeliveryCodeNotice';
import SasPayPaymentDesk from '@/components/common/SasPayPaymentDesk';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Button from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Surface';
import type { Order } from '@/types';
import { formatF } from '@/lib/montant';

/**
 * Confirmation d'un panier. Les commandes sont groupées par identifiant public de livraison
 * — un groupe par livraison : le client peut
 * retenir pour réceptionner ses colis.
 */

const fcfa = formatF;

export default function ConfirmationPanierPage() {
  const [donnees, setDonnees] = useState<{ total: number; commandes: Order[] } | null>(null);
  const [lu, setLu] = useState(false);

  useEffect(() => {
    try { setDonnees(JSON.parse(sessionStorage.getItem('suguba_dernier_panier') || 'null')); } catch { /* vide */ }
    setLu(true);
  }, []);

  const livraisons = useMemo(() => {
    const groupes = new Map<string, Order[]>();
    for (const c of donnees?.commandes || []) {
      if (!groupes.has(c.deliveryGroup || c.id)) groupes.set(c.deliveryGroup || c.id, []);
      groupes.get(c.deliveryGroup || c.id)!.push(c);
    }
    return [...groupes.entries()];
  }, [donnees]);

  if (lu && !donnees) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <Header />
        <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8">
          <EmptyState icone={Package} titre="Aucune commande récente" texte="Retrouvez vos commandes avec leur numéro dans le suivi."
            action={<Button href="/track">Suivre une commande</Button>} />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Header />
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-6 space-y-4">
        {/* PUB-10 (audit UI/UX du 2026-10-02) : même tête que « Commande reçue » après un
            achat direct — la prochaine étape d'abord, en grand. */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-16 h-16 bg-suguba-brand text-white rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Commande reçue</h1>
          <p className="text-base text-slate-800 max-w-sm mx-auto">
            Suguba appelle le <strong className="whitespace-nowrap">{donnees?.commandes[0]?.customerPhone}</strong> pour confirmer la commande. Gardez ce téléphone allumé.
          </p>
          <p className="text-sm text-slate-600">
            {donnees?.commandes.length} article{(donnees?.commandes.length || 0) > 1 ? 's' : ''} · <strong className="text-slate-900">{fcfa(donnees?.total || 0)}</strong> à payer à la livraison
          </p>
        </div>

        {livraisons.map(([code, commandes], i) => (
          <Card key={code} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-900">
                {livraisons.length > 1 ? `Livraison ${i + 1} sur ${livraisons.length}` : 'Votre livraison'}
              </p>
            </div>
            <DeliveryCodeNotice orderNumber={commandes[0].orderNumber} autoSend />
            <div className="divide-y divide-slate-100">
              {commandes.map((c) => (
                <div key={c.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{c.productName}</p>
                    <Link href={`/track/${c.orderNumber}`} className="text-xs font-bold text-slate-500 underline">
                      Suivre {c.orderNumber}
                    </Link>
                  </div>
                  <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">{fcfa(c.totalAmount)}</span>
                </div>
              ))}
              {/* PUB-10 (lot 7 de l'audit UI/UX du 2026-10-02) : le paiement Mobile Money,
                  proposé après une commande directe, manquait après le panier. Replié et
                  facultatif, comme sur « Commande reçue » ; une commande à la fois. */}
              {commandes.filter((c) => !c.paymentCollected).map((c) => (
                <details key={`paiement-${c.id}`} className="group rounded-2xl border border-slate-200">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
                    <Smartphone className="h-4 w-4 shrink-0 text-suguba-profond" />
                    <span className="min-w-0 flex-1 truncate">Payer {commandes.length > 1 ? c.productName : 'maintenant'} par Mobile Money</span>
                    <span className="text-xs font-normal text-slate-500 group-open:hidden">facultatif</span>
                  </summary>
                  <div className="px-2 pb-3">
                    <SasPayPaymentDesk amount={c.totalAmount} orderNumber={c.orderNumber} defaultPhone={c.customerPhone} />
                  </div>
                </details>
              ))}
            </div>
          </Card>
        ))}

        {/* Une seule action pleine : suivre la commande. */}
        <Button href={donnees?.commandes.length === 1 ? `/track/${donnees.commandes[0].orderNumber}` : '/track'} size="lg" fullWidth>
          <Truck className="w-4 h-4" />{(donnees?.commandes.length || 0) > 1 ? 'Suivre mes commandes' : 'Suivre ma commande'}
        </Button>
        <Button href="/" variant="ghost" fullWidth>Continuer mes achats</Button>
        <p className="text-center text-xs text-slate-600">
          Retrouvez vos commandes sur tous vos téléphones :{' '}
          <Link href="/compte/commandes" className="font-semibold text-suguba-profond underline underline-offset-2">créer un compte gratuit</Link>
        </p>
      </main>
      <BottomNav />
    </div>
  );
}
