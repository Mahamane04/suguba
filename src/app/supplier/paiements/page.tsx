'use client';

import SugubaLoader from '@/components/ui/SugubaLoader';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Lock, Package, Send } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import FormulaireRetrait from '@/components/retraits/FormulaireRetrait';
import HistoriqueRetraits from '@/components/retraits/HistoriqueRetraits';
import { PayoutCheckout, payoutSessionStorage } from '@/lib/payout-submit';
import { useSugubaStore } from '@/lib/store';
import type { TauxRetrait } from '@/lib/pricing';
import { etatGain, type SoldeFournisseur } from '@/lib/gains-fournisseur';
import { tauxRetraitPublics, type RetraitAffiche } from '@/lib/retraits-affichage';
import { formatF, FORMAT_DATE } from '@/lib/montant';

interface GainAffiche {
  id: string;
  commande: string | null;
  produit: string | null;
  quantite: number;
  livreeLe: string | null;
  montant: number;
  statut: string;
  disponibleLe: string | null;
}

const enF = formatF;
const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', FORMAT_DATE.jour);

const TON_ETAT: Record<string, string> = {
  disponible: 'bg-suguba-brand/10 text-suguba-brand-dark',
  bloque: 'bg-slate-100 text-slate-600',
  attente_fonds: 'bg-amber-50 text-amber-800',
  en_retrait: 'bg-amber-50 text-amber-800',
  verse: 'bg-slate-100 text-slate-700',
  annule: 'bg-rose-50 text-rose-700',
};

/**
 * Paiements du fournisseur (lot C, 2026-09-27).
 *
 * Avant : le fournisseur voyait ses commandes, jamais ce que Suguba lui
 * devait, et n'avait aucun moyen de demander son argent. Désormais chaque
 * commande livrée crédite son solde (/api/supplier/gains) ; il le retire par
 * Mobile Money ou au guichet (/api/supplier/retraits), avec le même
 * récapitulatif de frais que les revendeurs, et l'équipe le paie depuis
 * « Retraits ».
 */
