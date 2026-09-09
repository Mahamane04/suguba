'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Smartphone, ShieldCheck, Loader2, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';

/**
 * Paiement mobile money d'une commande, via SasPay.
 *
 * Remplace l'ancien desk manuel (codes USSD à recopier + lien Wave vers le
 * numéro marchand) : celui-ci n'encaissait rien automatiquement — personne
 * ne savait, côté Suguba, si le client avait payé ou non, et le livreur
 * pouvait réclamer une somme déjà réglée.
 *
 * ⚠️ Wave a disparu des options : SasPay ne couvre pas Wave au Mali. Ne pas
 * le rajouter ici, un code réseau inconnu fait échouer l'appel côté SasPay.
 *
 * Deux issues, décidées par SasPay et pas par nous :
 *  - une `urlCheckout` est renvoyée → on redirige (cas normal d'Orange
 *    Money) ; sans redirection, aucun paiement n'aura lieu ;
 *  - sinon, une demande arrive sur le téléphone du client et on sonde le
 *    statut jusqu'à la validation.
 */

const RESEAUX = [
  { code: 'orange_ml', label: 'Orange Money', couleur: 'bg-orange-500' },
  { code: 'moov_ml', label: 'Moov Money', couleur: 'bg-blue-600' },
  { code: 'mobi_cash_ml', label: 'Mobi Cash', couleur: 'bg-emerald-600' },
] as const;

type CodeReseau = (typeof RESEAUX)[number]['code'];
type Etape = 'saisie' | 'envoi' | 'attente' | 'paye' | 'echec';

interface Props {
  amount: number;
  orderNumber: string;
  /** Numéro pré-rempli, quand la commande en connaît déjà un. */
  defaultPhone?: string;
}

export default function SasPayPaymentDesk({ amount, orderNumber, defaultPhone = '' }: Props) {
  const [reseau, setReseau] = useState<CodeReseau>('orange_ml');
  const [telephone, setTelephone] = useState(defaultPhone);
  const [etape, setEtape] = useState<Etape>('saisie');
  const [erreur, setErreur] = useState('');
  const sondage = useRef<ReturnType<typeof setInterval> | null>(null);

  const arreterSondage = useCallback(() => {
    if (sondage.current) {
      clearInterval(sondage.current);
      sondage.current = null;
    }
  }, []);

  // Sans ce nettoyage, quitter la page pendant l'attente laisserait un
  // intervalle tourner indéfiniment contre l'API.
  useEffect(() => arreterSondage, [arreterSondage]);

  useEffect(() => {
    if (etape !== 'attente') return;

    sondage.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/saspay/status?orderNumber=${encodeURIComponent(orderNumber)}`);
        const json = await res.json();
        if (json.paye) {
          arreterSondage();
          setEtape('paye');
        } else if (json.statut === 'FAILED' || json.statut === 'CANCELLED') {
          arreterSondage();
          setErreur('Le paiement n\'a pas abouti. Vous pouvez réessayer.');
          setEtape('echec');
        }
      } catch {
        // Réseau instable : on retentera au tick suivant plutôt que
        // d'annoncer un échec de paiement qui n'a peut-être pas eu lieu.
      }
    }, 4000);

    return arreterSondage;
  }, [etape, orderNumber, arreterSondage]);

  const payer = async () => {
    setErreur('');

    const numero = telephone.trim();
    if (numero.replace(/\D/g, '').length < 8) {
      setErreur('Entrez le numéro de téléphone qui va payer.');
      return;
    }

    setEtape('envoi');
    try {
      const res = await fetch('/api/payments/saspay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Le montant n'est pas transmis : il est relu en base côté serveur.
        body: JSON.stringify({ orderNumber, network: reseau, phone: numero }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setErreur(json.error || 'Impossible de démarrer le paiement. Réessayez.');
        setEtape('echec');
        return;
      }

      if (json.urlCheckout) {
        // Aucun push ne partira sur le téléphone : la redirection est le
        // paiement. Ne jamais rester sur cette page en croyant attendre.
        window.location.href = json.urlCheckout;
        return;
      }

      setEtape('attente');
    } catch {
      setErreur('Erreur réseau. Vérifiez votre connexion et réessayez.');
      setEtape('echec');
    }
  };

  if (etape === 'paye') {
    return (
      <div className="bg-emerald-50 rounded-3xl p-5 sm:p-6 border border-emerald-200 text-left">
        <div className="flex items-center space-x-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
          <div>
            <h3 className="font-black text-sm text-emerald-900">Paiement reçu</h3>
            <p className="text-[11px] text-emerald-700">
              Commande #{orderNumber} réglée. Le livreur ne vous redemandera rien.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm text-left space-y-5">

      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">Payer maintenant par Mobile Money</h3>
            <p className="text-[11px] text-slate-500">
              Montant : <strong className="text-emerald-700 font-bold font-mono">{amount.toLocaleString('fr-FR')} FCFA</strong>
            </p>
          </div>
        </div>
      </div>

      {etape === 'attente' ? (
        <div className="space-y-3 py-2">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-6 h-6 text-emerald-600 animate-spin shrink-0" />
            <div>
              <p className="font-bold text-xs text-slate-900">Validez sur votre téléphone</p>
              <p className="text-[11px] text-slate-500">
                Une demande de paiement vient d&apos;être envoyée au {telephone}. Tapez votre code secret pour confirmer.
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Cet écran se met à jour tout seul dès que le paiement est confirmé. Ne fermez pas la page.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Votre réseau</label>
            <div className="grid grid-cols-3 gap-2">
              {RESEAUX.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => setReseau(r.code)}
                  className={`py-2.5 px-2 rounded-2xl text-[11px] font-bold border transition-colors ${
                    reseau === r.code
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full mr-1.5 align-middle ${r.couleur}`} />
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="saspay-tel" className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
              Numéro qui paie
            </label>
            <input
              id="saspay-tel"
              type="tel"
              inputMode="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="Ex : 70 00 00 00"
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-slate-900"
            />
          </div>

          {erreur && (
            <div className="flex items-start space-x-2 bg-red-50 border border-red-200 rounded-2xl p-3">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-800 font-medium">{erreur}</p>
            </div>
          )}

          <button
            type="button"
            onClick={payer}
            disabled={etape === 'envoi'}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black py-3.5 px-4 rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-xs transition-colors"
          >
            {etape === 'envoi' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Envoi en cours…</span>
              </>
            ) : (
              <>
                <span>Payer {amount.toLocaleString('fr-FR')} FCFA</span>
                <ArrowUpRight className="w-4 h-4" />
              </>
            )}
          </button>
        </>
      )}

      <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 pt-1 border-t border-slate-100">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span>Paiement sécurisé. Suguba ne voit jamais votre code secret.</span>
      </div>
    </div>
  );
}
