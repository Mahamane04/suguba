'use client';
import React, { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { orderAccessKey } from '@/lib/order-access-client';
import { fetchDeliveryCode, type DeliveryCodeResult } from '@/lib/delivery-code-client';
import { whatsappHelper } from '@/lib/whatsapp-helper';
import { KeyRound } from 'lucide-react';

/**
 * Code de remise affiché dans l'application (2026-09-25), à la place de
 * l'envoi par SMS : Suguba n'a pas de service SMS branché. Seul l'appareil
 * qui a passé la commande le voit (clé du reçu).
 *
 * `destinataire` : vente saisie pour un client (« + Vente » du revendeur) —
 * le revendeur voit le code et l'envoie à son client sur WhatsApp.
 */
export default function DeliveryCodeNotice({
  orderNumber,
  autoSend = false,
  destinataire,
}: {
  orderNumber: string;
  autoSend?: boolean;
  destinataire?: { telephone: string; nom?: string };
}) {
  const [result, setResult] = useState<DeliveryCodeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [canSee, setCanSee] = useState(false);

  const afficher = async () => {
    setBusy(true);
    const r = await fetchDeliveryCode(orderNumber);
    setResult(r);
    setBusy(false);
  };

  useEffect(() => {
    const autorise = Boolean(orderAccessKey(orderNumber));
    setCanSee(autorise);
    setResult(null);
    if (autoSend && autorise) afficher();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber, autoSend]);

  const chiffres = (destinataire?.telephone || '').replace(/\D/g, '');
  const numeroWa = chiffres.length === 8 ? `223${chiffres}` : chiffres;
  const lienWa = result?.code && numeroWa
    ? `https://wa.me/${numeroWa}?text=${encodeURIComponent(
        `Bonjour${destinataire?.nom ? ` ${destinataire.nom}` : ''}, votre commande Suguba #${orderNumber} est en route. `
        + `Votre code de remise : ${result.code}. Donnez-le au livreur UNIQUEMENT après avoir reçu et vérifié le colis.`,
      )}`
    : null;

  return (
    <section aria-label="Code de remise" className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3 text-left text-sm text-slate-700">
      <h2 className="font-bold text-slate-900 flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-amber-600" />
        {destinataire ? 'Code de remise de votre client' : 'Votre code de remise'}
      </h2>

      {result?.code ? (
        <p className="text-center font-mono text-3xl font-bold tracking-[0.4em] text-slate-900 bg-white rounded-2xl border border-slate-200 py-3" aria-live="polite">
          {result.code}
        </p>
      ) : busy ? (
        <p role="status">Chargement du code…</p>
      ) : result?.error ? (
        <p role="alert" className="text-rose-800">{result.error}</p>
      ) : null}

      <p>
        {destinataire
          ? 'Envoyez ce code à votre client. Il le donne au livreur UNIQUEMENT après avoir reçu et vérifié le colis.'
          : 'Donnez ce code au livreur UNIQUEMENT après avoir reçu et vérifié le colis. Ne le communiquez à personne d’autre.'}
      </p>

      {lienWa && (
        <a href={lienWa} target="_blank" rel="noopener noreferrer"
          className="h-11 w-full rounded-2xl bg-suguba-wa hover:bg-[#20bd5a] text-suguba-profond text-sm font-bold inline-flex items-center justify-center gap-2">
          <WhatsAppIcon className="w-4 h-4" /> Envoyer le code au client sur WhatsApp
        </a>
      )}

      {canSee
        ? !result?.code && <Button type="button" disabled={busy} onClick={afficher} fullWidth>{busy ? 'Chargement…' : 'Afficher le code'}</Button>
        : <p>Le code s’affiche sur l’appareil qui a passé la commande. Sinon, contactez Suguba avec le numéro de commande.</p>}

      <a href={whatsappHelper.getSupportChatLink(orderNumber)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-suguba-profond underline">
        Contacter Suguba
      </a>
    </section>
  );
}
