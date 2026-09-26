'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import PrintableReceiptModal from '@/components/common/PrintableReceiptModal';
import RecuVersementModal from '@/components/common/RecuVersementModal';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { useSugubaStore } from '@/lib/store';
import EmptyState from '@/components/ui/EmptyState';
import { Order } from '@/types';
import { calculerAVerser, type CaisseLivreur, type Versement } from '@/lib/caisse-livreur';

function caisseLocale(livrees: Order[], parCourse: number): CaisseLivreur {
  const enEspeces = livrees.filter((o) => o.paymentMethod !== 'mobile_money');
  return {
    driverId: '', nom: 'Livreur', telephone: null, commandes: [], versements: [], ecartCumule: 0, plusAncienne: null,
    ...calculerAVerser(enEspeces.map((o) => o.totalAmount), parCourse),
  };
}
import { ArrowLeft, Banknote, Package, Printer, Receipt, Truck, Wallet } from 'lucide-react';

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
  const [caisse, setCaisse] = useState<{ caisse: CaisseLivreur | null; livreurGardeRemuneration: boolean; migrationRequise: boolean } | null>(null);
  const [recuVersement, setRecuVersement] = useState<Versement | null>(null);

  useEffect(() => {
    fetch('/api/driver/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setRemuneration(j && typeof j.remunerationParLivraison === 'number' ? j.remunerationParLivraison : null))
      .catch(() => setRemuneration(null));
    fetch('/api/driver/caisse', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setCaisse(j))
      .catch(() => setCaisse(null));
  }, []);

  // /api/orders/feed ne renvoie que les courses de CE livreur (voir /driver).
  const livrees = state.orders
    .filter((o) => o.status === 'delivered')
    .sort((a, b) => Date.parse(b.deliveredAt || b.createdAt || '') - Date.parse(a.deliveredAt || a.createdAt || ''));
  // Le montant à remettre vient de /api/driver/caisse (commandes non payées en
  // Mobile Money et pas encore versées). L'ancien calcul reposait sur
  // `paymentCollected`, que le code de remise passe à vrai pour TOUTES les
  // commandes : le total restait à 0 F (corrigé le 2026-09-25).
  // Tant que le SQL de la caisse n'est pas exécuté, aucun versement n'existe :
  // on recalcule sur place à partir des livraisons, avec la même règle.
  const c = caisse?.caisse
    || (caisse?.migrationRequise && remuneration !== null ? caisseLocale(livrees, caisse.livreurGardeRemuneration ? remuneration : 0) : null);
  const aRemettre = c ? Math.max(0, c.aVerser - c.ecartCumule) : caisse ? 0 : null;
  const gains = remuneration !== null ? livrees.length * remuneration : null;
  const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full space-y-5">
        <div className="space-y-1">
          <Link href="/driver" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" />
            <span>Mes courses</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Mon portefeuille</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Carte icone={<Truck className="w-4 h-4" />} titre="Livraisons effectuées" note="Remises confirmées par le code du client">
            {livrees.length}
          </Carte>
          <Carte icone={<Banknote className="w-4 h-4" />} titre="À remettre à Suguba"
            note={c && c.garde > 0 ? `${fmt(c.especes)} encaissés, ${fmt(c.garde)} gardés pour vous` : 'Espèces encaissées pas encore versées'} accent>
            {aRemettre !== null ? fmt(aRemettre) : <span className="inline-block h-7 w-24 rounded-lg bg-slate-700 animate-pulse align-middle" />}
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
          <h2 className="font-bold text-sm text-slate-900">Remettre les espèces</h2>
          <p className="text-sm text-slate-600">
            {c?.bloque && (
              <span className="block mb-1 font-bold text-rose-700">{c.raison} Versez vos espèces à Suguba pour recevoir de nouvelles courses payées en espèces.</span>
            )}
            {caisse?.livreurGardeRemuneration === false
              ? 'Remettez toutes les espèces encaissées à la caisse Suguba. Votre rémunération vous est payée à part.'
              : 'Remettez les espèces encaissées à la caisse Suguba, moins votre rémunération par course, que vous gardez.'}
            {' '}À chaque versement, vous recevez un reçu.
          </p>
          {c && (c.commandes.length > 0 || c.ecartCumule !== 0) && (
            <div className="rounded-2xl bg-slate-50 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>{c.commandes.length} commande{c.commandes.length > 1 ? 's' : ''} payée{c.commandes.length > 1 ? 's' : ''} en espèces</span><span>{fmt(c.especes)}</span></div>
              {c.garde > 0 && <div className="flex justify-between text-slate-600"><span>Votre rémunération gardée</span><span>− {fmt(c.garde)}</span></div>}
              {c.ecartCumule < 0 && <div className="flex justify-between text-rose-700"><span>Manque sur un versement précédent</span><span>+ {fmt(-c.ecartCumule)}</span></div>}
              {c.ecartCumule > 0 && <div className="flex justify-between text-emerald-700"><span>Avance déjà versée</span><span>− {fmt(c.ecartCumule)}</span></div>}
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1"><span>À remettre</span><span>{fmt(aRemettre || 0)}</span></div>
            </div>
          )}
          {c && c.versements.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-700">Mes versements</p>
              {c.versements.slice(0, 10).map((v) => (
                <button key={v.id} type="button" onClick={() => setRecuVersement(v)}
                  className="w-full min-h-11 flex justify-between items-center gap-2 text-sm rounded-xl hover:bg-slate-50 px-2 text-left">
                  <span className="min-w-0 truncate text-slate-700 inline-flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 shrink-0 text-slate-500" />
                    {new Date(v.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {v.remittanceNumber}
                  </span>
                  <span className="font-semibold text-slate-900 shrink-0">{fmt(v.amountReceived)}</span>
                </button>
              ))}
            </div>
          )}
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
          <h2 className="font-bold text-sm text-slate-900">Mes livraisons ({livrees.length})</h2>
          {livrees.length === 0 ? (
            <EmptyState icon={Package} title="Aucune livraison effectuée pour le moment." />
          ) : (
            <div className="divide-y divide-slate-100">
              {livrees.map((o) => (
                <div key={o.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{o.productName}</p>
                    <p className="text-xs text-slate-500">
                      #{o.orderNumber} · {o.neighborhood}
                      {o.deliveredAt ? ` · ${new Date(o.deliveredAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{fmt(o.totalAmount)}</p>
                      <p className={`text-xs font-bold ${o.paymentMethod === 'mobile_money' ? 'text-slate-500' : 'text-emerald-700'}`}>
                        {o.paymentMethod === 'mobile_money' ? 'Payé en ligne' : 'Encaissé'}
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
      <RecuVersementModal versement={recuVersement} nomLivreur={c?.nom || 'Livreur'} onClose={() => setRecuVersement(null)} />

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
        <span className="text-xs font-bold uppercase">{titre}</span>
      </div>
      <p className={`text-2xl font-bold ${accent ? 'text-white' : 'text-slate-900'}`}>{children}</p>
      <p className={`text-xs ${accent ? 'text-slate-300' : 'text-slate-500'}`}>{note}</p>
    </div>
  );
}
