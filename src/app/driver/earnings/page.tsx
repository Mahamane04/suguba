'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import PrintableReceiptModal from '@/components/common/PrintableReceiptModal';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { useSugubaStore } from '@/lib/store';
import { Order } from '@/types';
import { ArrowLeft, Banknote, Printer, Truck, Wallet } from 'lucide-react';

/**
 * Portefeuille livreur — refait le 2026-09-11 sur des données réelles.
 *
 * Retiré, parce que rien ne l'appuyait :
 *  - 1 000 F par course et une « indemnité carburant » de 1 000 / 2 500 F
 *    écrits en dur : la rémunération vient maintenant du réglage admin
 *    (/api/driver/me → remunerationParLivraison) ;
 *  - « Déclarer mon versement » : ne changeait que l'écran, rien n'était
 *    envoyé à Suguba ;
 *  - l'adresse « Hub ACI 2000, derrière la Clinique Pasteur, avant 19h » et
 *    un « compte marchand Wave » (SasPay ne couvre pas Wave au Mali).
 * Corrigé : les espèces « dans la sacoche » comptaient aussi les commandes
 * déjà payées en ligne, que le livreur n'a jamais encaissées.
 */
export default function DriverEarningsPage() {
  const state = useSugubaStore();
  const [recuPour, setRecuPour] = useState<Order | null>(null);
  const [remuneration, setRemuneration] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/driver/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setRemuneration(j && typeof j.remunerationParLivraison === 'number' ? j.remunerationParLivraison : null))
      .catch(() => setRemuneration(null));
  }, []);

  // /api/orders/feed ne renvoie que les courses de CE livreur (voir /driver).
  const livrees = state.orders
    .filter((o) => o.status === 'delivered')
    .sort((a, b) => Date.parse(b.deliveredAt || b.createdAt || '') - Date.parse(a.deliveredAt || a.createdAt || ''));
  const especes = livrees.filter((o) => !o.paymentCollected).reduce((t, o) => t + o.totalAmount, 0);
  const gains = remuneration !== null ? livrees.length * remuneration : null;
  const fmt = (n: number) => `${n.toLocaleString('fr-FR')} F`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full space-y-5">
        <div className="space-y-1">
          <Link href="/driver" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" />
            <span>Mes courses</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Mon portefeuille</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Carte icone={<Truck className="w-4 h-4" />} titre="Livraisons effectuées" note="Remises confirmées par le code du client">
            {livrees.length}
          </Carte>
          <Carte icone={<Banknote className="w-4 h-4" />} titre="Espèces encaissées" note="À remettre à Suguba" accent>
            {fmt(especes)}
          </Carte>
          <Carte
            icone={<Wallet className="w-4 h-4" />}
            titre="Ma rémunération"
            note={remuneration !== null ? `${fmt(remuneration)} par livraison, tarif Suguba en vigueur` : 'Tarif en cours de chargement'}
          >
            {gains !== null ? fmt(gains) : <span className="inline-block h-7 w-24 rounded-lg bg-slate-200 animate-pulse align-middle" />}
          </Carte>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
          <h2 className="font-black text-sm text-slate-900">Remettre les espèces</h2>
          <p className="text-sm text-slate-600">
            Les espèces encaissées se remettent à l&apos;équipe Suguba, et votre rémunération est réglée avec elle.
            Une question sur un montant ? Écrivez-nous.
          </p>
          <a
            href="https://wa.me/22389460000?text=Bonjour%20Suguba%2C%20je%20suis%20livreur%20et%20j%27ai%20une%20question%20sur%20mon%20portefeuille."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-11 px-4 rounded-2xl border border-slate-200 hover:bg-slate-50 text-sm font-bold text-slate-800"
          >
            <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
            <span>Contacter Suguba</span>
          </a>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
          <h2 className="font-black text-sm text-slate-900">Mes livraisons ({livrees.length})</h2>
          {livrees.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">Aucune livraison effectuée pour le moment.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {livrees.map((o) => (
                <div key={o.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{o.productName}</p>
                    <p className="text-[11px] text-slate-500">
                      #{o.orderNumber} · {o.neighborhood}
                      {o.deliveredAt ? ` · ${new Date(o.deliveredAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">{fmt(o.totalAmount)}</p>
                      <p className={`text-[11px] font-bold ${o.paymentCollected ? 'text-slate-500' : 'text-emerald-700'}`}>
                        {o.paymentCollected ? 'Payé en ligne' : 'Encaissé'}
                      </p>
                    </div>
                    <button
                      onClick={() => setRecuPour(o)}
                      aria-label={`Reçu de la commande ${o.orderNumber}`}
                      className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {recuPour && (
        <PrintableReceiptModal order={recuPour} isOpen={!!recuPour} onClose={() => setRecuPour(null)} />
      )}

      <BottomNav />
    </div>
  );
}

function Carte({ icone, titre, note, accent, children }: {
  icone: React.ReactNode; titre: string; note: string; accent?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`p-4 rounded-3xl border space-y-1 ${accent ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200'}`}>
      <div className={`flex items-center gap-1.5 ${accent ? 'text-slate-300' : 'text-slate-500'}`}>
        {icone}
        <span className="text-[11px] font-bold uppercase">{titre}</span>
      </div>
      <p className={`text-2xl font-black ${accent ? 'text-white' : 'text-slate-900'}`}>{children}</p>
      <p className={`text-[11px] ${accent ? 'text-slate-300' : 'text-slate-500'}`}>{note}</p>
    </div>
  );
}
