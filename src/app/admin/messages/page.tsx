'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, MessageSquareWarning, X } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';

interface Message { id: string; texte: string; motifs: string[]; auteur: string; nom: string; envoyeLe: string; dejaRefuses: number }
const AUTEUR: Record<string, string> = { revendeur: 'Revendeur', fournisseur: 'Fournisseur', client: 'Client' };

/**
 * Messages à vérifier (2026-09-26, Protection Suguba — lot 3) : un numéro, un
 * lien, une adresse e-mail ou une invitation à traiter hors Suguba. Une
 * référence de pièce ou un numéro de série légitime se publie tel quel.
 */
export default function MessagesAdminPage() {
  const { toast } = useToast();
  const [liste, setListe] = useState<Message[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [migration, setMigration] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState<string | null>(null);

  const charger = useCallback(() => fetch('/api/admin/messages', { cache: 'no-store' })
    .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lecture impossible.'); setListe(j.messages || []); setMigration(Boolean(j.migrationRequise)); })
    .catch((e) => setErreur((e as Error).message)), []);
  useEffect(() => { charger(); }, [charger]);

  const decider = async (id: string, decision: 'publier' | 'refuser') => {
    setEnvoi(id);
    try {
      const r = await fetch('/api/admin/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, decision, motif }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) { toast(j?.error || 'Décision impossible.', { ton: 'erreur' }); return; }
      toast(decision === 'publier' ? 'Message remis.' : 'Message refusé.', { ton: 'succes' });
      setRefus(null); setMotif('');
      await charger();
    } catch {
      toast('Connexion interrompue. Réessayez.', { ton: 'erreur' });
    } finally { setEnvoi(null); }
  };

  return (
    <PageReseau titre="Messages à vérifier" sousTitre="Numéros, liens et propositions de traiter hors Suguba." retour={{ href: '/admin/backoffice', libelle: 'Back-office' }}>
      {erreur ? <EmptyState icone={MessageSquareWarning} titre="Page indisponible" texte={erreur} />
        : !liste ? <Skeleton className="h-40" />
        : migration ? <EmptyState icone={MessageSquareWarning} titre="Mise à jour de la base nécessaire" texte="Exécutez le SQL A-EXECUTER-2026-09-26-protection-lot3.sql dans Supabase, puis rechargez la page." />
        : liste.length === 0 ? <EmptyState icone={MessageSquareWarning} titre="Rien à vérifier" texte="Les messages retenus apparaîtront ici." />
        : (
          <div className="space-y-3">
            {liste.map((m) => (
              <Card key={m.id} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-slate-600">{AUTEUR[m.auteur] || m.auteur}{m.nom ? ` · ${m.nom}` : ''} · {new Date(m.envoyeLe).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  {m.dejaRefuses > 0 && <StatusPill ton="danger">{m.dejaRefuses} déjà refusé{m.dejaRefuses > 1 ? 's' : ''}</StatusPill>}
                </div>
                <p className="text-sm text-slate-900 whitespace-pre-line break-words rounded-2xl bg-slate-50 px-3 py-2">{m.texte}</p>
                <div className="flex flex-wrap gap-1.5">{m.motifs.map((x) => <StatusPill key={x} ton="attente">{x}</StatusPill>)}</div>
                {refus === m.id ? (
                  <div className="space-y-2">
                    <Input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder="Motif du refus (l’auteur le verra)" aria-label="Motif du refus" />
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setRefus(null)}>Retour</Button>
                      <Button size="sm" onClick={() => decider(m.id, 'refuser')} disabled={envoi === m.id || motif.trim().length < 3}>
                        {envoi === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}Refuser
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" onClick={() => decider(m.id, 'publier')} disabled={envoi === m.id}>
                      {envoi === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}Remettre
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setRefus(m.id); setMotif(''); }}><X className="w-3.5 h-3.5" />Refuser</Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
    </PageReseau>
  );
}
