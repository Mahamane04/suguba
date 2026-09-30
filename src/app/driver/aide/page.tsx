'use client';
import { useState } from 'react';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import { useSugubaStore } from '@/lib/store';
import SugubaLoader from '@/components/ui/SugubaLoader';
export default function AideLivreur() {
  const state = useSugubaStore();
  const [orderId, setOrderId] = useState('');
  const [motif, setMotif] = useState('Client absent');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const courses = state.orders.filter(o => ['dispatched', 'in_transit'].includes(o.status));
  async function envoyer(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setMessage('');
    try { const r = await fetch('/api/driver/incident', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, motif, detail }) }); const d = await r.json(); setMessage(r.ok ? `Signalement enregistré (${d.ticketNumber}). L’équipe Suguba le voit dans SAV. Attendez ses instructions ; la course reste inchangée.` : d.error || 'Échec du signalement.'); } catch { setMessage('Connexion impossible. Réessayez.'); } finally { setBusy(false); }
  }
  return <div className="min-h-screen bg-slate-50"><Header/><main className="max-w-xl mx-auto p-4 space-y-5"><h1 className="text-2xl font-bold">Signaler un problème de course</h1><p className="text-sm text-slate-600">L’équipe Suguba décide de la suite. Ce signalement ne valide ni livraison ni encaissement.</p><form onSubmit={envoyer} className="bg-white border rounded-2xl p-5 space-y-4"><label htmlFor="incident-course" className="block font-semibold">Course</label><select id="incident-course" required value={orderId} onChange={e => setOrderId(e.target.value)} className="w-full border rounded-xl p-3"><option value="">Choisir une course active</option>{courses.map(o => <option key={o.id} value={o.id}>{o.orderNumber} — {o.neighborhood}</option>)}</select><label htmlFor="incident-motif" className="block font-semibold">Problème rencontré</label><select id="incident-motif" value={motif} onChange={e => setMotif(e.target.value)} className="w-full border rounded-xl p-3">{['Fournisseur indisponible', 'Client absent', 'Client refuse le colis', 'Colis endommagé', 'Code de remise manquant'].map(m => <option key={m}>{m}</option>)}</select><label htmlFor="incident-detail" className="block font-semibold">Précisions (facultatif)</label><textarea id="incident-detail" maxLength={1000} value={detail} onChange={e => setDetail(e.target.value)} className="w-full border rounded-xl p-3"/><button disabled={busy || !courses.length} className="w-full bg-suguba-profond text-white rounded-xl p-3 font-bold disabled:opacity-50">{busy ? <SugubaLoader/> : 'Envoyer à Suguba'}</button><p role="status" className="text-sm">{message}</p>{!courses.length && <p>Aucune course active à signaler.</p>}</form></main><BottomNav/></div>;
}
