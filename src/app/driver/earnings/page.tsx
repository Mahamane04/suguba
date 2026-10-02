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
import { LIBELLE_ENCAISSEMENT, statutEncaissement, type Versement } from '@/lib/caisse-livreur';
import { useCaisseLivreur } from '@/lib/useCaisseLivreur';
import { ArrowLeft, Banknote, Package, Printer, Receipt, Truck, Wallet } from 'lucide-react';
import { formatF, FORMAT_DATE } from '@/lib/montant';
import LigneListe from '@/components/ui/LigneListe';
import Button from '@/components/ui/Button';

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
  const [recuVersement, setRecuVersement] = useState<Versement | null>(null);

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
  // Le montant à remettre vient de /api/driver/caisse (commandes non payées en
  // Mobile Money et pas encore versées), par le même hook que l'accueil /driver
  // (LIV-01, audit UI/UX du 2026-10-02). L'ancien calcul reposait sur
  // `paymentCollected`, que le code de remise passe à vrai pour TOUTES les
  // commandes : le total restait à 0 F (corrigé le 2026-09-25).
  const { caisse: c, caisseServeur, aRemettre, etat: etatCaisse, livreurGardeRemuneration } = useCaisseLivreur(livrees, remuneration);
  const gains = remuneration !== null ? livrees.length * remuneration : null;
  const fmt = formatF;

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
            {aRemettre !== null ? fmt(aRemettre) : etatCaisse === 'erreur' ? '—' : <span className="inline-block h-7 w-24 rounded-lg bg-slate-700 animate-pulse align-middle" role="status" aria-label="Chargement du montant" />}
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
            {!livreurGardeRemuneration
              ? 'Remettez toutes les espèces encaissées à la caisse Suguba. Votre rémunération vous est payée à part.'
              : 'Remettez les espèces encaissées à la caisse Suguba, moins votre rémunération par course, que vous gardez.'}
            {' '}À chaque versement, vous recevez un reçu.
          </p>
          {/* LIV-03 (audit UI/UX du 2026-10-02) : l'étape finale du métier ne disait
              pas comment la réussir. Pas de lieu écrit en dur (l'ancienne adresse était
              inventée) : Suguba indique le lieu et l'heure du jour sur WhatsApp. */}
          {aRemettre !== null && aRemettre > 0 && (
            <ol className="space-y-2 text-sm text-slate-800">
              <li className="flex gap-3"><span className="w-6 h-6 shrink-0 rounded-full bg-suguba-menthe text-suguba-profond font-bold text-xs flex items-center justify-center">1</span><span>Comptez <strong className="tabular-nums">{fmt(aRemettre)}</strong>.</span></li>
              <li className="flex gap-3"><span className="w-6 h-6 shrink-0 rounded-full bg-suguba-menthe text-suguba-profond font-bold text-xs flex items-center justify-center">2</span><span>Demandez à Suguba sur WhatsApp où et quand verser aujourd’hui.</span></li>
              <li className="flex gap-3"><span className="w-6 h-6 shrink-0 rounded-full bg-suguba-menthe text-suguba-profond font-bold text-xs flex items-center justify-center">3</span><span>Le caissier vous remet un reçu de versement : il apparaît ici, dans « Mes versements ».</span></li>
            </ol>
          )}
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
                    {new Date(v.createdAt).toLocaleDateString('fr-FR', FORMAT_DATE.jour)} · {v.remittanceNumber}
                  </span>
                  <span className="font-semibold text-slate-900 shrink-0">{fmt(v.amountReceived)}</span>
                </button>
              ))}
            </div>
          )}
          <Button
            variant="whatsapp"
            href={`https://wa.me/22389460000?text=${encodeURIComponent(aRemettre ? `Bonjour Suguba, je suis livreur : où et quand puis-je verser ${fmt(aRemettre)} aujourd’hui ?` : 'Bonjour Suguba, je suis livreur et j’ai une question sur mon portefeuille.')}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon className="w-5 h-5" />
            {aRemettre ? 'Demander où verser' : 'Contacter Suguba'}
          </Button>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
          <h2 className="font-bold text-sm text-slate-900">Mes livraisons ({livrees.length})</h2>
          {livrees.length === 0 ? (
            <EmptyState icon={Package} title="Aucune livraison effectuée pour le moment." />
          ) : (
            <div className="divide-y divide-slate-100">
              {livrees.map((o) => {
                const statut = statutEncaissement(o, caisseServeur);
                return (
                  <LigneListe key={o.id}
                    titre={o.productName}
                    meta={<>#{o.orderNumber} · {o.neighborhood}{o.deliveredAt ? ` · ${new Date(o.deliveredAt).toLocaleDateString('fr-FR', FORMAT_DATE.jour)}` : ''}</>}
                    valeur={fmt(o.totalAmount)}
                    statut={<span className={statut === 'a_remettre' ? 'text-amber-800' : 'text-slate-600'}>{LIBELLE_ENCAISSEMENT[statut]}</span>}
                    action={
                      <button
                        type="button"
                        onClick={() => setRecuPour(o)}
                        aria-label={`Reçu de la commande ${o.orderNumber}`}
                        className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    }
                  />
                );
              })}
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
