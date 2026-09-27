'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';

interface Entree { id: number; cree_le: string; auteur: string; action: string; dossier: string | null; motif: string | null; apres: Record<string, unknown> | null }

const dateHeure = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

/**
 * Journal des actions de l'équipe (A2, 2026-09-27) : qui a fait quoi, quand,
 * sur quel dossier et pourquoi. Non modifiable. Filtres par dossier et action.
 */
export default function JournalPage() {
  const [entrees, setEntrees] = useState<Entree[] | null>(null);
  const [suivant, setSuivant] = useState<number | null>(null);
  const [erreur, setErreur] = useState('');
  const [migration, setMigration] = useState(false);
  const [dossier, setDossier] = useState('');
  const [action, setAction] = useState('');
  const [ouverte, setOuverte] = useState<number | null>(null);

  const charger = useCallback((avant: number | null) => {
    const p = new URLSearchParams();
    if (dossier.trim()) p.set('dossier', dossier.trim());
    if (action.trim()) p.set('action', action.trim());
    if (avant) p.set('avant', String(avant));
    fetch(`/api/admin/journal?${p}`, { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lecture impossible.'); return j; })
      .then((j) => {
        setMigration(Boolean(j.migrationRequise)); setErreur('');
        setEntrees((liste) => (avant && liste ? [...liste, ...(j.entrees || [])] : j.entrees || []));
        setSuivant(j.suivant ?? null);
      })
      .catch((e) => setErreur((e as Error).message));
  }, [dossier, action]);
  useEffect(() => { const t = setTimeout(() => { setEntrees(null); charger(null); }, 300); return () => clearTimeout(t); }, [charger]);

  return (
    <PageReseau titre="Journal des actions" large sousTitre="Qui a fait quoi, quand, sur quel dossier. Non modifiable.">
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="relative">
          <span className="sr-only">Dossier</span>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={dossier} onChange={(e) => setDossier(e.target.value)} placeholder="Dossier (commande, produit, identifiant…)" className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-sm" />
        </label>
        <label>
          <span className="sr-only">Action</span>
          <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Action (payouts, products/price, note…)" className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm" />
        </label>
      </div>
      {erreur ? <EmptyState icone={ScrollText} titre="Journal indisponible" texte={erreur} />
        : migration ? <EmptyState icone={ScrollText} titre="Mise à jour de la base nécessaire" texte="Exécutez le SQL A-EXECUTER-2026-09-27-admin-a2.sql dans Supabase." />
        : !entrees ? <Skeleton className="h-64" />
        : entrees.length === 0 ? <EmptyState icone={ScrollText} titre="Aucune action" texte="Aucune action ne correspond à ces filtres." />
        : (
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr><th className="px-3 py-2 font-bold">Date</th><th className="px-3 py-2 font-bold">Membre</th><th className="px-3 py-2 font-bold">Action</th><th className="px-3 py-2 font-bold hidden md:table-cell">Dossier</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entrees.map((e) => (
                  <React.Fragment key={e.id}>
                    <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setOuverte(ouverte === e.id ? null : e.id)}>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-600 tabular-nums">{dateHeure(e.cree_le)}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{e.auteur}</td>
                      <td className="px-3 py-2"><code className="text-xs">{e.action}</code>{e.motif && <span className="block text-xs text-slate-500">Motif : {e.motif}</span>}</td>
                      <td className="px-3 py-2 hidden md:table-cell text-xs text-slate-600 break-all">{e.dossier || '—'}</td>
                    </tr>
                    {ouverte === e.id && (
                      <tr><td colSpan={4} className="px-3 py-2 bg-slate-50">
                        <p className="text-xs text-slate-600 md:hidden">Dossier : {e.dossier || '—'}</p>
                        <pre className="text-xs text-slate-700 whitespace-pre-wrap break-all">{JSON.stringify(e.apres || {}, null, 2)}</pre>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {suivant && <div className="p-3 text-center"><Button type="button" variant="ghost" size="sm" onClick={() => charger(suivant)}>Voir plus</Button></div>}
          </Card>
        )}
    </PageReseau>
  );
}
