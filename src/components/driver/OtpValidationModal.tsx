'use client';

import React, { useState } from 'react';
import { Order } from '@/types';
import ScannerQr from '@/components/driver/ScannerQr';
import { lireQrRemise } from '@/lib/qr-remise';
import { X, KeyRound, CheckCircle2, AlertTriangle, ShieldCheck, Banknote, QrCode, Package } from 'lucide-react';

interface OtpValidationModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Qui remet : un livreur Suguba (défaut) ou le fournisseur lui-même (2026-09-26). */
  espace?: 'livreur' | 'fournisseur';
}

const poster = (url: string, corps: unknown) => fetch(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
});

interface ArticleARemettre {
  id: string;
  orderNumber: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  status: string;
  pretARemettre: boolean;
  payeEnLigne: boolean;
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

/**
 * Preuve de remise (refaite le 2026-09-25) : le livreur SCANNE le QR du reçu
 * client, ou saisit le code écrit dessous si le scan échoue.
 *
 * Le scan ne livre rien : il prépare la remise (/api/driver/remise), montre
 * les articles et le paiement, puis « Confirmer la remise » enregistre la
 * livraison par /api/driver/verify-delivery-otp — la même voie que la
 * saisie, donc les mêmes protections (3 essais, livreur assigné, aucun double
 * traitement). Ce composant ne reçoit jamais le code du serveur : il le lit
 * sur le téléphone du client.
 */
export default function OtpValidationModal({ order, isOpen, onClose, onSuccess, espace = 'livreur' }: OtpValidationModalProps) {
  // Mêmes étapes, mêmes protections : seules les adresses changent.
  const preparer = (orderId: string, qr: string) => espace === 'fournisseur'
    ? poster('/api/supplier/remise', { action: 'preparer', orderId, qr })
    : poster('/api/driver/remise', { orderId, qr });
  const confirmer = (orderId: string, code: string) => espace === 'fournisseur'
    ? poster('/api/supplier/remise', { action: 'confirmer', orderId, code })
    : poster('/api/driver/verify-delivery-otp', { orderId, code });
  const [etape, setEtape] = useState<'choix' | 'scan' | 'confirmation' | 'fait'>('choix');
  const [otpInput, setOtpInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  // Remise par QR
  const [codeLu, setCodeLu] = useState('');
  const [articles, setArticles] = useState<ArticleARemettre[]>([]);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [especesRecues, setEspecesRecues] = useState(false);
  const [bilan, setBilan] = useState<{ remis: number; encaisse: number }>({ remis: 0, encaisse: 0 });

  if (!isOpen || !order) return null;

  const echec = (status: number, message: string) => {
    if (status === 423) setLocked(true);
    else if (status === 400) setAttempts((a) => a + 1);
    setErrorMsg(message);
  };

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const res = await confirmer(order.id, otpInput.trim());
      const json = await res.json();
      if (res.ok && json.success) {
        setBilan({ remis: 1, encaisse: order.paymentCollected ? 0 : order.totalAmount });
        setEtape('fait');
        onSuccess?.();
        return;
      }
      echec(res.status, json.error || 'Code invalide.');
    } catch {
      setErrorMsg('Erreur réseau, réessayez.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const apresScan = async (texte: string) => {
    setErrorMsg('');
    const lu = lireQrRemise(texte);
    if (!lu) {
      setEtape('choix');
      setErrorMsg('Ce QR n’est pas un reçu de remise Suguba. Demandez au client d’ouvrir « Mon reçu Suguba ».');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await preparer(order.id, texte);
      const json = await res.json();
      if (!res.ok) {
        setEtape('choix');
        echec(res.status, json.error || 'QR refusé.');
        return;
      }
      const liste = (json.commandes || []) as ArticleARemettre[];
      setArticles(liste);
      setChoisis(new Set(liste.filter((a) => a.pretARemettre).map((a) => a.id)));
      setEspecesRecues(false);
      setCodeLu(lu.code);
      setEtape('confirmation');
    } catch {
      setEtape('choix');
      setErrorMsg('Connexion interrompue : la remise n’est PAS validée. Réessayez quand le réseau revient.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selection = articles.filter((a) => choisis.has(a.id));
  const aEncaisser = selection.filter((a) => !a.payeEnLigne).reduce((t, a) => t + a.totalAmount, 0);

  const confirmerRemise = async () => {
    setErrorMsg('');
    setIsSubmitting(true);
    const reussis = new Set<string>();
    const erreurs: string[] = [];
    // Une livraison par article : verify_delivery_atomic est idempotente, un
    // nouvel essai après une coupure ne crée ni doublon ni second encaissement.
    for (const a of selection) {
      try {
        const res = await confirmer(a.id, codeLu);
        const json = await res.json();
        if (res.ok && json.success) reussis.add(a.id);
        else {
          erreurs.push(`${a.productName} : ${json.error || 'refusé'}`);
          if (res.status === 423) setLocked(true);
        }
      } catch {
        erreurs.push(`${a.productName} : connexion interrompue, non validé`);
      }
    }
    setIsSubmitting(false);
    if (reussis.size > 0) onSuccess?.();
    const encaisse = selection.filter((a) => reussis.has(a.id) && !a.payeEnLigne).reduce((t, a) => t + a.totalAmount, 0);
    if (erreurs.length === 0) {
      setBilan({ remis: reussis.size, encaisse });
      setEtape('fait');
      return;
    }
    // Échec partiel : les articles validés passent « Déjà livré », les autres
    // restent cochés pour un nouvel essai (sans risque de doublon).
    setArticles((l) => l.map((a) => (reussis.has(a.id) ? { ...a, status: 'delivered', pretARemettre: false } : a)));
    setChoisis((s) => new Set([...s].filter((id) => !reussis.has(id))));
    setEspecesRecues(false);
    setErrorMsg(`${reussis.size} article(s) validé(s). Non validé : ${erreurs.join(' · ')}`);
  };

  const handleClose = () => {
    setOtpInput('');
    setErrorMsg('');
    setEtape('choix');
    setAttempts(0);
    setLocked(false);
    setArticles([]);
    setCodeLu('');
    onClose();
  };

  const basculer = (id: string) => setChoisis((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60" role="dialog" aria-modal="true" aria-label="Remise du colis">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">

        <div className="p-4 bg-suguba-profond text-white flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <KeyRound className="w-5 h-5 text-suguba-citron shrink-0" />
            <h3 className="font-bold text-base truncate">Remise du colis · #{order.orderNumber}</h3>
          </div>
          <button onClick={handleClose} aria-label="Fermer"
            className="w-11 h-11 rounded-full hover:bg-white/15 flex items-center justify-center text-white shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">

          {etape === 'fait' ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-bold text-slate-900">Remise confirmée</h4>
                <p className="text-sm text-slate-600">
                  {bilan.remis > 1 ? `${bilan.remis} articles marqués livrés.` : 'Commande marquée livrée.'}
                </p>
                {bilan.encaisse > 0 ? (
                  <p className="text-sm text-slate-800">
                    Espèces encaissées : <strong>{fcfa(bilan.encaisse)}</strong>, à remettre à la caisse Suguba.
                  </p>
                ) : (
                  <p className="text-sm text-slate-600">Déjà payé en ligne : rien à encaisser.</p>
                )}
              </div>
              <button onClick={handleClose} className="w-full min-h-12 bg-suguba-profond text-white font-bold rounded-2xl text-sm">
                Terminer
              </button>
            </div>
          ) : etape === 'scan' ? (
            <div className="space-y-3">
              {isSubmitting ? (
                <p role="status" className="text-center text-sm text-slate-600 py-10">Vérification du QR…</p>
              ) : (
                <ScannerQr onLecture={apresScan} />
              )}
              <p className="text-xs text-slate-600 text-center">
                Scannez seulement quand le client a vérifié son colis.
              </p>
              <button type="button" onClick={() => setEtape('choix')}
                className="w-full min-h-11 rounded-2xl border border-slate-200 text-sm font-bold text-slate-800">
                Saisir le code à la place
              </button>
            </div>
          ) : etape === 'confirmation' ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 shrink-0" /> QR valide. Vérifiez avant de confirmer.
              </div>

              <fieldset className="space-y-1">
                <legend className="text-xs font-bold text-slate-700 mb-1">Articles remis au client</legend>
                {articles.map((a) => (
                  <label key={a.id} className={`flex items-center gap-3 min-h-12 rounded-xl px-2 ${a.pretARemettre ? 'hover:bg-slate-50 cursor-pointer' : 'opacity-60'}`}>
                    <input type="checkbox" disabled={!a.pretARemettre} checked={choisis.has(a.id)} onChange={() => basculer(a.id)}
                      className="w-5 h-5 accent-suguba-profond" />
                    <Package className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-slate-900 truncate">{a.quantity > 1 ? `${a.quantity} × ` : ''}{a.productName}</span>
                      <span className="block text-xs text-slate-500">
                        {a.status === 'delivered' ? 'Déjà livré' : !a.pretARemettre ? 'Ramassage non confirmé' : a.payeEnLigne ? 'Payé en ligne' : fcfa(a.totalAmount)}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {articles.some((a) => a.pretARemettre && !choisis.has(a.id)) && (
                <p className="text-xs text-amber-800 bg-amber-50 rounded-xl p-2">
                  Seuls les articles cochés seront marqués livrés. Les autres restent à livrer.
                </p>
              )}

              {aEncaisser > 0 ? (
                <label className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-300 p-3 cursor-pointer">
                  <input type="checkbox" checked={especesRecues} onChange={(e) => setEspecesRecues(e.target.checked)}
                    className="w-5 h-5 mt-0.5 accent-suguba-profond" />
                  <span className="text-sm text-slate-900">
                    <Banknote className="w-4 h-4 inline text-amber-700 mr-1" />
                    J’ai encaissé <strong>{fcfa(aEncaisser)}</strong> en espèces auprès du client.
                  </span>
                </label>
              ) : selection.length > 0 && (
                <p className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-sm font-bold text-emerald-900">
                  Déjà payé en ligne — ne rien encaisser.
                </p>
              )}

              {errorMsg && (
                <p role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-bold">{errorMsg}</p>
              )}

              <button type="button" onClick={confirmerRemise}
                disabled={isSubmitting || selection.length === 0 || (aEncaisser > 0 && !especesRecues)}
                className="w-full min-h-12 bg-suguba-profond disabled:opacity-50 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                {isSubmitting ? 'Enregistrement…' : `Confirmer la remise${selection.length > 1 ? ` (${selection.length})` : ''}`}
              </button>
              <button type="button" onClick={() => { setEtape('choix'); setArticles([]); setCodeLu(''); }}
                className="w-full min-h-11 text-sm font-bold text-slate-600">
                Annuler
              </button>
            </div>
          ) : (
            <form onSubmit={handleValidate} className="space-y-4">

              {/* Ce que le livreur doit encaisser — ou surtout ne pas encaisser. */}
              {order.paymentCollected ? (
                <div className="bg-emerald-50 border border-emerald-300/80 rounded-2xl p-4 flex items-start gap-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Déjà payé en ligne</p>
                    <p className="text-xl font-bold text-emerald-900 mt-0.5">Ne rien encaisser</p>
                    <p className="text-xs text-slate-600 mt-0.5">Client : {order.customerName} ({order.customerPhone})</p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-4 flex items-start gap-3">
                  <Banknote className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-800">À encaisser au client</p>
                    <p className="text-xl font-bold text-slate-900 mt-0.5">{fcfa(order.totalAmount)}</p>
                    <p className="text-xs text-slate-600 mt-0.5">Client : {order.customerName} ({order.customerPhone})</p>
                  </div>
                </div>
              )}

              {!locked && (
                <button type="button" onClick={() => { setErrorMsg(''); setEtape('scan'); }}
                  className="w-full min-h-14 bg-suguba-profond text-white font-bold rounded-2xl text-base flex items-center justify-center gap-2">
                  <QrCode className="w-5 h-5 text-suguba-citron" /> Scanner le QR du client
                </button>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="code-remise" className="block text-xs font-bold text-slate-700">
                    Ou saisissez le code de remise (sous le QR)
                  </label>
                  {attempts > 0 && (
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      Essai {attempts} / 3
                    </span>
                  )}
                </div>
                <input
                  id="code-remise"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  disabled={locked}
                  placeholder="0000"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-300 focus:border-suguba-profond rounded-2xl text-center text-2xl tracking-[0.5em] font-bold text-slate-900 focus:bg-white focus:outline-hidden disabled:opacity-60"
                />
                <p className="text-xs text-slate-500 mt-1 text-center">
                  Le client le montre sur son reçu Suguba, après avoir vérifié le colis.
                </p>
              </div>

              {errorMsg && (
                <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-bold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {locked ? (
                <div className="space-y-2">
                  <div className="p-3 bg-rose-100 border border-rose-300 text-rose-950 rounded-2xl text-xs font-bold text-center">
                    Commande bloquée après 3 essais erronés.
                  </div>
                  <a href="tel:+22389460000"
                    className="w-full min-h-12 bg-slate-900 text-white font-bold rounded-2xl text-sm flex items-center justify-center">
                    Appeler le support Suguba
                  </a>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={otpInput.length < 4 || isSubmitting}
                  className="w-full min-h-12 disabled:opacity-50 bg-white border-2 border-suguba-profond text-suguba-profond font-bold rounded-2xl text-sm flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {isSubmitting ? 'Vérification…' : order.paymentCollected ? 'Valider le code et remettre' : 'Valider le code et encaisser'}
                </button>
              )}
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
