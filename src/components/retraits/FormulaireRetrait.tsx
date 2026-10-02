'use client';


import React, { useEffect, useState } from 'react';
import { AlertCircle, Building2, Check, CheckCircle2, Wallet } from 'lucide-react';
import Button from '@/components/ui/Button';
import PaymentLogo, { moyenDepuisCode } from '@/components/ui/PaymentLogo';
import type { PayoutCheckout } from '@/lib/payout-submit';
import { calculerFraisRetrait, tauxRetraitSuguba, type DetailFraisRetrait, type RoleRetrait, type TauxRetrait } from '@/lib/pricing';
import { estimerRetraitAgent, type OperateurRetrait } from '@/lib/frais-paiement';
import { CODE_MOYEN_RETRAIT } from '@/lib/retraits-affichage';
import { formatF } from '@/lib/montant';

type Moyen = 'Orange Money' | 'Moov Money' | 'Wave' | 'Agence Suguba';

/** Opérateur Mobile Money de chaque moyen (pour estimer un retrait chez un agent). */
const OPERATEUR_DU_MOYEN: Record<Moyen, OperateurRetrait | null> = {
  'Orange Money': 'orange_ml',
  'Moov Money': 'moov_ml',
  'Wave': 'wave_ml',
  'Agence Suguba': null,
};

const MOYENS: { id: Moyen; libelle: string; detail: string }[] = [
  { id: 'Orange Money', libelle: 'Orange Money', detail: 'Virement' },
  { id: 'Moov Money', libelle: 'Moov Money', detail: 'Virement' },
  // Wave (2026-09-27) : versement SasPay disponible au Mali.
  { id: 'Wave', libelle: 'Wave', detail: 'Virement' },
  { id: 'Agence Suguba', libelle: 'Espèces', detail: 'Au guichet' },
];

const enPct = (n: number) => `${String(n).replace('.', ',')} %`;
const enF = formatF;

/**
 * Demande de retrait — commune au revendeur et au fournisseur (lot C,
 * 2026-09-27). Seuls changent les taux (`role`) et la route appelée (portée
 * par `checkout`) : le récapitulatif, les frais et le reçu sont les mêmes.
 *
 * Retrait en espèces : le numéro du retrait (WTH-…), enregistré en base, sert
 * de référence au guichet.
 */
