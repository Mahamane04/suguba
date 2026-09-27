'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import Button from '@/components/ui/Button';
import { anciennete } from '@/lib/admin/poste';

interface Note { id: number; le: string; auteur: string; texte: string }

/**
 * Notes internes d'un dossier (A2, 2026-09-27) — réservées à l'équipe,
 * jamais montrées au client. Ajout seulement : une note ne se modifie pas.
 */
export default function NotesInternes({ dossier }: { dossier: string }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(() => {
    fetch(`/api/admin/notes?dossier=${encodeURIComponent(dossier)}`, { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lecture impossible.'); return j; })
      .then((j) => { setNotes(j.notes || []); setErreur(j.migrationRequise ? 'Exécutez le SQL du journal (A2) pour activer les notes.' : ''); })
      .catch((e) => setErreur((e as Error).message));
  }, [dossier]);
  useEffect(() => { charger(); }, [charger]);

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    if (!texte.trim()) return;
    setEnvoi(true);
    try {
      const r = await fetch('/api/admin/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dossier, texte }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(j.error || 'Enregistrement impossible.'); return; }
      setTexte(''); charger();
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="rounded-2xl bg-amber-50/60 border border-amber-100 p-3 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900 inline-flex items-center gap-1"><Lock className="w-3 h-3" />Notes internes · jamais visibles par le client</p>
      {erreur && <p role="alert" className="text-xs font-semibold text-rose-700">{erreur}</p>}
      {notes && notes.length === 0 && !erreur && <p className="text-xs text-slate-500">Aucune note pour ce dossier.</p>}
      {notes && notes.length > 0 && (
        <ul className="space-y-1.5 max-h-48 overflow-y-auto">
          {notes.map((n) => (
            <li key={n.id} className="text-xs text-slate-800">
              <span className="font-bold">{n.auteur}</span> <span className="text-slate-500">· {anciennete(n.le)}</span>
              <p className="whitespace-pre-wrap">{n.texte}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={ajouter} className="flex gap-2">
        <label htmlFor={`note-${dossier}`} className="sr-only">Ajouter une note interne</label>
        <input id={`note-${dossier}`} value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={2000}
          placeholder="Ajouter une note pour l’équipe…" className="flex-1 min-w-0 h-9 px-3 rounded-xl border border-slate-300 text-sm bg-white" />
        <Button type="submit" size="sm" disabled={envoi || !texte.trim()}>Ajouter</Button>
      </form>
    </div>
  );
}
