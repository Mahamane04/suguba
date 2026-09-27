'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { HelpCircle, Ban, CheckCircle2 } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import ChoicePicker from '@/components/ui/ChoicePicker';
import { Card } from '@/components/ui/Surface';
import { TYPES_DIAGNOSTIC, type Diagnostic } from '@/lib/admin/pilotage';

/**
 * « Pourquoi c'est bloqué ? » (A5, 2026-09-27) : la raison, en français
 * simple, et le lien vers l'écran où agir. Lecture seule.
 */
function Contenu() {
  const params = useSearchParams();
  const [type, setType] = useState(params.get('type') || 'commande');
  const [ref, setRef] = useState(params.get('ref') || '');
  const [resultat, setResultat] = useState<Diagnostic | null>(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const lancer = useCallback((t: string, r: string) => {
    if (!r.trim()) return;
    setEnvoi(true); setErreur(''); setResultat(null);
    fetch(`/api/admin/diagnostic?type=${encodeURIComponent(t)}&ref=${encodeURIComponent(r.trim())}`, { cache: 'no-store' })
      .then(async (x) => { const j = await x.json(); if (!x.ok) throw new Error(j.error || 'Diagnostic impossible.'); return j; })
      .then((j) => setResultat(j.diagnostic))
      .catch((e) => setErreur((e as Error).message))
      .finally(() => setEnvoi(false));
  }, []);
  useEffect(() => { const r = params.get('ref'); if (r) lancer(params.get('type') || 'commande', r); }, [params, lancer]);

  const def = TYPES_DIAGNOSTIC.find((t) => t.cle === type);
  return (
    <PageReseau titre="Pourquoi c’est bloqué ?" sousTitre="La raison en clair, et où agir.">
      <Card>
        <form onSubmit={(e) => { e.preventDefault(); lancer(type, ref); }} className="flex flex-wrap gap-2 items-end">
          <div className="w-full sm:w-56">
            <span id="diagnostic-type" className="block mb-1 text-xs font-bold text-slate-700">Type</span>
            <ChoicePicker ariaLabel="Type de dossier" valeur={type} onChange={setType} choix={TYPES_DIAGNOSTIC.map((t) => ({ valeur: t.cle, libelle: t.titre }))} />
          </div>
          <label className="flex-1 min-w-[12rem] text-xs font-bold text-slate-700">Référence
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={def?.aide} className="block w-full mt-1 min-h-12 px-4 rounded-2xl border border-slate-200 text-base sm:text-sm font-normal focus:outline-none focus:ring-2 focus:ring-suguba-profond" />
          </label>
          <Button type="submit" disabled={envoi || !ref.trim()}>{envoi ? 'Analyse…' : 'Expliquer'}</Button>
        </form>
      </Card>
      {erreur && <p role="alert" className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-sm font-semibold text-rose-700">{erreur}</p>}
      {resultat && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2"><h2 className="text-base font-bold text-slate-900">{resultat.titre}</h2><span className="text-xs font-bold text-slate-600">{resultat.etat}</span></div>
          <ul className="space-y-2">
            {resultat.raisons.map((r, i) => (
              <li key={i} className={`flex gap-2 text-sm ${r.bloquant ? 'text-rose-800' : 'text-slate-700'}`}>
                {r.bloquant ? <Ban className="w-4 h-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-suguba-brand-dark" />}
                <span>{r.texte}{r.lien && <> — <Link href={r.lien} className="font-bold underline">{r.libelleLien || 'Ouvrir'}</Link></>}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">Ce diagnostic explique ; il ne permet pas d’ignorer un contrôle.</p>
        </Card>
      )}
      {!resultat && !erreur && <p className="text-xs text-slate-500 inline-flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5" />Aussi accessible depuis « À traiter » (lien « Pourquoi ? »).</p>}
    </PageReseau>
  );
}

export default function DiagnosticPage() {
  return <Suspense fallback={null}><Contenu /></Suspense>;
}
