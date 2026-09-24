'use client';

import React, { useState } from 'react';
import { Package, Phone, Navigation, CheckCircle2, Loader2, KeyRound } from 'lucide-react';
import type { Order } from '@/types';
import { cloudSyncService } from '@/lib/cloud-sync';
import { sugubaStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';

/**
 * Étape 1 de la course : récupérer le colis chez le fournisseur (2026-09-24).
 *
 * Le fournisseur voit un code à 4 chiffres dans sa page Commandes et le donne
 * au livreur quand le colis lui est remis ; le livreur le saisit ici. C'est
 * la preuve du ramassage — avant, rien ne l'attestait. Tant qu'il n'est pas
 * saisi, le code du client n'est pas accepté (voir verify-delivery-otp).
 */
export default function RamassageColis({ order, nomRepli }: { order: Order; nomRepli?: string }) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const lieu = order.pickupLocation;
  const recupere = Boolean(order.pickedUpAt) || order.status === 'in_transit';
  const itineraire = lieu?.lat != null && lieu?.lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${lieu.lat},${lieu.lng}`
    : lieu?.quartier ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lieu.adresse ? lieu.adresse + ', ' : ''}${lieu.quartier}, Bamako`)}` : null;

  const valider = async () => {
    if (!/^\d{4}$/.test(code)) { toast('Le code du fournisseur a 4 chiffres.', { ton: 'erreur' }); return; }
    setEnvoi(true);
    try {
      const r = await fetch('/api/driver/verify-pickup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, code }),
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Code refusé.', { ton: 'erreur' }); return; }
      toast('Ramassage confirmé. Direction le client !', { ton: 'succes' });
      sugubaStore.updateOrderStatusFromCloud(order.id, 'in_transit');
      await cloudSyncService.fetchOrdersFromCloudSiEligible('driver');
    } catch {
      toast('Connexion impossible : réessayez.', { ton: 'erreur' });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className={`p-3 rounded-2xl border text-xs space-y-2 ${recupere ? 'bg-suguba-sauge border-transparent' : 'bg-white border-amber-300'}`}>
      <div className="flex items-center gap-1.5 text-slate-900 font-semibold">
        {recupere ? <CheckCircle2 className="w-4 h-4 text-suguba-profond" /> : <Package className="w-4 h-4 text-amber-700" />}
        <span>1. Récupérer le colis</span>
        {recupere && order.pickedUpAt && (
          <span className="ml-auto text-suguba-profond font-semibold">
            Récupéré à {new Date(order.pickedUpAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      <div className="pl-5 space-y-0.5 text-slate-700">
        <p>Chez <strong>{lieu?.nom || nomRepli || 'le fournisseur'}</strong></p>
        {(lieu?.quartier || lieu?.adresse) && <p>{[lieu?.adresse, lieu?.quartier].filter(Boolean).join(' · ')}</p>}
      </div>
      {!recupere && (
        <>
          <div className="flex gap-2 pl-5">
            {lieu?.telephone && (
              <a href={`tel:${lieu.telephone}`} className="min-h-[40px] px-3 rounded-full border border-slate-200 bg-white font-semibold text-slate-700 inline-flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />Appeler
              </a>
            )}
            {itineraire && (
              <a href={itineraire} target="_blank" rel="noopener noreferrer" className="min-h-[40px] px-3 rounded-full border border-slate-200 bg-white font-semibold text-slate-700 inline-flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5" />Y aller
              </a>
            )}
          </div>
          <div className="space-y-1.5 pt-1">
            <label htmlFor={`ramassage-${order.id}`} className="flex items-center gap-1.5 font-semibold text-slate-800">
              <KeyRound className="w-3.5 h-3.5" />Code donné par le fournisseur
            </label>
            <div className="flex gap-2">
              <input
                id={`ramassage-${order.id}`}
                inputMode="numeric" autoComplete="one-time-code" maxLength={4} placeholder="••••"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-28 h-11 px-3 rounded-xl border border-slate-200 text-lg tracking-[0.4em] text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-suguba-profond/30"
              />
              <button type="button" onClick={valider} disabled={envoi || code.length !== 4}
                className="flex-1 min-h-[44px] rounded-full bg-suguba-profond text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40">
                {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Colis récupéré
              </button>
            </div>
            <p className="text-slate-500">Demandez ce code au fournisseur une fois le colis vérifié et en main.</p>
          </div>
        </>
      )}
    </div>
  );
}
