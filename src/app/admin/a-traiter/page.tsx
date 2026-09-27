'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Inbox, RefreshCw, AlertTriangle, UserCheck, ArrowRightLeft, X, HelpCircle, ArrowRight } from 'lucide-react';
import NotesInternes from '@/components/admin/NotesInternes';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import Panneau, { Info } from '@/components/admin/Panneau';
import DossierCommande, { useCommandeParNumero } from '@/components/admin/DossierCommande';
import { usePosteAdmin } from '@/components/admin/contexte';
import { METIERS, anciennete, urgence, type Metier, type TacheAffichee } from '@/lib/admin/poste';

interface Collegue { id: string; nom: string; types: string[] }
interface Reponse {
  metier: Metier | 'toutes'; metierMembre: Metier; moi: string;
  taches: TacheAffichee[]; indisponibles: string[]; collegues: Collegue[];
}
type Filtre = 'toutes' | 'miennes' | 'libres';

const COULEUR_URGENCE = { normale: 'text-slate-500', a_surveiller: 'text-amber-700 font-semibold', en_retard: 'text-rose-700 font-bold' } as const;
const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

/** Lien « Pourquoi c'est bloqué ? » d'une tâche, s'il y en a un. */
function diagnostic(t: TacheAffichee): string | null {
  if (t.type === 'retrait_a_payer') return `/admin/diagnostic?type=retrait&ref=${encodeURIComponent(t.id)}`;
  if (t.type === 'sponsorisation_a_examiner') return `/admin/diagnostic?type=sponsorisation&ref=${encodeURIComponent(t.id)}`;
  return null;
}
/** Numéro de commande d'une tâche « commande » (lu dans son lien). */
function numeroCommande(t: TacheAffichee | null): string | null {
  if (!t || (t.type !== 'commande_a_confirmer' && t.type !== 'livraison_a_attribuer')) return null;
  return new URLSearchParams(t.lien.split('?')[1] || '').get('q');
}

/**
 * « À traiter » (A1, 2026-09-27 ; panneau en U2) — la file de travail de
 * l'équipe : les dossiers qui attendent une décision, les plus anciens
 * d'abord, avec leur responsable. Chacun arrive sur son métier ; la Direction
 * voit tout.
 *
 * « Ouvrir » affiche le dossier dans le panneau latéral, sans quitter la
 * file : une commande s'y confirme ou s'y attribue directement ; les autres
 * dossiers mènent à leur page, positionnée sur le bon dossier.
 */
