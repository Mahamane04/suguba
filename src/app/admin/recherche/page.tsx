'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';

interface Synonyme { id: string; terme: string; equivalent: string }
interface Trouve { slug: string; nom: string; prix: number; mention: 'partenaire' | 'des' | null }

/**
 * Recherche (R1, 2026-09-26) : le dictionnaire des mots des clients et un
 * essai de la recherche, telle que la voit un visiteur.
 */
export default function RechercheAdminPage() {
  const [synonymes, setSynonymes] = useState<Synonyme[] | null>(null);
  const [migration, setMigration] = useState(false);
  const [erreurListe, setErreurListe] = useState('');
  const [terme, setTerme] = useState('');
  const [equivalent, setEquivalent] = useState('');
  const [erreurAjout, setErreurAjout] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [essai, setEssai] = useState('');
  const [resultats, setResultats] = useState<Trouve[] | null>(null);
  const [erreurEssai, setErreurEssai] = useState('');

  const charger = useCallback(() => {
    fetch('/api/admin/recherche-synonymes', { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lecture impossible.'); return j; })
      .then((j) => { setSynonymes(j.synonymes || []); setMigration(Boolean(j.migrationRequise)); setErreurListe(''); })
      .catch((e) => setErreurListe((e as Error).message));
  }, []);
  useEffect(charger, [charger]);

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true); setErreurAjout('');
    try {
      const r = await fetch('/api/admin/recherche-synonymes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ terme, equivalent }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Enregistrement impossible.');
      setTerme(''); setEquivalent(''); charger();
    } catch (err) {
      setErreurAjout((err as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  async function retirer(s: Synonyme) {
    const r = await fetch(`/api/admin/recherche-synonymes?id=${encodeURIComponent(s.id)}`, { method: 'DELETE' });
    if (r.ok) charger(); else setErreurListe('Suppression impossible.');
  }

  async function essayer(e: React.FormEvent) {
    e.preventDefault();
    setErreurEssai(''); setResultats(null);
    try {
      const r = await fetch(`/api/reseau/recherche?q=${encodeURIComponent(essai.trim())}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Recherche indisponible.');
      setResultats(j.produits || []);
    } catch (err) {
      setErreurEssai((err as Error).message);
    }
  }

  return (
    <PageReseau titre="Recherche" sousTitre="Les mots des clients et un essai de la recherche.">
      <Card className="text-xs text-slate-600 space-y-1">
        <p>La recherche ignore les accents et les majuscules, tolère les fautes de frappe et cherche dans le nom, la catégorie et la description.</p>
        <p className="font-semibold text-slate-800">Un synonyme relie un mot des clients à un mot du catalogue : « frigo » trouve alors les réfrigérateurs, et inversement.</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Essayer une recherche</h2>
        <form onSubmit={essayer} className="flex gap-2">
          <Input type="search" value={essai} onChange={(e) => setEssai(e.target.value)} placeholder="frigo, refrigerateur, samsumg…" aria-label="Recherche à essayer" />
          <Button type="submit" variant="secondary" size="md" disabled={essai.trim().length < 2}><Search className="w-4 h-4" />Essayer</Button>
        </form>
        {erreurEssai && <p role="alert" className="text-xs font-semibold text-rose-700">{erreurEssai}</p>}
        {resultats && (resultats.length === 0
          ? <p className="text-xs text-slate-600">Aucun article en vente ne correspond. Un synonyme peut aider.</p>
          : (
            <ol className="divide-y divide-slate-100 text-sm">
              {resultats.map((p) => (
                <li key={p.slug} className="py-2 flex items-center justify-between gap-3">
                  <span className="truncate text-slate-900">{p.nom}</span>
                  <span className="tabular-nums text-slate-600 shrink-0">{p.mention === 'des' ? 'dès ' : ''}{p.prix.toLocaleString('fr-FR')} F</span>
                </li>
              ))}
            </ol>
          ))}
      </Card>

      {erreurListe ? <EmptyState icone={Search} titre="Dictionnaire indisponible" texte={erreurListe} />
        : !synonymes ? <Skeleton className="h-48" />
        : migration ? <EmptyState icone={Search} titre="Mise à jour de la base nécessaire" texte="Exécutez le SQL A-EXECUTER-2026-09-26-recherche.sql dans Supabase, puis rechargez la page." />
        : (
          <Card className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Synonymes ({synonymes.length})</h2>
            <form onSubmit={ajouter} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <Field label="Mot des clients" aide="Un seul mot, ex. frigo">
                <Input value={terme} onChange={(e) => setTerme(e.target.value)} maxLength={30} />
              </Field>
              <Field label="Mot du catalogue" aide="Ex. réfrigérateur">
                <Input value={equivalent} onChange={(e) => setEquivalent(e.target.value)} maxLength={60} />
              </Field>
              <Button type="submit" size="md" disabled={envoi || !terme.trim() || !equivalent.trim()}>Ajouter</Button>
            </form>
            {erreurAjout && <p role="alert" className="text-xs font-semibold text-rose-700">{erreurAjout}</p>}
            {synonymes.length === 0 ? <p className="text-xs text-slate-600">Aucun synonyme pour l’instant.</p> : (
              <ul className="divide-y divide-slate-100">
                {synonymes.map((s) => (
                  <li key={s.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-900"><strong>{s.terme}</strong> <span className="text-slate-500">↔</span> {s.equivalent}</span>
                    <button type="button" onClick={() => retirer(s)} aria-label={`Retirer ${s.terme}`}
                      className="w-11 h-11 rounded-full hover:bg-rose-50 text-slate-500 hover:text-rose-700 flex items-center justify-center shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
    </PageReseau>
  );
}
