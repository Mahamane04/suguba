'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Gauge, Loader2, X } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { DELAI_GARANTIE_JOURS, DUREE_MIN_VISITE_S, PART_SUGUBA } from '@/lib/reseau/resultats-constantes';

interface Resultat {
  id: string; campagne: string; genre: 'visite' | 'demande'; revendeur: { nom: string; code: string | null };
  prix: number; partRevendeur: number; statut: 'retenu' | 'a_verifier' | 'conteste' | 'annule'; motif: string | null; creeLe: string;
}
interface LigneRevendeur {
  id: string; nom: string; code: string | null; ouvertes: number; qualifiees: number; robots: number;
  taux: number | null; maxMemeReseau: number; payes: number; annules: number; montant: number;
}
interface Donnees {
  migrationRequise: boolean; actif: boolean;
  total: { ouvertes: number; qualifiees: number; robots: number; payes: number; annules: number; montant: number } | null;
  revendeurs: LigneRevendeur[]; aVerifier: Resultat[]; recents: Resultat[];
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
const date = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const STATUT: Record<Resultat['statut'], [string, 'succes' | 'attente' | 'neutre']> = {
  retenu: ['Retenu', 'succes'], a_verifier: ['Suspect', 'attente'], conteste: ['Contesté', 'attente'], annule: ['Annulé', 'neutre'],
};
/** Au-delà, beaucoup de visites viennent d'un même réseau le même jour. */
const SEUIL_RESEAU = 5;

/**
 * Qualité des mesures et rémunération au résultat (2026-09-26, lot 3).
 * On juge d'abord la fiabilité des visites mesurées (30 jours), puis on
 * allume le paiement ; ensuite on vérifie les résultats suspects ou contestés.
 */
export default function ResultatsPage() {
  const { toast } = useToast();
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(() => fetch('/api/admin/resultats', { cache: 'no-store' })
    .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lecture impossible.'); setD(j); })
    .catch((e) => setErreur((e as Error).message)), []);
  useEffect(() => { charger(); }, [charger]);

  const basculer = async () => {
    if (!d) return;
    const actif = !d.actif;
    if (actif && !window.confirm('Activer le paiement au résultat ? Les fournisseurs pourront créer des campagnes payées à la visite ou à la demande, et les revendeurs seront payés.')) return;
    setEnvoi(true);
    try {
      const r = await fetch('/api/admin/resultats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'interrupteur', actif }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) { toast(j?.error || 'Enregistrement impossible.', { ton: 'erreur' }); return; }
      setD({ ...d, actif: j.actif });
      toast(j.actif ? 'Paiement au résultat activé.' : 'Paiement au résultat désactivé : mesure seule.', { ton: 'succes' });
    } catch {
      toast('Connexion interrompue. Réessayez.', { ton: 'erreur' });
    } finally { setEnvoi(false); }
  };

  const vues = d?.total ? d.total.ouvertes + d.total.qualifiees : 0;
  const taux = d?.total && vues > 0 ? Math.round((d.total.qualifiees / vues) * 100) : null;

  return (
    <PageReseau titre="Qualité des mesures" sousTitre="Visites et demandes qualifiées, paiement au résultat."
      retour={{ href: '/admin/backoffice', libelle: 'Back-office' }}>
      {erreur ? <EmptyState icone={Gauge} titre="Page indisponible" texte={erreur} /> : !d ? <Skeleton className="h-64" /> : d.migrationRequise ? (
        <EmptyState icone={Gauge} titre="Mise à jour de la base nécessaire"
          texte="Exécutez le SQL A-EXECUTER-2026-09-26-campagnes-resultat.sql dans Supabase, puis rechargez la page." />
      ) : (
        <>
          <Card className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">Payer les résultats</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {d.actif
                    ? `Activé : les campagnes au résultat sont ouvertes aux fournisseurs. Le revendeur reçoit ${Math.round((1 - PART_SUGUBA) * 100)} % du prix, retirable après ${DELAI_GARANTIE_JOURS} jours.`
                    : 'Désactivé : les visites sont mesurées, rien n’est payé, et les fournisseurs ne peuvent pas encore créer ces campagnes.'}
                </p>
              </div>
              <button type="button" role="switch" aria-checked={d.actif} aria-label="Payer les résultats" onClick={basculer} disabled={envoi}
                className={`shrink-0 relative w-12 h-7 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-suguba-brand/40 disabled:opacity-60 ${d.actif ? 'bg-suguba-profond' : 'bg-slate-300'}`}>
                <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${d.actif ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Conseil : n’activez qu’après quelques semaines de mesures, quand le taux de visites qualifiées et la part de robots sont stables.
            </p>
          </Card>

          {d.total && (
            <Card className="space-y-2">
              <p className="text-sm font-bold text-slate-900">30 derniers jours</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Chiffre libelle="Visites ouvertes" valeur={String(vues)} />
                <Chiffre libelle="Qualifiées" valeur={`${d.total.qualifiees}${taux !== null ? ` · ${taux} %` : ''}`} />
                <Chiffre libelle="Robots écartés" valeur={String(d.total.robots)} />
                <Chiffre libelle="Résultats payés" valeur={String(d.total.payes)} />
                <Chiffre libelle="Annulés" valeur={String(d.total.annules)} />
                <Chiffre libelle="Montant" valeur={fcfa(d.total.montant)} />
              </div>
              <p className="text-xs text-slate-500">
                Une visite devient qualifiée quand le visiteur reste {DUREE_MIN_VISITE_S} s et touche l’écran. Les robots sont les aperçus de liens (WhatsApp, Facebook…).
              </p>
            </Card>
          )}

          <Card className="space-y-3">
            <p className="text-sm font-bold text-slate-900">À vérifier ({d.aVerifier.length})</p>
            {d.aVerifier.length === 0
              ? <p className="text-xs text-slate-500">Aucun résultat suspect ou contesté.</p>
              : d.aVerifier.map((r) => <LigneResultat key={r.id} r={r} onMaj={charger} verification />)}
          </Card>

          <Card className="space-y-3">
            <p className="text-sm font-bold text-slate-900">Par revendeur</p>
            {d.revendeurs.length === 0 ? <p className="text-xs text-slate-500">Aucune visite mesurée pour l’instant.</p> : (
              <ul className="divide-y divide-slate-100">
                {d.revendeurs.map((v) => (
                  <li key={v.id} className="py-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-900 truncate">{v.nom}{v.code ? <span className="text-slate-500 font-normal"> · {v.code}</span> : null}</span>
                      {v.maxMemeReseau >= SEUIL_RESEAU && <StatusPill ton="attente">{v.maxMemeReseau} du même réseau</StatusPill>}
                    </div>
                    <p className="text-xs text-slate-600">
                      {v.qualifiees} qualifiées sur {v.ouvertes + v.qualifiees}{v.taux !== null ? ` (${v.taux} %)` : ''} · {v.robots} robots
                      {v.payes + v.annules > 0 ? ` · ${v.payes} payés, ${v.annules} annulés · ${fcfa(v.montant)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="space-y-3">
            <p className="text-sm font-bold text-slate-900">Derniers résultats</p>
            {d.recents.length === 0
              ? <p className="text-xs text-slate-500">Aucun résultat payé pour l’instant.</p>
              : d.recents.map((r) => <LigneResultat key={r.id} r={r} onMaj={charger} />)}
          </Card>
        </>
      )}
    </PageReseau>
  );
}

function Chiffre({ libelle, valeur }: { libelle: string; valeur: string }) {
  return <p className="rounded-2xl bg-slate-50 px-3 py-2">{libelle}<br /><strong className="text-slate-900 tabular-nums">{valeur}</strong></p>;
}

function LigneResultat({ r, onMaj, verification = false }: { r: Resultat; onMaj: () => void; verification?: boolean }) {
  const { toast } = useToast();
  const [annulation, setAnnulation] = useState(false);
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [libelle, ton] = STATUT[r.statut];

  const decider = async (decision: 'valider' | 'annuler') => {
    setEnvoi(true);
    try {
      const res = await fetch('/api/admin/resultats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decider', id: r.id, decision, motif }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { toast(j?.error || 'Décision impossible.', { ton: 'erreur' }); return; }
      toast(decision === 'valider' ? 'Résultat validé.' : 'Résultat annulé, prix rendu au budget.', { ton: 'succes' });
      onMaj();
    } catch {
      toast('Connexion interrompue. Réessayez.', { ton: 'erreur' });
    } finally { setEnvoi(false); }
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{r.campagne}</p>
          <p className="text-xs text-slate-600">
            {r.genre === 'visite' ? 'Visite' : 'Demande'} · {r.revendeur.nom}{r.revendeur.code ? ` (${r.revendeur.code})` : ''} · {fcfa(r.prix)}, dont {fcfa(r.partRevendeur)} au revendeur · {date(r.creeLe)}
          </p>
          {r.motif && <p className="text-xs text-amber-800 mt-1">Motif : {r.motif}</p>}
        </div>
        <StatusPill ton={ton}>{libelle}</StatusPill>
      </div>
      {r.statut !== 'annule' && (annulation ? (
        <div className="space-y-2">
          <Input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder="Motif (le revendeur le verra)" aria-label="Motif de l’annulation" />
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAnnulation(false)}>Retour</Button>
            <Button size="sm" onClick={() => decider('annuler')} disabled={envoi || motif.trim().length < 3}>
              {envoi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}Annuler le résultat
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {verification && (
            <Button size="sm" onClick={() => decider('valider')} disabled={envoi}>
              {envoi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}Valider
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setAnnulation(true)} className={verification ? '' : 'col-span-2'}>
            <X className="w-3.5 h-3.5" />Annuler
          </Button>
        </div>
      ))}
    </div>
  );
}