export default function FormulaireRetrait({
  role, checkout, disponible, retraitMinimum, taux, chargement, telephoneParDefaut, titre, onEnregistre,
}: {
  role: RoleRetrait;
  checkout: PayoutCheckout;
  disponible: number;
  retraitMinimum: number;
  taux: TauxRetrait | null;
  chargement: boolean;
  telephoneParDefaut?: string;
  titre: string;
  onEnregistre: () => Promise<void> | void;
}) {
  const [moyen, setMoyen] = useState<Moyen>('Orange Money');
  const [telephone, setTelephone] = useState('');
  const [montant, setMontant] = useState<number>(0);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState<{ code: string; montant: number; net: number; moyen: Moyen; telephone: string } | null>(null);

  // Numéro de la personne connectée par défaut, dès qu'il est connu.
  useEffect(() => {
    if (!telephone && telephoneParDefaut) setTelephone(telephoneParDefaut);
  }, [telephoneParDefaut, telephone]);

  useEffect(() => {
    const previous = checkout.restore();
    if (previous) {
      setMontant(previous.input.amount); setTelephone(previous.input.payoutPhone); setMoyen(previous.input.payoutProvider as Moyen);
      setErreur('Une demande attend sa confirmation. Reprenez-la avec les mêmes informations.');
    }
  }, [checkout]);

  const assez = disponible >= retraitMinimum || Boolean(checkout.restore());
  const code = CODE_MOYEN_RETRAIT[moyen];
  // Même calcul que le serveur : ce qui est affiché est ce qui sera retenu.
  const frais: DetailFraisRetrait | null = taux && montant > 0 ? calculerFraisRetrait(montant, code, taux, role) : null;
  const tauxSuguba = taux ? tauxRetraitSuguba(taux, role, code) : 0;
  const tauxCaisse = taux ? tauxRetraitSuguba(taux, role, 'cash') : 0;
  // Information : ce que l'opérateur prélèverait sur un retrait d'espèces chez un agent.
  const operateur = OPERATEUR_DU_MOYEN[moyen];
  const agent = taux?.fraisPaiement && operateur && frais ? estimerRetraitAgent(frais.montantNet, operateur, taux.fraisPaiement) : null;

  const demander = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');
    if (montant < retraitMinimum) { setErreur(`Le minimum de retrait est de ${enF(retraitMinimum)}.`); return; }
    if (!checkout.restore() && montant > disponible) { setErreur('Ce montant dépasse votre solde disponible.'); return; }
    if (telephone.replace(/\D/g, '').length < 8) { setErreur('Indiquez un numéro valide.'); return; }

    setEnvoi(true);
    try {
      const json = await checkout.submit({ amount: montant, payoutProvider: moyen, payoutPhone: telephone });
      setSucces({ code: json.withdrawalCode, montant, net: Number(json.frais?.montantNet) || montant, moyen, telephone });
      setMontant(0);
      await onEnregistre();
    } catch (error) {
      setErreur(error instanceof Error ? error.message : 'Erreur réseau, reprenez cette demande.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
      <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
        <Wallet className="w-5 h-5 text-suguba-brand" />
        <span>{titre}</span>
      </h2>

      {succes ? (
        <div className="rounded-2xl bg-suguba-brand/5 border border-suguba-brand/20 p-5 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-suguba-brand mx-auto" />
          {succes.moyen === 'Agence Suguba' ? (
            <>
              <p className="font-bold text-slate-900">Retrait de {enF(succes.montant)} enregistré</p>
              <p className="text-sm text-slate-600">Vous recevrez <strong>{enF(succes.net)}</strong> en espèces, frais déduits.</p>
              <p className="text-sm text-slate-600">
                Présentez ce numéro au guichet Suguba (Hamdallaye ACI 2000, Bamako), avec votre pièce d&apos;identité :
              </p>
              <p className="font-mono text-2xl font-bold text-slate-900 tracking-wider">{succes.code}</p>
            </>
          ) : (
            <>
              <p className="font-bold text-slate-900">Demande de {enF(succes.montant)} envoyée</p>
              <p className="text-sm text-slate-600">
                Vous recevrez <strong>{enF(succes.net)}</strong> sur {succes.moyen} ({succes.telephone}), frais déduits.
                Suivez son état dans l&apos;historique ci-dessous.
              </p>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => setSucces(null)}>Faire une autre demande</Button>
        </div>
      ) : (
        <form onSubmit={demander} className="space-y-4">
          <div>
            <p className="text-xs font-bold text-slate-700 mb-2">Comment voulez-vous recevoir l&apos;argent ?</p>
            <div role="radiogroup" aria-label="Moyen de retrait" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MOYENS.map((m) => {
                const actif = moyen === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={actif}
                    onClick={() => setMoyen(m.id)}
                    className={`relative p-3 rounded-2xl border flex items-center gap-2.5 text-left transition-all ${
                      actif
                        ? 'border-suguba-brand bg-suguba-brand/5 ring-1 ring-suguba-brand'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <PaymentLogo moyen={m.id === 'Agence Suguba' ? 'especes' : moyenDepuisCode(m.id)} taille="md" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-900 leading-tight">{m.libelle}</span>
                      <span className="block text-xs text-slate-500">{m.detail}</span>
                    </span>
                    {actif && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-suguba-brand text-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
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
                  <button type="button" onClick={() => setMontant(disponible)} className="text-xs font-bold text-suguba-brand-dark">
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
              <span className="text-xs font-normal text-slate-500 mt-1 block">Minimum {enF(retraitMinimum)}</span>
            </label>
          </div>

          {frais && (
            // Récapitulatif avant confirmation (audit du 2026-09-27) : ce qui
            // est débité du solde, chaque frais, ce qui est reçu. Les frais
            // sont figés avec la demande.
            <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-700">Avant de confirmer</p>
              <p className="flex justify-between gap-3"><span>Vous retirez de votre solde</span><span className="font-semibold text-slate-900 tabular-nums">{enF(frais.montantDemande)}</span></p>
              <p className="flex justify-between gap-3"><span>Moyen</span><span className="text-right">{moyen === 'Agence Suguba' ? 'Espèces à la caisse Suguba' : `${moyen} (virement)`}</span></p>
              <p className="flex justify-between gap-3"><span>Frais Suguba — {enPct(tauxSuguba)}</span><span className="tabular-nums">− {enF(frais.fraisSuguba)}</span></p>
              <p className="flex justify-between gap-3">
                <span>Autres frais applicables{frais.fraisSaspay > 0 ? ' (virement SasPay)' : ''}</span>
                <span className="tabular-nums">− {enF(frais.fraisSaspay + frais.fraisOperateur)}</span>
              </p>
              <p className="flex justify-between gap-3 pt-1 border-t border-slate-200 text-sm font-bold text-slate-900">
                <span>Vous recevrez</span><span className="tabular-nums">{enF(Math.max(0, frais.montantNet))}</span>
              </p>
              {agent && frais.montantNet > 0 && (
                <p>
                  Si vous retirez ensuite cet argent en espèces chez un agent {moyen}, l&apos;opérateur prélèvera environ{' '}
                  {enF(agent.total)}, dont {enF(agent.fraisEtat)} pour le fonds de soutien de l&apos;État. Suguba n&apos;en touche rien.
                </p>
              )}
              {moyen !== 'Agence Suguba' && (
                <p>À la caisse Suguba, en espèces : frais Suguba seulement ({enPct(tauxCaisse)}).</p>
              )}
            </div>
          )}

          {erreur && (
            <p role="alert" className="rounded-2xl bg-rose-50 border border-rose-100 p-3 text-sm text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />{erreur}
            </p>
          )}

          <Button type="submit" size="lg" fullWidth loading={envoi} disabled={chargement || !assez}>
            {moyen === 'Agence Suguba' ? 'Obtenir mon numéro de retrait' : montant > 0 ? `Demander le virement de ${enF(montant)}` : 'Demander le virement'}
          </Button>
          {!chargement && !assez && (
            <p className="text-xs text-slate-500 text-center">
              Vous pourrez retirer dès que votre solde disponible atteint {enF(retraitMinimum)}.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
