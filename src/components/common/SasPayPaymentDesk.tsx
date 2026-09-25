'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, Loader2, CheckCircle2, AlertCircle, Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import PaymentLogo, { type MoyenPaiement } from '@/components/ui/PaymentLogo';

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

// Logo de la marque au-dessus d'un libellé court : « Orange Money » sur trois
// colonnes à 375 px passait à la ligne et cassait l'alignement.
// « À la livraison » en premier et choisi par défaut (2026-09-25) : c'est le
// mode de règlement normal de Suguba, il n'apparaissait qu'en petit texte.
// Mobi Cash retiré : seuls Orange Money et Moov Money sont acceptés.
const RESEAUX: readonly { code: 'livraison' | 'orange_ml' | 'moov_ml'; label: string; moyen: MoyenPaiement }[] = [
  { code: 'livraison', label: 'À la livraison', moyen: 'especes' },
  { code: 'orange_ml', label: 'Orange Money', moyen: 'orange_money' },
  { code: 'moov_ml', label: 'Moov Money', moyen: 'moov_money' },
];

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

type CodeReseau = (typeof RESEAUX)[number]['code'];
type Etape = 'saisie' | 'envoi' | 'attente' | 'paye' | 'echec';

interface Props {
  amount: number;
  orderNumber: string;
  /** Numéro pré-rempli, quand la commande en connaît déjà un. */
  defaultPhone?: string;
}

export default function SasPayPaymentDesk({ amount, orderNumber, defaultPhone = '' }: Props) {
  const [reseau, setReseau] = useState<CodeReseau>('livraison');
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

  // Vérification à l'ouverture : une commande déjà réglée ne doit jamais
  // réafficher un formulaire de paiement. Le composant s'en assure lui-même
  // plutôt que de compter sur chaque page appelante — la page de suivi ne
  // masquait le desk que pour les commandes livrées, donc une commande payée
  // mais pas encore remise proposait de la repayer.
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const res = await fetch(`/api/payments/saspay/status?orderNumber=${encodeURIComponent(orderNumber)}`);
        const json = await res.json();
        if (!annule && json.paye) setEtape('paye');
      } catch {
        // Hors ligne ou API indisponible : on laisse le formulaire. Au pire le
        // client tente un paiement, que la route refusera en 409 « déjà payée ».
      }
    })();
    return () => { annule = true; };
  }, [orderNumber]);

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
    if (reseau === 'livraison') return;

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
      // Moment de plus forte réassurance du parcours : le client vient de se
      // séparer d'une somme importante. Le montant réglé doit être aussi
      // lisible ici qu'il l'était sur l'écran de paiement, sans quoi il n'a
      // aucune confirmation chiffrée de ce qu'il a payé.
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 text-left space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-full bg-suguba-brand/10 text-suguba-brand-dark flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </span>
          <h3 className="font-bold text-base text-slate-900">Paiement reçu</h3>
        </div>
        <p className="text-3xl font-bold text-slate-900 tabular-nums">{fcfa(amount)}</p>
        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-700">Commande #{orderNumber} réglée.</p>
          <p className="text-xs text-slate-500">Le livreur ne vous redemandera rien à la remise du colis.</p>
        </div>
      </div>
    );
  }

  const choisi = RESEAUX.find((r) => r.code === reseau) || RESEAUX[0];
  const aLaLivraison = reseau === 'livraison';

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 text-left space-y-5">
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-slate-900">Comment voulez-vous payer ?</h3>
        <p className="text-3xl font-bold text-slate-900 tabular-nums">{fcfa(amount)}</p>
        <p className="text-xs text-slate-500">Commande #{orderNumber}</p>
      </div>

      {etape === 'attente' ? (
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
          <div className="flex items-center gap-3">
            <PaymentLogo moyen={choisi.moyen} taille="md" />
            <div className="min-w-0">
              <p className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-suguba-brand-dark animate-spin shrink-0" />
                Validez sur votre téléphone
              </p>
              <p className="text-xs text-slate-500">
                Demande envoyée au {telephone}. Tapez votre code secret {choisi.label} pour confirmer.
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Cet écran se met à jour tout seul dès que le paiement est confirmé. Ne fermez pas la page.
          </p>
        </div>
      ) : (
        <>
          <div role="radiogroup" aria-label="Votre réseau" className="grid grid-cols-3 gap-2">
            {RESEAUX.map((r) => {
              const actif = reseau === r.code;
              return (
                <button
                  key={r.code}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  onClick={() => { setReseau(r.code); setErreur(''); if (etape === 'echec') setEtape('saisie'); }}
                  className={`relative rounded-2xl border p-2.5 pt-3 flex flex-col items-center gap-1.5 transition-all active:scale-[0.98] ${
                    actif
                      ? 'border-suguba-brand bg-suguba-brand/5 ring-1 ring-suguba-brand'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <PaymentLogo moyen={r.moyen} taille="lg" />
                  <span className="text-xs font-bold text-slate-900 leading-tight text-center">{r.label}</span>
                  {actif && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-suguba-profond text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {aLaLivraison ? (
            <div className="rounded-2xl bg-suguba-sauge border border-suguba-brand/20 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-suguba-brand-dark shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900">Rien à payer maintenant</p>
                <p className="text-xs text-slate-600">
                  Vous payez {fcfa(amount)} en espèces au livreur, à la remise du colis, après avoir vérifié l’article.
                </p>
              </div>
            </div>
          ) : (<>
          <Field label={`Numéro ${choisi.label} qui paie`} htmlFor="saspay-tel" erreur={erreur && etape === 'saisie' ? erreur : undefined}>
            <Input
              id="saspay-tel"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="Ex : 70 00 00 00"
            />
          </Field>

          {erreur && etape === 'echec' && (
            <div role="alert" className="flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-2xl p-3">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-rose-700">{erreur}</p>
            </div>
          )}

          <Button type="button" onClick={payer} disabled={etape === 'envoi'} size="lg" fullWidth>
            {etape === 'envoi' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Envoi en cours…</span>
              </>
            ) : (
              <span>Payer par {choisi.label}</span>
            )}
          </Button>

          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-suguba-brand-dark shrink-0" />
            Paiement sécurisé par SasPay. Suguba ne voit jamais votre code secret.
          </p>
          </>)}
        </>
      )}
    </div>
  );
}
