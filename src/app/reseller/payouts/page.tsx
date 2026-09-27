'use client';

import { PayoutCheckout, payoutSessionStorage } from '@/lib/payout-submit';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import FormulaireRetrait from '@/components/retraits/FormulaireRetrait';
import HistoriqueRetraits from '@/components/retraits/HistoriqueRetraits';
import { useSugubaStore } from '@/lib/store';
import { Clock, CheckCircle2, Loader2 } from 'lucide-react';
import type { TauxRetrait } from '@/lib/pricing';
import { tauxRetraitPublics, type RetraitAffiche } from '@/lib/retraits-affichage';

const enF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

/**
 * Gains du revendeur — refaits le 2026-09-11 sur les VRAIES données.
 *
 * L'ancienne page lisait un revendeur de démonstration : un compte sans vente
 * y voyait « Total déjà retiré & reçu : 184 000 FCFA », et la demande de
 * retrait vérifiait le solde de ce faux compte avant d'appeler le serveur.
 * Désormais : soldes du grand-livre (/api/reseller/me), historique réel
 * (/api/reseller/payouts), demande envoyée directement à /api/payouts/create,
 * qui revérifie le solde et le réserve.
 *
 * Le formulaire de retrait et l'historique sont communs avec l'espace
 * fournisseur (lot C, 2026-09-27) : src/components/retraits.
 */
export default function ResellerPayoutsPage() {
  const state = useSugubaStore();
  const checkout = useMemo(() => new PayoutCheckout(`suguba_payout_attempt:${state.currentUser.id}`, payoutSessionStorage), [state.currentUser.id]);
  const [soldes, setSoldes] = useState<{ disponible: number; attente: number; attenteFonds: number; verse: number } | null>(null);
  const [retraits, setRetraits] = useState<RetraitAffiche[]>([]);
  const [retraitMinimum, setRetraitMinimum] = useState(5000);
  const [taux, setTaux] = useState<TauxRetrait | null>(null);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    const [moi, hist, reglages] = await Promise.all([
      fetch('/api/reseller/me').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/reseller/payouts').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/settings/public').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    const r = moi?.reseller;
    setSoldes({
      disponible: Number(r?.availableBalance) || 0,
      attente: Number(r?.pendingBalance) || 0,
      attenteFonds: Number(r?.attenteFondsBalance) || 0,
      verse: Number(r?.totalEarned) || 0,
    });
    setRetraits(Array.isArray(hist?.retraits) ? hist.retraits : []);
    if (reglages?.retraitMinimum) setRetraitMinimum(Number(reglages.retraitMinimum));
    const t = tauxRetraitPublics(reglages);
    if (t) setTaux(t);
    setChargement(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const disponible = soldes?.disponible ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Mes gains</h1>
          <p className="text-xs text-slate-500">Vos commissions, et leur retrait par Mobile Money ou en espèces au guichet.</p>
        </div>

        {/* Soldes */}
        {chargement ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 flex justify-center">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase">Disponible au retrait</p>
              <p className="text-3xl font-bold text-slate-900">{enF(disponible)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Clock className="w-3.5 h-3.5" />En attente</p>
                <p className="text-lg font-bold text-slate-900">{enF(soldes?.attente ?? 0)}</p>
                <p className="text-xs text-slate-500">Disponible après le délai de sécurité qui suit la livraison</p>
                {(soldes?.attenteFonds ?? 0) > 0 && (
                  <p className="text-xs text-amber-800 mt-1">
                    Dont {enF(soldes?.attenteFonds ?? 0)} en attente du versement des espèces à Suguba par le livreur ou le fournisseur.
                  </p>
                )}
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Déjà versé</p>
                <p className="text-lg font-bold text-slate-900">{enF(soldes?.verse ?? 0)}</p>
                <p className="text-xs text-slate-500">Depuis votre inscription</p>
              </div>
            </div>
          </div>
        )}

        <FormulaireRetrait
          role="revendeur"
          titre="Retirer mes gains"
          checkout={checkout}
          disponible={disponible}
          retraitMinimum={retraitMinimum}
          taux={taux}
          chargement={chargement}
          telephoneParDefaut={state.currentUser.phone}
          onEnregistre={charger}
        />

        <HistoriqueRetraits retraits={retraits} />
      </main>

      <BottomNav />
    </div>
  );
}
