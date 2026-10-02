'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, ClipboardCheck } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { useCibleUrl, useDefilerVersCible } from '@/components/admin/contexte';
import { anciennete } from '@/lib/admin/poste';

interface Validation {
  id: string; type: string; libelle: string; dossier: string; montant: number | null; resume: Record<string, unknown>;
  statut: string; demandeur: string; demandeurId: string; decideur: string | null; motif: string | null; creeLe: string; decideLe: string | null;
}
const STATUT: Record<string, { libelle: string; ton: 'attente' | 'succes' | 'danger' | 'neutre' }> = {
  en_attente: { libelle: 'En attente', ton: 'attente' }, approuvee: { libelle: 'Approuvée — à exécuter', ton: 'succes' },
  refusee: { libelle: 'Refusée', ton: 'danger' }, executee: { libelle: 'Exécutée', ton: 'neutre' }, caduque: { libelle: 'Caduque (dossier modifié)', ton: 'neutre' },
};
const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

/**
 * Validations (A3, 2026-09-27) : opérations sensibles préparées par un membre,
 * à approuver ou refuser par un AUTRE. Après approbation, le demandeur (ou un
 * collègue) relance l'opération : elle passe alors, une seule fois.
 */
export default function ValidationsPage() {
  const { toast } = useToast();
  const [liste, setListe] = useState<Validation[] | null>(null);
  // Lien direct (« À traiter ») : le dossier visé est surligné et amené à l'écran.
  const cible = useCibleUrl();
  useDefilerVersCible(cible, liste !== null);
  const [moi, setMoi] = useState('');
  const [erreur, setErreur] = useState('');
  const [migration, setMigration] = useState(false);
  const [refus, setRefus] = useState<{ id: string; motif: string } | null>(null);
  // ADM-05 (audit UI/UX du 2026-10-02) : « Approuver » partait en un clic, sans
  // récapitulatif, et un double clic envoyait deux décisions.
  const [approbation, setApprobation] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<string | null>(null);

  const charger = useCallback(() => {
    fetch('/api/admin/validations', { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lecture impossible.'); return j; })
      .then((j) => { setListe(j.validations || []); setMoi(j.moi || ''); setMigration(Boolean(j.migrationRequise)); })
      .catch((e) => setErreur((e as Error).message));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function decider(v: Validation, decision: 'approuver' | 'refuser', motif?: string) {
    if (envoi) return;
    setEnvoi(v.id);
    try {
      const r = await fetch('/api/admin/validations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id, decision, motif }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Décision impossible.', { ton: 'erreur' }); return; }
      setRefus(null);
      setApprobation(null);
      toast(decision === 'approuver' ? 'Approuvée : l’opération peut maintenant être exécutée.' : 'Refusée.', { ton: 'succes' });
      charger();
    } catch {
      toast('Décision non envoyée. Vérifiez votre connexion et réessayez.', { ton: 'erreur' });
    } finally {
      setEnvoi(null);
    }
  }

  const enAttente = (liste || []).filter((v) => v.statut === 'en_attente');
  const autres = (liste || []).filter((v) => v.statut !== 'en_attente');

  const ligne = (v: Validation) => (
    <li key={v.id} data-dossier={v.id} className={`p-3 sm:p-4 space-y-2 ${cible === v.id ? "bg-suguba-menthe" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-slate-900">{v.libelle}</span>
        {v.montant != null && <span className="text-sm font-bold tabular-nums text-slate-900">{fcfa(v.montant)}</span>}
        <StatusPill ton={STATUT[v.statut]?.ton || 'neutre'}>{STATUT[v.statut]?.libelle || v.statut}</StatusPill>
      </div>
      <p className="text-xs text-slate-600">Demandé par <strong>{v.demandeur}</strong> {anciennete(v.creeLe)} · dossier <code>{v.dossier}</code></p>
      <dl className="grid sm:grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-sm">{Object.entries(v.resume).map(([k,val])=><div key={k}><dt className="text-slate-500">{({beneficiaire:'Bénéficiaire',telephone:'Téléphone',methode:'Moyen de paiement',motif:'Motif',baisses:'Changements',commande:'Commande'} as Record<string,string>)[k] || k.replace(/_/g,' ')}</dt><dd className="break-words">{Array.isArray(val)?val.map((x:any,i)=><p key={i}>{x.libelle || 'Changement'} : {String(x.avant ?? '')} → {String(x.apres ?? '')}</p>):val && typeof val==='object'?Object.entries(val).map(([cle,valeur])=><p key={cle}>{cle.replace(/_/g,' ')} : {String(valeur)}</p>):String(val ?? '—')}</dd></div>)}</dl>
      {v.statut === 'approuvee' && <Link className="inline-flex min-h-11 items-center underline font-semibold" href={v.type === 'part_suguba' ? '/admin/parametres' : `/admin/retraits?id=${encodeURIComponent(v.dossier.split(':').slice(1).join(':'))}`}>Reprendre l’opération dans son dossier</Link>}
      {v.decideur && <p className="text-xs text-slate-600">Décidé par <strong>{v.decideur}</strong>{v.motif ? ` — ${v.motif}` : ''}</p>}
      {v.statut === 'en_attente' && (v.demandeurId === moi
        ? <p className="text-xs font-semibold text-amber-800">Votre demande : un collègue doit l’approuver.</p>
        : refus?.id === v.id ? (
          <div className="flex flex-wrap gap-2 items-center">
            <input value={refus.motif} onChange={(e) => setRefus({ id: v.id, motif: e.target.value })} placeholder="Motif du refus" aria-label="Motif du refus"
              className="flex-1 min-w-[12rem] h-9 px-3 rounded-xl border border-slate-300 text-sm" />
            <Button type="button" size="sm" variant="danger" disabled={refus.motif.trim().length < 3 || envoi === v.id} onClick={() => decider(v, 'refuser', refus.motif)}>Confirmer le refus</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRefus(null)}>Annuler</Button>
          </div>
        ) : approbation === v.id ? (
          <div role="group" aria-label="Confirmer l’approbation" className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <p className="text-sm text-slate-900">
              Approuver <strong>{v.libelle}</strong>{v.montant != null && <> de <strong className="tabular-nums">{fcfa(v.montant)}</strong></>}, demandé par <strong>{v.demandeur}</strong> ?
            </p>
            <p className="text-xs text-slate-600">L’opération pourra ensuite être exécutée une fois, depuis son dossier.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={envoi === v.id} onClick={() => decider(v, 'approuver')}><CheckCircle2 className="w-4 h-4" />Confirmer l’approbation</Button>
              <Button type="button" size="sm" variant="ghost" disabled={envoi === v.id} onClick={() => setApprobation(null)}>Annuler</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => { setRefus(null); setApprobation(v.id); }}><CheckCircle2 className="w-4 h-4" />Approuver</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setApprobation(null); setRefus({ id: v.id, motif: '' }); }}><XCircle className="w-4 h-4" />Refuser</Button>
          </div>
        ))}
    </li>
  );

  return (
    <PageReseau titre="Approbations financières" large sousTitre="Opérations sensibles : une personne prépare, un collègue approuve.">
      {erreur ? <EmptyState icone={ClipboardCheck} titre="Indisponible" texte={erreur} />
        : migration ? <EmptyState icone={ClipboardCheck} titre="Mise à jour de la base nécessaire" texte="Exécutez le SQL A-EXECUTER-2026-09-27-admin-a3.sql dans Supabase." />
        : !liste ? <Skeleton className="h-64" />
        : (
          <>
            <h2 className="text-sm font-bold text-slate-900">En attente ({enAttente.length})</h2>
            {enAttente.length ? <Card className="!p-0 overflow-hidden"><ul className="divide-y divide-slate-100">{enAttente.map(ligne)}</ul></Card>
              : <p className="text-sm text-slate-500">Aucune demande en attente.</p>}
            {autres.length > 0 && (
              <>
                <h2 className="text-sm font-bold text-slate-900">Historique</h2>
                <Card className="!p-0 overflow-hidden"><ul className="divide-y divide-slate-100">{autres.map(ligne)}</ul></Card>
              </>
            )}
          </>
        )}
    </PageReseau>
  );
}