export default function SupplierPaiementsPage() {
  const state = useSugubaStore();
  const checkout = useMemo(
    () => new PayoutCheckout(`suguba_retrait_fournisseur:${state.currentUser.id}`, payoutSessionStorage, undefined, '/api/supplier/retraits'),
    [state.currentUser.id],
  );
  const [chargement, setChargement] = useState(true);
  const [refus, setRefus] = useState('');
  const [actif, setActif] = useState(true);
  const [soldes, setSoldes] = useState<SoldeFournisseur | null>(null);
  const [delaiJours, setDelaiJours] = useState<number | null>(null);
  const [gains, setGains] = useState<GainAffiche[]>([]);
  const [retraits, setRetraits] = useState<RetraitAffiche[]>([]);
  const [telephone, setTelephone] = useState('');
  const [retraitMinimum, setRetraitMinimum] = useState(5000);
  const [taux, setTaux] = useState<TauxRetrait | null>(null);

  const charger = useCallback(async () => {
    const [res, reglages] = await Promise.all([
      fetch('/api/supplier/gains', { cache: 'no-store' }).catch(() => null),
      fetch('/api/settings/public').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    const json = res ? await res.json().catch(() => null) : null;
    if (!res || !res.ok) {
      setRefus(res?.status === 403
        ? 'Seul le propriétaire du compte fournisseur voit le solde et demande les retraits.'
        : json?.error || 'Solde illisible pour le moment. Réessayez dans un instant.');
    } else {
      setRefus('');
      setActif(json.actif !== false);
      setSoldes(json.soldes || null);
      setDelaiJours(Number.isFinite(Number(json.delaiJours)) ? Number(json.delaiJours) : null);
      setGains(Array.isArray(json.gains) ? json.gains : []);
      setRetraits(Array.isArray(json.retraits) ? json.retraits : []);
      setTelephone(json.telephone || '');
    }
    if (reglages?.retraitMinimum) setRetraitMinimum(Number(reglages.retraitMinimum));
    const t = tauxRetraitPublics(reglages);
    if (t) setTaux(t);
    setChargement(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const disponible = soldes?.disponible ?? 0;

  return (
    // REV-14 (lot 6 de l'audit UI/UX du 2026-10-02) : coquille commune des espaces.
    <PageReseau titre="Mes paiements"
      sousTitre="Ce que Suguba vous doit pour vos commandes livrées, et son retrait par Mobile Money ou en espèces au guichet."
      retour={{ href: '/supplier', libelle: 'Espace fournisseur' }}>
        {chargement ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 flex justify-center" aria-busy="true">
            <SugubaLoader className="w-6 h-6 text-slate-400" />
          </div>
        ) : refus ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-5 flex items-start gap-3">
            <Lock className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">{refus}</p>
          </div>
        ) : !actif ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-5 text-sm text-slate-700">
            Votre solde fournisseur s&apos;affichera ici dès l&apos;ouverture des paiements fournisseurs. Vos commandes restent visibles dans « Commandes ».
          </div>
        ) : (
          <>
            {/* Soldes */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-600">Disponible au retrait</p>
                <p className="text-3xl font-bold text-slate-900 tabular-nums">{enF(disponible)}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 sm:col-span-1 rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />En attente</p>
                  <p className="text-lg font-bold text-slate-900 tabular-nums">{enF((soldes?.enAttente ?? 0) + (soldes?.attenteFonds ?? 0))}</p>
                  <p className="text-xs text-slate-500">
                    {soldes?.prochainDeblocage ? `Prochain montant disponible le ${jour(soldes.prochainDeblocage)}` : 'Délai de sécurité après la livraison'}
                  </p>
                  {(soldes?.attenteFonds ?? 0) > 0 && (
                    <p className="text-xs text-amber-800 mt-1">
                      Dont {enF(soldes?.attenteFonds ?? 0)} en attente de l&apos;argent de la livraison (vente payée en espèces).
                    </p>
                  )}
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Send className="w-3.5 h-3.5" />En cours de retrait</p>
                  <p className="text-lg font-bold text-slate-900 tabular-nums">{enF(soldes?.enRetrait ?? 0)}</p>
                  <p className="text-xs text-slate-500">Demandé, pas encore versé</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Déjà versé</p>
                  <p className="text-lg font-bold text-slate-900 tabular-nums">{enF(soldes?.verse ?? 0)}</p>
                  <p className="text-xs text-slate-500">Depuis l&apos;ouverture des paiements</p>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                À chaque commande livrée, ce qui vous revient s&apos;ajoute ici. Il devient retirable
                {delaiJours !== null ? ` ${delaiJours} jour${delaiJours > 1 ? 's' : ''}` : ' quelques jours'} après la livraison
                (le temps d&apos;un éventuel retour), et dès que Suguba a reçu l&apos;argent d&apos;une vente payée en espèces.
              </p>
            </div>

            {/* FOU-09 (lot 7 de l'audit UI/UX du 2026-10-02) : le formulaire s'affichait à
                0 F, bouton grisé ; comme chez le revendeur, il n'apparaît qu'avec un solde
                suffisant (ou une demande interrompue à reprendre). */}
            {!chargement && disponible < retraitMinimum && !checkout.restore() ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-1">
                <h2 className="text-base font-bold text-slate-900">Prochain retrait</h2>
                <p className="text-sm text-slate-600">
                  Le retrait est possible à partir de {formatF(retraitMinimum)} disponibles. Il manque {formatF(Math.max(0, retraitMinimum - disponible))}.
                </p>
              </div>
            ) : <FormulaireRetrait
              role="fournisseur"
              titre="Retirer mon argent"
              checkout={checkout}
              disponible={disponible}
              retraitMinimum={retraitMinimum}
              taux={taux}
              chargement={chargement}
              telephoneParDefaut={telephone || state.currentUser.phone}
              onEnregistre={charger}
            />}

            {/* Détail par commande */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
              <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-slate-500" />
                <span>Commandes livrées</span>
              </h2>
              {gains.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune commande livrée pour le moment. Chaque livraison ajoutera son montant ici.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {gains.map((g) => {
                    const e = etatGain({ amount: g.montant, status: g.statut, unlock_at: g.disponibleLe });
                    return (
                      <div key={g.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`text-sm font-bold text-slate-900 truncate ${e.code === 'annule' ? 'line-through text-slate-500' : ''}`}>
                            {g.produit || `Commande ${g.commande || ''}`}{g.quantite > 1 ? ` ×${g.quantite}` : ''}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {g.commande && <span className="font-mono">{g.commande}</span>}
                            {g.livreeLe && ` · livrée le ${jour(g.livreeLe)}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <p className="text-sm font-bold text-slate-900 tabular-nums">{enF(g.montant)}</p>
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${TON_ETAT[e.code]}`}>{e.libelle}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <HistoriqueRetraits retraits={retraits} />
          </>
        )}
    </PageReseau>
  );
}
