'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Button from '@/components/ui/Button';
import { useSugubaStore } from '@/lib/store';
import { Wallet, Clock, CheckCircle2, History, AlertCircle, Building2, Loader2 } from 'lucide-react';

type Moyen = 'Orange Money' | 'Moov Money' | 'Mobi Cash' | 'Agence Suguba';

interface Retrait {
  id: string;
  montant: number;
  moyen: string;
  telephone: string;
  statut: string;
  reference: string | null;
  creeLe: string;
}

const MOYENS: { id: Moyen; libelle: string; detail: string }[] = [
  { id: 'Orange Money', libelle: 'Orange Money', detail: 'Virement' },
  { id: 'Moov Money', libelle: 'Moov Money', detail: 'Virement' },
  { id: 'Mobi Cash', libelle: 'Mobi Cash', detail: 'Virement' },
  { id: 'Agence Suguba', libelle: 'Espèces', detail: 'Au guichet' },
];

const STATUTS: Record<string, { libelle: string; classe: string }> = {
  pending: { libelle: 'En attente', classe: 'bg-amber-50 text-amber-800' },
  processing: { libelle: 'Virement en cours', classe: 'bg-amber-50 text-amber-800' },
  completed: { libelle: 'Versé', classe: 'bg-suguba-brand/10 text-suguba-brand' },
  rejected: { libelle: 'Refusé', classe: 'bg-rose-50 text-rose-700' },
};

const enF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

/** « WTH-7K2Q9M » : 30 symboles sans ambiguïté visuelle (pas de 0/O, 1/I). */
function codeRetrait(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `WTH-${code}`;
}

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
 * Retrait en espèces : le numéro du retrait (WTH-…), enregistré en base, sert
 * de référence au guichet. L'ancien « code guichet » était généré dans le
 * navigateur et enregistré nulle part : le guichet n'aurait rien pu vérifier.
 */
