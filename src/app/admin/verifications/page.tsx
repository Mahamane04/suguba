'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, Check, X, ExternalLink, Phone } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { VERIFICATIONS } from '@/lib/reseau/badges';
import TableauAdmin, { type Colonne } from '@/components/admin/TableauAdmin';
import { useCibleUrl, usePermission, usePosteAdmin } from '@/components/admin/contexte';

/** File d'attente des vérifications (§ 42 des écrans ; tableau en U4, 2026-09-27). */

interface Demande {
  id: string;
  profileId: string;
  type: string;
  document: string | null;
  creeLe: string;
  nom: string | null;
  telephone: string | null;
}

function libelleType(type: string): string {
  return VERIFICATIONS.find((v) => v.valeur === type)?.libelle || type;
}

export default function VerificationsAdminPage() {
  const { toast, confirmer } = useToast();
  const cible = useCibleUrl();
  const peutDecider = usePermission('verification.decider');
  const { rafraichir } = usePosteAdmin();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = React.useCallback(() => {
    return fetch('/api/admin/verifications')
      .then((r) => r.json())
      .then((data) => setDemandes(data.demandes || []))
      .catch(() => { /* état vide */ })
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const decider = async (d: Demande, decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !(await confirmer({
      titre: `Refuser la pièce de ${d.nom || 'ce compte'} ?`, message: `${libelleType(d.type)} : la personne pourra en déposer une nouvelle.`,
      confirmer: 'Refuser', danger: true,
    }))) return;
    setEnCours(d.id);
    try {
      const reponse = await fetch('/api/admin/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demandeId: d.id, decision }),
      });
      const data = await reponse.json();
      if (!reponse.ok) { toast(data.error || 'Décision impossible.', { ton: 'erreur' }); return; }
      toast(decision === 'approved' ? 'Vérification validée.' : 'Vérification refusée.', { ton: 'succes' });
      await charger();
      rafraichir();
    } catch {
      toast('Décision impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally {
      setEnCours(null);
    }
  };

  const colonnes: Colonne<Demande>[] = [
    { cle: 'nom', titre: 'Compte', fixe: true, tri: (d) => d.nom || '', rendu: (d) => <span className="font-bold text-slate-900">{d.nom || 'Compte sans nom'}</span> },
    { cle: 'telephone', titre: 'Téléphone', rendu: (d) => (d.telephone
      ? <a href={`tel:${d.telephone}`} className="inline-flex items-center gap-1 tabular-nums text-suguba-profond hover:underline"><Phone className="w-3.5 h-3.5" />{d.telephone}</a> : '—') },
    { cle: 'type', titre: 'Pièce', tri: (d) => libelleType(d.type), rendu: (d) => <StatusPill ton="attente">{libelleType(d.type)}</StatusPill> },
    { cle: 'date', titre: 'Déposée le', tri: (d) => d.creeLe, rendu: (d) => new Date(d.creeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) },
    { cle: 'document', titre: 'Document', rendu: (d) => (d.document
      ? <a href={d.document} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-suguba-profond hover:underline"><ExternalLink className="w-3.5 h-3.5" />Ouvrir</a>
      : d.type === 'phone' ? <span className="text-slate-600">Appeler pour confirmer</span> : '—') },
    ...(peutDecider ? [{ cle: 'decision', titre: 'Décision', fixe: true, droite: true, rendu: (d: Demande) => (
      <span className="inline-flex gap-2 justify-end">
        <Button size="sm" variant="danger" disabled={enCours === d.id} onClick={() => decider(d, 'rejected')}><X className="w-4 h-4" />Refuser</Button>
        <Button size="sm" disabled={enCours === d.id} onClick={() => decider(d, 'approved')}>
          {enCours === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Valider
        </Button>
      </span>
    ) } as Colonne<Demande>] : []),
  ];

  return (
    <PageReseau titre="Vérifications" sousTitre="Pièces déposées par les comptes, en attente d’examen." large>
      {peutDecider === false && (
        <Card padding="p-4" className="!bg-slate-50 text-sm text-slate-700">Lecture seule : votre rôle ne permet pas de valider ou refuser une pièce.</Card>
      )}
      {chargement ? (
        <Skeleton className="h-48" />
      ) : demandes.length === 0 ? (
        <EmptyState icone={ShieldCheck} titre="File d’attente vide" texte="Aucune pièce en attente. Les nouveaux dépôts apparaîtront ici." />
      ) : (
        <TableauAdmin<Demande> titre="Pièces en attente" memoire="verifications" lignes={demandes} colonnes={colonnes} cleLigne={(d) => d.id} cible={cible}
          carteMobile={(d) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-slate-900 truncate">{d.nom || 'Compte sans nom'}</p>
                <StatusPill ton="attente">{libelleType(d.type)}</StatusPill>
              </div>
              <p className="text-xs text-slate-500">{d.telephone || '—'} · déposée le {new Date(d.creeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
              {d.document && <a href={d.document} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-suguba-profond"><ExternalLink className="w-3.5 h-3.5" />Ouvrir le document</a>}
              {peutDecider && (
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" fullWidth disabled={enCours === d.id} onClick={() => decider(d, 'rejected')}><X className="w-4 h-4" />Refuser</Button>
                  <Button size="sm" fullWidth disabled={enCours === d.id} onClick={() => decider(d, 'approved')}><Check className="w-4 h-4" />Valider</Button>
                </div>
              )}
            </div>
          )} />
      )}
    </PageReseau>
  );
}
