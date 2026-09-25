'use client';
import React, { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { orderAccessKey } from '@/lib/order-access-client';
import { requestDeliverySms, type DeliverySmsResult } from '@/lib/delivery-sms-client';
import { whatsappHelper } from '@/lib/whatsapp-helper';

/** Le navigateur ne connaît jamais le code. La commande reste consultable en cas de panne SMS. */
export default function DeliveryCodeNotice({ orderNumber, autoSend = false }: { orderNumber: string; autoSend?: boolean }) {
  const [result, setResult] = useState<DeliverySmsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [canSend, setCanSend] = useState(false);
  useEffect(() => {
    let active = true;
    const allowed = Boolean(orderAccessKey(orderNumber));
    setCanSend(allowed); setResult(null); setBusy(false);
    if (autoSend && allowed) {
      setBusy(true);
      requestDeliverySms(orderNumber).then(r => { if (active) { setResult(r); setBusy(false); } });
    }
    return () => { active = false; };
  }, [orderNumber, autoSend]);
  const resend = async () => {
    if (busy) return;
    setBusy(true); setResult(null);
    const response = await requestDeliverySms(orderNumber, true);
    setResult(response); setBusy(false);
  };
  return <section aria-label="Code de remise" className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3 text-left text-sm text-slate-700">
    <h2 className="font-bold text-slate-900">Le code arrive sur le téléphone du destinataire</h2>
    <p>Le code est transmis séparément par SMS. Donnez-le au livreur uniquement après avoir reçu et vérifié le colis.</p>
    {busy ? <p role="status">Transmission au service SMS…</p> : result?.success ? <p role="status">Demande acceptée par le service SMS. Si le message n’arrive pas, vous pouvez demander un nouvel envoi.</p> : result?.error ? <p role="alert" className="text-rose-800">{result.error}</p> : null}
    {canSend ? <Button type="button" disabled={busy} onClick={resend} fullWidth>{busy ? 'Transmission…' : 'Demander le SMS au destinataire'}</Button> : <p>Pour un nouvel envoi, ouvrez le reçu sur l’appareil de commande ou contactez Suguba avec le numéro de commande.</p>}
    <a href={whatsappHelper.getSupportChatLink(orderNumber)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-suguba-profond underline">Contacter Suguba</a>
  </section>;
}