export default function ResellerPayoutsPage() {
  const state = useSugubaStore();
  const [soldes, setSoldes] = useState<{ disponible: number; attente: number; verse: number } | null>(null);
  const [retraits, setRetraits] = useState<Retrait[]>([]);
  const [retraitMinimum, setRetraitMinimum] = useState(5000);
  const [chargement, setChargement] = useState(true);

  const [moyen, setMoyen] = useState<Moyen>('Orange Money');
  const [telephone, setTelephone] = useState('');
  const [montant, setMontant] = useState<number>(0);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState<{ code: string; montant: number; moyen: Moyen; telephone: string } | null>(null);

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
      verse: Number(r?.totalEarned) || 0,
    });
    setRetraits(Array.isArray(hist?.retraits) ? hist.retraits : []);
    if (reglages?.retraitMinimum) setRetraitMinimum(Number(reglages.retraitMinimum));
    setChargement(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Numéro de la personne connectée par défaut, dès qu'il est connu.
  useEffect(() => {
    if (!telephone && state.currentUser.phone) setTelephone(state.currentUser.phone);
  }, [state.currentUser.phone, telephone]);

  const disponible = soldes?.disponible ?? 0;
  const assez = disponible >= retraitMinimum;

  const demander = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');
    if (montant < retraitMinimum) { setErreur(`Le minimum de retrait est de ${enF(retraitMinimum)}.`); return; }
    if (montant > disponible) { setErreur('Ce montant dépasse votre solde disponible.'); return; }
    if (telephone.replace(/\D/g, '').length < 8) { setErreur('Indiquez un numéro valide.'); return; }

    setEnvoi(true);
    const code = codeRetrait();
    try {
      const res = await fetch('/api/payouts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawalCode: code,
          resellerName: state.currentUser.fullName || undefined,
          amount: montant,
          payoutProvider: moyen,
          payoutPhone: telephone,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setErreur(json.error || "La demande n'a pas pu être enregistrée.");
        return;
      }
      setSucces({ code, montant, moyen, telephone });
      setMontant(0);
      await charger();
    } catch {
      setErreur('Erreur réseau, réessayez.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-6 w-full space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Mes gains</h1>
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
              <p className="text-[11px] font-bold text-slate-500 uppercase">Disponible au retrait</p>
              <p className="text-3xl font-black text-slate-900">{enF(disponible)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1"><Clock className="w-3.5 h-3.5" />En attente</p>
                <p className="text-lg font-black text-slate-900">{enF(soldes?.attente ?? 0)}</p>
                <p className="text-[11px] text-slate-500">Disponible après le délai de sécurité qui suit la livraison</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Déjà versé</p>
                <p className="text-lg font-black text-slate-900">{enF(soldes?.verse ?? 0)}</p>
                <p className="text-[11px] text-slate-500">Depuis votre inscription</p>
              </div>
            </div>
          </div>
        )}

        {/* Retrait */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-black text-base text-slate-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-suguba-brand" />
            <span>Retirer mes gains</span>
          </h2>

          {succes ? (
            <div className="rounded-2xl bg-suguba-brand/5 border border-suguba-brand/20 p-5 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-suguba-brand mx-auto" />
              {succes.moyen === 'Agence Suguba' ? (
                <>
                  <p className="font-black text-slate-900">Retrait de {enF(succes.montant)} enregistré</p>
                  <p className="text-sm text-slate-600">
                    Présentez ce numéro au guichet Suguba (Hamdallaye ACI 2000, Bamako), avec votre pièce d&apos;identité :
                  </p>
                  <p className="font-mono text-2xl font-black text-slate-900 tracking-wider">{succes.code}</p>
                </>
              ) : (
                <>
                  <p className="font-black text-slate-900">Demande de {enF(succes.montant)} envoyée</p>
                  <p className="text-sm text-slate-600">
                    Virement vers {succes.moyen} ({succes.telephone}). Suivez son état dans l&apos;historique ci-dessous.
                  </p>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSucces(null)}>Faire une autre demande</Button>
            </div>
          ) : (
            <form onSubmit={demander} className="space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-700 mb-2">Comment voulez-vous recevoir l&apos;argent ?</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {MOYENS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMoyen(m.id)}
                      className={`p-3 rounded-2xl border text-center transition-colors ${
                        moyen === m.id ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block text-sm font-bold text-slate-900">{m.libelle}</span>
                      <span className="block text-[11px] text-slate-500">{m.detail}</span>
                    </button>
                  ))}
                </div>
              </div>

              {moyen === 'Agence Suguba' && (
                <p className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>Vous recevrez un numéro de retrait à présenter au guichet Suguba de Hamdallaye ACI 2000, avec votre pièce d&apos;identité.</span>
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-bold text-slate-700">
                  {moyen === 'Agence Suguba' ? 'Votre numéro de téléphone' : `Numéro ${moyen}`}
                  <input
                    type="tel"
                    inputMode="tel"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="76 12 34 56"
                    className="mt-1 w-full h-12 px-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-base font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-suguba-brand/30 focus:border-suguba-brand"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  <span className="flex items-center justify-between">
                    <span>Montant (F)</span>
                    {disponible > 0 && (
                      <button type="button" onClick={() => setMontant(disponible)} className="text-[11px] font-bold text-suguba-brand">
                        Tout retirer
                      </button>
                    )}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={500}
                    value={montant || ''}
                    onChange={(e) => setMontant(parseInt(e.target.value) || 0)}
                    placeholder={String(retraitMinimum)}
                    className="mt-1 w-full h-12 px-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-base font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-suguba-brand/30 focus:border-suguba-brand"
                  />
                  <span className="text-[11px] font-normal text-slate-500 mt-1 block">Minimum {enF(retraitMinimum)}</span>
                </label>
              </div>

              {erreur && (
                <p className="rounded-2xl bg-rose-50 border border-rose-100 p-3 text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />{erreur}
                </p>
              )}

              <Button type="submit" size="lg" fullWidth disabled={envoi || chargement || !assez}>
                {envoi ? 'Envoi…' : moyen === 'Agence Suguba' ? 'Obtenir mon numéro de retrait' : 'Demander le virement'}
              </Button>
              {!chargement && !assez && (
                <p className="text-[11px] text-slate-500 text-center">
                  Vous pourrez retirer dès que votre solde disponible atteint {enF(retraitMinimum)}.
                </p>
              )}
            </form>
          )}
        </div>

        {/* Historique */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-black text-base text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" />
            <span>Historique des retraits</span>
          </h2>
          {retraits.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Aucun retrait pour le moment.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {retraits.map((r) => {
                const s = STATUTS[r.statut] || { libelle: r.statut, classe: 'bg-slate-100 text-slate-600' };
                return (
                  <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{enF(r.montant)} · {r.moyen}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {new Date(r.creeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}<span className="font-mono">{r.id}</span>
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${s.classe}`}>{s.libelle}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
