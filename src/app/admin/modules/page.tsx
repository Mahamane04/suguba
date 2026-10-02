'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ToggleRight } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';

interface ModuleEtat {
  cle: string; titre: string; ouvre: string; continue: string; lien: string;
  interrupteur: 'priorite-reseau' | 'resultats' | null; actif: boolean; detail?: string; peutChanger: boolean;
}

/**
 * Centre des modules (A5, 2026-09-27) : ce qui est ouvert ou fermé sur
 * Suguba, ce que chaque module ouvre et ce qui continue quand il est fermé.
 * Les interrupteurs simples se changent ici ; les autres renvoient vers leur
 * page (qui garde ses contrôles : motif, confirmation…).
 */
export default function ModulesPage() {
  const { toast, confirmer } = useToast();
  const [modules, setModules] = useState<ModuleEtat[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = useCallback(() => {
    fetch('/api/admin/modules', { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lecture impossible.'); return j; })
      .then((j) => setModules(j.modules || []))
      .catch((e) => setErreur((e as Error).message));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function basculer(m: ModuleEtat) {
    const ok = await confirmer({
      titre: `${m.actif ? 'Fermer' : 'Ouvrir'} « ${m.titre} » ?`,
      message: m.actif ? m.continue : m.ouvre,
      confirmer: m.actif ? 'Fermer' : 'Ouvrir',
    });
    if (!ok) return;
    setEnCours(m.cle);
    try {
      const r = m.interrupteur === 'resultats'
        ? await fetch('/api/admin/resultats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'interrupteur', actif: !m.actif }) })
        : await fetch('/api/admin/priorite-reseau', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [m.cle]: !m.actif }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Changement impossible.', { ton: 'erreur' }); return; }
      toast(`« ${m.titre} » ${m.actif ? 'fermé' : 'ouvert'}.`, { ton: 'succes' }); charger();
    } finally { setEnCours(null); }
  }

  return (
    <PageReseau titre="Centre des modules" large sousTitre="Ce qui est ouvert ou fermé sur Suguba, au même endroit.">
      <Card className="text-xs text-slate-600">Fermer un module arrête les NOUVELLES opérations ; les dossiers déjà engagés (commandes, gains, campagnes en cours) suivent leur cours. Un interrupteur ne crée jamais une fonctionnalité qui n’existe pas.</Card>
      {erreur ? <EmptyState icone={ToggleRight} titre="Indisponible" texte={erreur} />
        : !modules ? <Skeleton className="h-64" />
        : (
          <div className="grid md:grid-cols-2 gap-3">
            {modules.map((m) => (
              <Card key={m.cle} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-bold text-slate-900">{m.titre}</h2>
                  <StatusPill ton={m.actif ? 'succes' : 'neutre'}>{m.actif ? 'Ouvert' : 'Fermé'}</StatusPill>
                </div>
                {m.detail && <p className="text-xs font-semibold text-slate-700">{m.detail}</p>}
                {/* ADM-15 : « Fermé : Fermé : … » — le préfixe était aussi dans le texte. */}
                <p className="text-sm text-slate-600"><strong>Ouvert :</strong> {m.ouvre}</p>
                <p className="text-sm text-slate-600"><strong>Fermé :</strong> {m.continue}</p>
                <div className="flex gap-2 pt-1">
                  {m.interrupteur && m.peutChanger && (
                    <Button type="button" size="sm" variant={m.actif ? 'secondary' : 'primary'} disabled={enCours === m.cle} onClick={() => basculer(m)}>
                      {m.actif ? 'Fermer' : 'Ouvrir'}
                    </Button>
                  )}
                  <Link href={m.lien} className="h-9 px-3 rounded-xl text-xs font-bold text-slate-700 inline-flex items-center hover:bg-slate-100">Réglage détaillé</Link>
                  {!m.peutChanger && <span className="text-xs text-slate-500 self-center">Votre rôle ne permet pas de le changer.</span>}
                </div>
              </Card>
            ))}
          </div>
        )}
    </PageReseau>
  );
}
