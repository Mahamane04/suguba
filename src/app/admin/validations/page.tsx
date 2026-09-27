'use client';

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

  const charger = useCallback(() => {
    fetch('/api/admin/validations', { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lecture impossible.'); return j; })
      .then((j) => { setListe(j.validations || []); setMoi(j.moi || ''); setMigration(Boolean(j.migrationRequise)); })
      .catch((e) => setErreur((e as Error).message));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function decider(v: Validation, decision: 'approuver' | 'refuser', motif?: string) {
    const r = await fetch('/api/admin/validations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id, decision, motif }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(j.error || 'Décision impossible.', { ton: 'erreur' }); return; }
    setRefus(null);
    toast(decision === 'approuver' ? 'Approuvée : l’opération peut maintenant être exécutée.' : 'Refusée.', { ton: 'succes' });
    charger();
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
      <pre className="text-xs text-slate-700 bg-slate-50 rounded-xl p-2 whitespace-pre-wrap break-all">{JSON.stringify(v.resume, null, 2)}</pre>
      {v.decideur && <p className="text-xs text-slate-600">Décidé par <strong>{v.decideur}</strong>{v.motif ? ` — ${v.motif}` : ''}</p>}
      {v.statut === 'en_attente' && (v.demandeurId === moi
        ? <p className="text-xs font-semibold text-amber-800">Votre demande : un collègue doit l’approuver.</p>
        : refus?.id === v.id ? (
          <div className="flex flex-wrap gap-2 items-center">
            <input value={refus.motif} onChange={(e) => setRefus({ id: v.id, motif: e.target.value })} placeholder="Motif du refus" aria-label="Motif du refus"
              className="flex-1 min-w-[12rem] h-9 px-3 rounded-xl border border-slate-300 text-sm" />
            <Button type="button" size="sm" variant="danger" disabled={refus.motif.trim().length < 3} onClick={() => decider(v, 'refuser', refus.motif)}>Confirmer le refus</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRefus(null)}>Annuler</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => decider(v, 'approuver')}><CheckCircle2 className="w-4 h-4" />Approuver</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRefus({ id: v.id, motif: '' })}><XCircle className="w-4 h-4" />Refuser</Button>
          </div>
        ))}
    </li>
  );

  return (
    <PageReseau titre="Validations" large sousTitre="Opérations sensibles : une personne prépare, un collègue approuve.">
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
