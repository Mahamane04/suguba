'use client';

import ChoicePicker from '@/components/ui/ChoicePicker';
import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ScrollText, Search } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import { FORMAT_DATE } from '@/lib/montant';
import { detailsLisibles, libelleAction, libelleDossier } from '@/lib/admin/libelles-journal';

interface Entree { id: number; cree_le: string; auteur: string; action: string; dossier: string | null; motif: string | null; apres: Record<string, unknown> | null }

const dateHeure = (iso: string) => new Date(iso).toLocaleString('fr-FR', FORMAT_DATE.completHeure);

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
          <ChoicePicker ariaLabel="Type d’action" valeur={action} onChange={setAction} choix={[{valeur:'',libelle:'Toutes les actions'},{valeur:'payouts',libelle:'Retraits'},{valeur:'products/price',libelle:'Prix des produits'},{valeur:'verifications',libelle:'Identité et documents'},{valeur:'settings',libelle:'Réglages économiques'},{valeur:'note',libelle:'Notes de dossier'}]}/>
        </label>
      </div>
      {erreur ? <EmptyState icone={ScrollText} titre="Journal indisponible" texte={erreur} />
        : migration ? <EmptyState icone={ScrollText} titre="Mise à jour de la base nécessaire" texte="Exécutez le SQL A-EXECUTER-2026-09-27-admin-a2.sql dans Supabase." />
        : !entrees ? <Skeleton className="h-64" />
        : entrees.length === 0 ? <EmptyState icone={ScrollText} titre="Aucune action" texte="Aucune action ne correspond à ces filtres." />
        : (
          <Card className="!p-0 overflow-hidden">
            {/* ADM-07 (lot 6 de l'audit UI/UX du 2026-10-02) : une phrase par action, la
                nature du dossier en clair, les détails en libellés (plus de code de route
                ni de JSON). Chaque ligne se déplie avec un vrai bouton (clavier compris). */}
            <ul className="divide-y divide-slate-100">
              {entrees.map((e) => {
                const ouvert = ouverte === e.id;
                const details = detailsLisibles(e.apres);
                return (
                  <li key={e.id}>
                    <button type="button" onClick={() => setOuverte(ouvert ? null : e.id)} aria-expanded={ouvert}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900">{libelleAction(e.action)}</span>
                        <span className="block text-sm text-slate-600">
                          {e.auteur} · {libelleDossier(e.dossier)}
                        </span>
                        {e.motif && <span className="block text-sm text-slate-700 mt-0.5">Motif : {e.motif}</span>}
                      </span>
                      <span className="shrink-0 text-xs text-slate-600 tabular-nums whitespace-nowrap pt-0.5">{dateHeure(e.cree_le)}</span>
                      <ChevronDown className={`w-4 h-4 shrink-0 mt-0.5 text-slate-400 transition-transform ${ouvert ? 'rotate-180' : ''}`} />
                    </button>
                    {ouvert && (
                      <div className="px-4 pb-3 space-y-2">
                        {details.length > 0 ? (
                          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-2xl bg-slate-50 p-3 text-sm">
                            {details.map((d) => (
                              <React.Fragment key={d.libelle}>
                                <dt className="text-slate-600">{d.libelle}</dt>
                                <dd className="text-slate-900 break-words">{d.valeur}</dd>
                              </React.Fragment>
                            ))}
                          </dl>
                        ) : <p className="text-sm text-slate-600">Aucun détail enregistré.</p>}
                        <p className="text-xs text-slate-500 break-all">Code : {e.action}{e.dossier ? ` · ${e.dossier}` : ''}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {suivant && <div className="p-3 text-center"><Button type="button" variant="ghost" size="sm" onClick={() => charger(suivant)}>Voir plus</Button></div>}
          </Card>
        )}
    </PageReseau>
  );
}
