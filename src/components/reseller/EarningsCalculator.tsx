 'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSugubaStore } from '@/lib/store';
import { formatF } from '@/lib/montant';
export default function EarningsCalculator({ showCta = true }: { showCta?: boolean }) {
  const [ventes, setVentes] = useState(20);
  const [commission, setCommission] = useState(3500);
  const connecte = Boolean(useSugubaStore().currentUser.id);
  return <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 space-y-6">
    <div><h2 className="text-lg font-bold">Estimer mes commissions</h2><p className="text-sm text-slate-600">Une simulation, pas une promesse de revenu.</p></div>
    <div><label htmlFor="simulation-ventes" className="block font-semibold mb-2">Ventes livrées et validées par mois : {ventes}</label><input id="simulation-ventes" type="range" min="0" max="100" value={ventes} onChange={e => setVentes(Number(e.target.value))} className="suguba-range" /></div>
    <div><label htmlFor="simulation-commission" className="block font-semibold mb-2">Commission moyenne par vente (en F)</label><input id="simulation-commission" type="number" min="0" step="100" value={commission} onChange={e => setCommission(Math.max(0, Number(e.target.value) || 0))} className="w-full border border-slate-300 rounded-xl p-3" /><p className="text-sm text-slate-600 mt-2">Utilisez la commission indiquée sur les produits que vous souhaitez partager.</p></div>
    <div className="bg-suguba-profond text-white rounded-2xl p-5" aria-live="polite"><p>Commissions estimées pour le mois</p><p className="text-3xl font-bold my-2">{formatF((ventes * commission))}</p><p className="text-sm">{ventes} ventes × {formatF(commission)}. Hors annulations, retours, primes et parrainage. Les commissions deviennent retirables selon les délais et conditions affichés dans Gains.</p></div>
    {showCta && <Link href={connecte ? '/reseller/catalog' : '/reseller/join'} className="block text-center rounded-2xl bg-suguba-profond text-white p-4 font-bold">{connecte ? 'Choisir des produits à partager' : 'Découvrir le profil revendeur'}</Link>}
  </section>;
}
