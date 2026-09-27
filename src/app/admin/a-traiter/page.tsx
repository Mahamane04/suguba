'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Inbox, RefreshCw, AlertTriangle, UserCheck, ArrowRightLeft, X, StickyNote } from 'lucide-react';
import NotesInternes from '@/components/admin/NotesInternes';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { METIERS, anciennete, urgence, type Metier, type TacheAffichee } from '@/lib/admin/poste';

interface Collegue { id: string; nom: string; types: string[] }
interface Reponse {
  metier: Metier | 'toutes'; metierMembre: Metier; moi: string;
  taches: TacheAffichee[]; indisponibles: string[]; collegues: Collegue[];
}
type Filtre = 'toutes' | 'miennes' | 'libres';

const COULEUR_URGENCE = { normale: 'text-slate-500', a_surveiller: 'text-amber-700 font-semibold', en_retard: 'text-rose-700 font-bold' } as const;
const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

/**
 * « À traiter » (A1, 2026-09-27) — la file de travail de l'équipe : les
 * dossiers qui attendent une décision, les plus anciens d'abord, avec leur
 * responsable. Chacun arrive sur son métier ; la Direction voit tout.
 */
export default function ATraiterPage() {
  const { toast } = useToast();
  const [metier, setMetier] = useState<Metier | 'toutes' | null>(null);
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('toutes');
  const [transfert, setTransfert] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [notesOuvertes, setNotesOuvertes] = useState<string | null>(null);

  const charger = useCallback((m: Metier | 'toutes' | null) => {
    setErreur('');
    fetch(`/api/admin/a-traiter${m ? `?metier=${m}` : ''}`, { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lecture impossible.'); return j as Reponse; })
      .then((j) => { setDonnees(j); if (m === null) setMetier(j.metier); })
      .catch((e) => setErreur((e as Error).message));
  }, []);
  useEffect(() => { charger(null); }, [charger]);

  const choisirMetier = (m: Metier | 'toutes') => { setMetier(m); setDonnees(null); charger(m); };

  const affichees = useMemo(() => (donnees?.taches || []).filter((t) =>
    filtre === 'toutes' || (filtre === 'miennes' ? t.responsable?.id === donnees?.moi : !t.responsable)), [donnees, filtre]);

  const compte = (f: Filtre) => (donnees?.taches || []).filter((t) =>
    f === 'toutes' || (f === 'miennes' ? t.responsable?.id === donnees?.moi : !t.responsable)).length;

  async function affecter(t: TacheAffichee, action: 'prendre' | 'transferer' | 'liberer', membreId?: string) {
    setEnCours(t.dossier);
    try {
      const r = await fetch('/api/admin/affectations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // versionVue (A2) : le serveur refuse si un collègue a changé le dossier entre-temps.
        body: JSON.stringify({ dossier: t.dossier, action, membreId, versionVue: t.version }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Action impossible.', { ton: 'erreur' }); if (j.conflit) charger(metier); return; }
      setTransfert(null);
      toast(action === 'prendre' ? 'Dossier pris en charge.' : action === 'transferer' ? 'Dossier transféré.' : 'Dossier libéré.', { ton: 'succes' });
      charger(metier);
    } finally {
      setEnCours(null);
    }
  }

  const direction = donnees?.metierMembre === 'direction';

  return (
    <PageReseau titre="À traiter" large
      sousTitre="Les dossiers qui attendent une décision, les plus anciens d’abord."
      action={<Button type="button" variant="ghost" size="sm" onClick={() => charger(metier)} aria-label="Actualiser"><RefreshCw className="w-4 h-4" /></Button>}>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Métier">
        {(direction ? [{ valeur: 'toutes' as const, libelle: 'Tous les métiers' }, ...METIERS.filter((m) => m.valeur !== 'direction')] : METIERS.filter((m) => m.valeur === donnees?.metierMembre).concat([{ valeur: 'toutes' as never, libelle: 'Tout ce que je peux voir' }]))
          .map((m) => (
            <button key={m.valeur} type="button" onClick={() => choisirMetier(m.valeur)} aria-pressed={metier === m.valeur}
              className={`px-3 h-9 rounded-full text-xs font-bold border ${metier === m.valeur ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}>
              {m.libelle}
            </button>
          ))}
      </div>

      <div className="flex gap-2" role="group" aria-label="Responsable">
        {([['toutes', 'Tous'], ['miennes', 'Mes dossiers'], ['libres', 'Sans responsable']] as [Filtre, string][]).map(([f, libelle]) => (
          <button key={f} type="button" onClick={() => setFiltre(f)} aria-pressed={filtre === f}
            className={`px-3 h-9 rounded-xl text-xs font-bold ${filtre === f ? 'bg-suguba-profond text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
            {libelle}{donnees ? ` (${compte(f)})` : ''}
          </button>
        ))}
      </div>

      {donnees?.indisponibles.length ? (
        <Card className="!bg-amber-50 !border-amber-200 text-xs text-amber-900 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Lecture impossible pour : {donnees.indisponibles.join(', ')}. Ces dossiers ne sont pas dans la liste — ce n’est pas « rien à traiter ».</span>
        </Card>
      ) : null}

      {erreur ? <EmptyState icone={AlertTriangle} titre="File indisponible" texte={erreur} />
        : !donnees ? <Skeleton className="h-64" />
        : affichees.length === 0 ? (
          <EmptyState icone={Inbox} titre={filtre === 'miennes' ? 'Aucun dossier à votre nom' : 'Rien à traiter ici'}
            texte={donnees.indisponibles.length ? 'Certaines sources n’ont pas pu être lues (voir plus haut).' : 'Tous les dossiers de ce filtre sont traités.'} />
        ) : (
          <Card className="!p-0 overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {affichees.map((t) => {
                const niveau = urgence(t.depuis);
                const moi = t.responsable?.id === donnees.moi;
                const collegues = donnees.collegues.filter((c) => c.id !== donnees.moi && c.types.includes(t.type));
                return (
                  <li key={t.dossier} className="p-3 sm:p-4 lg:grid lg:grid-cols-[1fr_auto] lg:gap-4 lg:items-center space-y-2 lg:space-y-0">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-bold text-slate-700">{t.libelle}</span>
                        <span className={`text-xs ${COULEUR_URGENCE[niveau]}`}>{anciennete(t.depuis)}</span>
                        {t.montant ? <span className="text-xs font-semibold text-slate-700 tabular-nums">{fcfa(t.montant)}</span> : null}
                      </div>
                      <Link href={t.lien} className="block text-sm font-bold text-slate-900 hover:underline truncate">{t.titre}</Link>
                      {t.detail && <p className="text-xs text-slate-500 truncate">{t.detail}</p>}
                      <p className="text-xs text-slate-600">
                        {t.action} · Responsable : <strong>{moi ? 'vous' : t.responsable?.nom || 'personne'}</strong>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button href={t.lien} size="sm">Ouvrir</Button>
                      {(t.type === 'retrait_a_payer' || t.type === 'commande_a_confirmer' || t.type === 'livraison_a_attribuer' || t.type === 'sponsorisation_a_examiner') && (
                        <Button href={`/admin/diagnostic?type=${t.type === 'retrait_a_payer' ? 'retrait' : t.type === 'sponsorisation_a_examiner' ? 'sponsorisation' : 'commande'}&ref=${encodeURIComponent(t.type.startsWith('commande') || t.type.startsWith('livraison') ? t.titre.replace(/^Commande /, '') : t.id)}`} variant="ghost" size="sm">Pourquoi ?</Button>
                      )}
                      {!moi && <Button type="button" variant="ghost" size="sm" disabled={enCours === t.dossier} onClick={() => affecter(t, 'prendre')}><UserCheck className="w-4 h-4" />Prendre</Button>}
                      {collegues.length > 0 && (transfert === t.dossier ? (
                        <span className="inline-flex items-center gap-1">
                          <select aria-label="Transférer à" defaultValue="" onChange={(e) => e.target.value && affecter(t, 'transferer', e.target.value)}
                            className="h-9 px-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white">
                            <option value="" disabled>Transférer à…</option>
                            {collegues.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                          </select>
                          <button type="button" aria-label="Annuler" onClick={() => setTransfert(null)} className="w-9 h-9 inline-flex items-center justify-center text-slate-500"><X className="w-4 h-4" /></button>
                        </span>
                      ) : (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setTransfert(t.dossier)}><ArrowRightLeft className="w-4 h-4" />Transférer</Button>
                      ))}
                      {t.responsable && <Button type="button" variant="ghost" size="sm" disabled={enCours === t.dossier} onClick={() => affecter(t, 'liberer')}>Libérer</Button>}
                      <Button type="button" variant="ghost" size="sm" aria-expanded={notesOuvertes === t.dossier}
                        onClick={() => setNotesOuvertes(notesOuvertes === t.dossier ? null : t.dossier)}><StickyNote className="w-4 h-4" />Notes</Button>
                    </div>
                    {notesOuvertes === t.dossier && <div className="lg:col-span-2"><NotesInternes dossier={t.dossier} /></div>}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
    </PageReseau>
  );
}