export default function ATraiterPage() {
  const { toast } = useToast();
  const { rafraichir } = usePosteAdmin();
  const [metier, setMetier] = useState<Metier | 'toutes' | null>(null);
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('toutes');
  const [enCours, setEnCours] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);

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

  const tache = donnees?.taches.find((t) => t.dossier === ouverte) || null;
  const { commande, erreur: erreurCommande } = useCommandeParNumero(numeroCommande(tache));

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
      toast(action === 'prendre' ? 'Dossier pris en charge.' : action === 'transferer' ? 'Dossier transféré.' : 'Dossier libéré.', { ton: 'succes' });
      charger(metier);
    } finally {
      setEnCours(null);
    }
  }

  const apresAction = () => { setOuverte(null); charger(metier); rafraichir(); };
  const direction = donnees?.metierMembre === 'direction';
  const puce = (actif: boolean) => `px-3.5 h-10 rounded-full text-sm font-semibold ${actif ? 'bg-suguba-profond text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`;

  return (
    <PageReseau titre="À traiter" large
      sousTitre="Les dossiers qui attendent une décision, les plus anciens d’abord."
      action={<Button type="button" variant="ghost" size="sm" onClick={() => { charger(metier); rafraichir(); }} aria-label="Actualiser"><RefreshCw className="w-4 h-4" /></Button>}>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Métier">
          {(direction ? [{ valeur: 'toutes' as const, libelle: 'Tous les métiers' }, ...METIERS.filter((m) => m.valeur !== 'direction')] : METIERS.filter((m) => m.valeur === donnees?.metierMembre))
            .map((m) => (
              <button key={m.valeur} type="button" onClick={() => choisirMetier(m.valeur)} aria-pressed={metier === m.valeur} className={puce(metier === m.valeur)}>
                {m.libelle}
              </button>
            ))}
        </div>
        <span className="hidden lg:block w-px h-6 bg-slate-300 mx-1" aria-hidden="true" />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Responsable">
          {([['toutes', 'Tous'], ['miennes', 'Mes dossiers'], ['libres', 'Sans responsable']] as [Filtre, string][]).map(([f, libelle]) => (
            <button key={f} type="button" onClick={() => setFiltre(f)} aria-pressed={filtre === f} className={puce(filtre === f)}>
              {libelle}{donnees ? ` (${compte(f)})` : ''}
            </button>
          ))}
        </div>
      </div>

      {donnees?.indisponibles.length ? (
        <Card padding="p-4" className="!bg-amber-50 !border-amber-200 text-sm text-amber-900 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Lecture impossible pour : {donnees.indisponibles.join(', ')}. Ces dossiers ne sont pas dans la liste : ce n’est pas « rien à traiter ».</span>
        </Card>
      ) : null}

      {erreur ? <EmptyState icone={AlertTriangle} titre="File indisponible" texte={erreur} action={<Button variant="ghost" onClick={() => charger(metier)}>Réessayer</Button>} />
        : !donnees ? <Skeleton className="h-64" />
        : affichees.length === 0 ? (
          <EmptyState icone={Inbox} titre={filtre === 'miennes' ? 'Aucun dossier à votre nom' : 'Rien à traiter ici'}
            texte={donnees.indisponibles.length ? 'Certaines sources n’ont pas pu être lues (voir plus haut).' : 'Tous les dossiers de ce filtre sont traités.'} />
        ) : (
          <Card padding="p-0" className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {affichees.map((t) => {
                const niveau = urgence(t.depuis);
                const moi = t.responsable?.id === donnees.moi;
                return (
                  <li key={t.dossier} className={`p-3 sm:p-4 lg:grid lg:grid-cols-[1fr_auto] lg:gap-4 lg:items-center space-y-2 lg:space-y-0 ${ouverte === t.dossier ? 'bg-suguba-menthe' : ''}`}>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill ton="neutre">{t.libelle}</StatusPill>
                        <span className={`text-xs ${COULEUR_URGENCE[niveau]}`}>{anciennete(t.depuis)}</span>
                        {t.montant ? <span className="text-xs font-semibold text-slate-700 tabular-nums">{fcfa(t.montant)}</span> : null}
                      </div>
                      <button type="button" onClick={() => setOuverte(t.dossier)} className="block text-left text-sm font-bold text-slate-900 hover:underline truncate max-w-full">{t.titre}</button>
                      {t.detail && <p className="text-xs text-slate-500 truncate">{t.detail}</p>}
                      <p className="text-xs text-slate-600">{t.action} · Responsable : <strong>{moi ? 'vous' : t.responsable?.nom || 'personne'}</strong></p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button type="button" size="sm" onClick={() => setOuverte(t.dossier)}>Ouvrir</Button>
                      {!moi && <Button type="button" variant="ghost" size="sm" disabled={enCours === t.dossier} onClick={() => affecter(t, 'prendre')}><UserCheck className="w-4 h-4" />Prendre</Button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

      <Panneau ouvert={Boolean(tache)} onFermer={() => setOuverte(null)} titre={tache?.titre || ''}
        sousTitre={tache ? `${tache.libelle} · ${anciennete(tache.depuis)}` : undefined}>
        {tache && donnees && (
          <>
            {numeroCommande(tache) ? (
              commande ? <DossierCommande key={commande.id} commande={commande} onFait={apresAction} />
                : erreurCommande ? <p role="alert" className="text-sm text-rose-700">{erreurCommande}</p>
                : <Skeleton className="h-48" />
            ) : (
              <>
                <dl>
                  {tache.detail && <Info libelle="Détail">{tache.detail}</Info>}
                  {tache.montant ? <Info libelle="Montant">{fcfa(tache.montant)}</Info> : null}
                  <Info libelle="À faire">{tache.action}</Info>
                </dl>
                <Button href={tache.lien} fullWidth>Ouvrir le dossier<ArrowRight className="w-4 h-4" /></Button>
                {diagnostic(tache) && (
                  <Link href={diagnostic(tache)!} className="inline-flex items-center gap-1.5 text-sm font-semibold text-suguba-profond hover:underline">
                    <HelpCircle className="w-4 h-4" />Pourquoi c’est bloqué ?
                  </Link>
                )}
              </>
            )}

            <Responsable key={tache.dossier} tache={tache} donnees={donnees} enCours={enCours === tache.dossier} affecter={affecter} />

            {/* Les notes d'une commande sont déjà dans son dossier, ci-dessus. */}
            {!numeroCommande(tache) && <NotesInternes dossier={tache.dossier} />}
          </>
        )}
      </Panneau>
    </PageReseau>
  );
}

/** Qui s'occupe du dossier : prendre, transférer à un collègue qui peut le traiter, libérer. */
function Responsable({ tache, donnees, enCours, affecter }: {
  tache: TacheAffichee; donnees: Reponse; enCours: boolean;
  affecter: (t: TacheAffichee, action: 'prendre' | 'transferer' | 'liberer', membreId?: string) => void;
}) {
  const [transfert, setTransfert] = useState(false);
  const moi = tache.responsable?.id === donnees.moi;
  const collegues = donnees.collegues.filter((c) => c.id !== donnees.moi && c.types.includes(tache.type));
  return (
    <Card padding="p-4" className="space-y-2 !bg-slate-50">
      <p className="text-sm text-slate-700">Responsable : <strong className="text-slate-900">{moi ? 'vous' : tache.responsable?.nom || 'personne'}</strong></p>
      <div className="flex flex-wrap gap-2">
        {!moi && <Button size="sm" variant="ghost" disabled={enCours} onClick={() => affecter(tache, 'prendre')}><UserCheck className="w-4 h-4" />Prendre</Button>}
        {collegues.length > 0 && (transfert ? (
          <span className="inline-flex items-center gap-1">
            <label htmlFor="transfert-collegue" className="sr-only">Transférer à</label>
            <select id="transfert-collegue" defaultValue="" onChange={(e) => e.target.value && affecter(tache, 'transferer', e.target.value)}
              className="h-10 px-3 rounded-full border border-slate-300 text-sm font-semibold bg-white">
              <option value="" disabled>Transférer à…</option>
              {collegues.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <button type="button" aria-label="Annuler le transfert" onClick={() => setTransfert(false)} className="w-10 h-10 inline-flex items-center justify-center text-slate-500"><X className="w-4 h-4" /></button>
          </span>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setTransfert(true)}><ArrowRightLeft className="w-4 h-4" />Transférer</Button>
        ))}
        {tache.responsable && <Button size="sm" variant="ghost" disabled={enCours} onClick={() => affecter(tache, 'liberer')}>Libérer</Button>}
      </div>
    </Card>
  );
}
