'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, KeyRound, Package, Phone } from 'lucide-react';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Button from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Surface';
import type { Order } from '@/types';

/**
 * Confirmation d'un panier. Les commandes sont groupées par CODE de livraison
 * — un code par livraison (donc par fournisseur) : c'est ce que le client doit
 * retenir pour réceptionner ses colis.
 */

const fcfa = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} F`;

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
      if (!groupes.has(c.deliveryOtp)) groupes.set(c.deliveryOtp, []);
      groupes.get(c.deliveryOtp)!.push(c);
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
          <CheckCircle2 className="w-12 h-12 text-suguba-brand mx-auto" />
          <h1 className="text-xl font-black text-slate-900">Commande enregistrée</h1>
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
              <p className="text-sm font-black text-slate-900">
                {livraisons.length > 1 ? `Livraison ${i + 1} sur ${livraisons.length}` : 'Votre livraison'}
              </p>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900 text-white text-sm font-black tabular-nums">
                <KeyRound className="w-4 h-4" />{code}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Ne donnez ce code au livreur qu’une fois le colis vérifié. Il vous a aussi été envoyé par SMS.
            </p>
            <div className="divide-y divide-slate-100">
              {commandes.map((c) => (
                <div key={c.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{c.productName}</p>
                    <Link href={`/track/${c.orderNumber}`} className="text-[11px] font-bold text-slate-500 underline">
                      Suivre {c.orderNumber}
                    </Link>
                  </div>
                  <span className="text-sm font-black text-slate-900 tabular-nums shrink-0">{fcfa(c.totalAmount)}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}

        <Button href="/" variant="ghost" fullWidth>Continuer mes achats</Button>
      </main>
      <BottomNav />
    </div>
  );
}
