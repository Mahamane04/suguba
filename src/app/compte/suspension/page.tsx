'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Loader2, Send } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';

interface Suspension {
  id: string; espace: string; motif: string; depuis: string;
  contestation: string | null; contesteeLe: string | null; leveeLe: string | null; decision: string | null;
}

const date = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Mes suspensions (2026-09-26, Protection Suguba — lot 3) : le motif, et la
 * possibilité de contester. Les gains déjà acquis et les commandes en cours
 * ne sont pas perdus.
 */
export default function SuspensionPage() {
  const { toast } = useToast();
  const [liste, setListe] = useState<Suspension[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [texte, setTexte] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState<string | null>(null);

  const charger = useCallback(() => fetch('/api/compte/suspensions', { cache: 'no-store' })
    .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lecture impossible.'); setListe(j.suspensions || []); })
    .catch((e) => setErreur((e as Error).message)), []);
  useEffect(() => { charger(); }, [charger]);

  const contester = async (id: string) => {
    setEnvoi(id);
    try {
      const r = await fetch('/api/compte/suspensions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, texte: texte[id] || '' }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) { toast(j?.error || 'Envoi impossible.', { ton: 'erreur' }); return; }
      toast('Contestation envoyée : l’équipe Suguba va l’examiner.', { ton: 'succes' });
      await charger();
    } catch {
      toast('Connexion interrompue. Réessayez.', { ton: 'erreur' });
    } finally { setEnvoi(null); }
  };

  return (
    <PageReseau titre="Suspension" sousTitre="Le motif de la décision, et votre réponse." retour={{ href: '/', libelle: 'Accueil' }}>
      {erreur ? <EmptyState icone={Ban} titre="Page indisponible" texte={erreur} />
        : !liste ? <Skeleton className="h-40" />
        : liste.length === 0 ? <EmptyState icone={Ban} titre="Aucune suspension" texte="Aucun de vos espaces n’est suspendu." />
        : (
          <div className="space-y-3">
            {liste.map((s) => (
              <Card key={s.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-slate-900">Espace {s.espace}</p>
                  <StatusPill ton={s.leveeLe ? 'succes' : 'danger'}>{s.leveeLe ? 'Levée' : 'Suspendu'}</StatusPill>
                </div>
                <p className="text-sm text-slate-700"><strong>Motif</strong> ({date(s.depuis)}) : {s.motif}</p>
                {s.leveeLe && <p className="text-xs text-slate-600">Levée le {date(s.leveeLe)}{s.decision ? ` : ${s.decision}` : ''}</p>}
                {!s.leveeLe && (
                  <p className="text-xs text-slate-600">
                    Vos gains déjà acquis et vos commandes en cours ne sont pas perdus : l’équipe Suguba s’en occupe pendant la suspension.
                  </p>
                )}
                {s.contestation ? (
                  <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-700">
                    <p className="font-bold text-slate-900">Votre contestation ({s.contesteeLe ? date(s.contesteeLe) : ''})</p>
                    <p className="mt-1 whitespace-pre-line">{s.contestation}</p>
                    {!s.leveeLe && <p className="mt-1 text-slate-500">En cours d’examen.</p>}
                  </div>
                ) : !s.leveeLe && (
                  <div className="space-y-2">
                    <Textarea rows={4} maxLength={1500} value={texte[s.id] || ''} onChange={(e) => setTexte((t) => ({ ...t, [s.id]: e.target.value }))}
                      placeholder="Expliquez pourquoi vous contestez cette décision." aria-label="Votre contestation" />
                    <Button fullWidth onClick={() => contester(s.id)} disabled={envoi === s.id || (texte[s.id] || '').trim().length < 10}>
                      {envoi === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Contester la décision
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
    </PageReseau>
  );
}
