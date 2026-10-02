'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Package, Phone, Smartphone, Truck } from 'lucide-react';
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
        <div className="text-center space-y-2 pt-2">
          <CheckCircle2 className="w-12 h-12 text-suguba-brand-dark mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">Commande enregistrée</h1>
          <p className="text-sm text-slate-600">
            {donnees?.commandes.length} article{(donnees?.commandes.length || 0) > 1 ? 's' : ''} · {fcfa(donnees?.total || 0)} à payer à la livraison
          </p>
        </div>

        <Card className="flex items-start gap-3">
          <Phone className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-700">Suguba vous appelle pour confirmer, puis organise la livraison. Gardez votre téléphone à portée.</p>
        </Card>

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
      </main>
      <BottomNav />
    </div>
  );
}
