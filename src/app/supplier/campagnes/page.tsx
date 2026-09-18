'use client';

import React, { useEffect, useState } from 'react';
import { Rocket, Loader2, Plus, Users, Target } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import ChoicePicker from '@/components/ui/ChoicePicker';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { progression } from '@/lib/reseau/missions';

/**
 * Campagnes (§ page 24) : le fournisseur mobilise des revendeurs autour d'un
 * produit — partages, visites ou ventes — contre une récompense qu'il finance.
 * Le budget affiché = récompense × nombre de revendeurs : c'est ce qu'il règle
 * à Suguba avant l'ouverture.
 */

interface Campagne {
  id: string; titre: string; type: string; objectif: number; recompense: number;
  maxParticipants: number | null; participants: number; statut: string;
  finitLe: string | null; budget: number; avancementTotal: number;
}

const OBJECTIFS = [
  { valeur: 'share', libelle: 'Partages', detail: 'Faire connaître le produit' },
  { valeur: 'click', libelle: 'Visites', detail: 'Amener du monde sur la fiche' },
  { valeur: 'sale', libelle: 'Ventes', detail: 'Vendre le produit' },
];
const STATUT: Record<string, [string, 'succes' | 'attente' | 'neutre']> = {
  draft: ['En attente de validation', 'attente'], active: ['En cours', 'succes'],
  paused: ['En pause', 'neutre'], ended: ['Terminée', 'neutre'],
};
const fcfa = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} F`;

export default function CampagnesPage() {
  const { toast } = useToast();
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [produits, setProduits] = useState<{ id: string; nom: string }[]>([]);
  const [chargement, setChargement] = useState(true);
  const [formulaire, setFormulaire] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [produitId, setProduitId] = useState('');
  const [type, setType] = useState('share');
  const [objectif, setObjectif] = useState('10');
  const [recompense, setRecompense] = useState('2000');
  const [maxRevendeurs, setMaxRevendeurs] = useState('10');
  const [finitLe, setFinitLe] = useState('');

  const charger = React.useCallback(() => fetch('/api/supplier/campagnes')
    .then((r) => r.json())
    .then((d) => { setCampagnes(d.campagnes || []); setProduits(d.produits || []); })
    .catch(() => undefined)
    .finally(() => setChargement(false)), []);
  useEffect(() => { charger(); }, [charger]);

  const budget = (Number(recompense) || 0) * (Number(maxRevendeurs) || 0);

  const creer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    try {
      const r = await fetch('/api/supplier/campagnes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre, description, produitId, type, objectif: Number(objectif), recompense: Number(recompense), maxRevendeurs: Number(maxRevendeurs), finitLe: finitLe || null }),
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Création impossible.', { ton: 'erreur' }); return; }
      toast(`Campagne envoyée. Budget à régler : ${fcfa(d.budget)}. Suguba vous contacte.`, { ton: 'succes' });
      setFormulaire(false); setTitre(''); setDescription('');
      await charger();
    } catch {
      toast('Création impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally { setEnvoi(false); }
  };

  return (
    <PageReseau titre="Campagnes" sousTitre="Mobilisez les revendeurs autour d’un produit."
      retour={{ href: '/supplier', libelle: 'Espace fournisseur' }}
      action={<Button size="sm" onClick={() => setFormulaire((v) => !v)} disabled={produits.length === 0}><Plus className="w-4 h-4" />Nouvelle</Button>}>

      {formulaire && (
        <Card>
          <form onSubmit={creer} className="space-y-3">
            <Field label="Titre" htmlFor="titre" requis>
              <Input id="titre" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={120} required placeholder="Lancement de la TV 55 pouces" />
            </Field>
            <Field label="Produit" htmlFor="produit" requis>
              <ChoicePicker id="produit" valeur={produitId} onChange={setProduitId} placeholder="Choisir un produit"
                choix={produits.map((p) => ({ valeur: p.id, libelle: p.nom }))} />
            </Field>
            <Field label="Objectif pour chaque revendeur" htmlFor="type">
              <ChoicePicker id="type" valeur={type} onChange={setType} choix={OBJECTIFS} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantité à atteindre" htmlFor="objectif">
                <Input id="objectif" type="number" inputMode="numeric" min={1} value={objectif} onChange={(e) => setObjectif(e.target.value)} />
              </Field>
              <Field label="Récompense (F)" htmlFor="recompense" aide="Par revendeur qui atteint l’objectif.">
                <Input id="recompense" type="number" inputMode="numeric" min={0} step={500} value={recompense} onChange={(e) => setRecompense(e.target.value)} />
              </Field>
              <Field label="Revendeurs max" htmlFor="max">
                <Input id="max" type="number" inputMode="numeric" min={1} value={maxRevendeurs} onChange={(e) => setMaxRevendeurs(e.target.value)} />
              </Field>
              <Field label="Fin (facultatif)" htmlFor="fin">
                <Input id="fin" type="date" value={finitLe} onChange={(e) => setFinitLe(e.target.value)} />
              </Field>
            </div>
            <Field label="Consignes (facultatif)" htmlFor="description">
              <Textarea id="description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} />
            </Field>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 flex items-center justify-between">
              <span className="text-xs text-slate-600">Budget maximum</span>
              <span className="text-lg font-black text-slate-900 tabular-nums">{fcfa(budget)}</span>
            </div>
            <Button type="submit" fullWidth disabled={envoi || !produitId}>
              {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}Envoyer la campagne
            </Button>
            <p className="text-[11px] text-slate-500">Suguba vous contacte pour le règlement du budget, puis ouvre la campagne aux revendeurs.</p>
          </form>
        </Card>
      )}

      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : campagnes.length === 0 ? (
        <EmptyState icone={Rocket} titre="Aucune campagne"
          texte={produits.length === 0 ? 'Il faut au moins un produit en vente pour lancer une campagne.' : 'Lancez une campagne : les revendeurs partagent et vendent votre produit, vous ne payez que les objectifs atteints.'}
          action={produits.length > 0 ? <Button onClick={() => setFormulaire(true)}>Créer une campagne</Button> : undefined} />
      ) : (
        <div className="space-y-3">
          {campagnes.map((c) => {
            const [libelle, ton] = STATUT[c.statut] || [c.statut, 'neutre'];
            const vise = c.objectif * (c.maxParticipants || 1);
            const pct = progression(c.avancementTotal, vise);
            return (
              <Card key={c.id} className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-black text-slate-900 min-w-0 truncate">{c.titre}</p>
                  <StatusPill ton={ton}>{libelle}</StatusPill>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusPill ton="neutre"><Target className="w-3 h-3" />{c.objectif} {OBJECTIFS.find((o) => o.valeur === c.type)?.libelle.toLowerCase()}</StatusPill>
                  <StatusPill ton="neutre"><Users className="w-3 h-3" />{c.participants}/{c.maxParticipants || '∞'} revendeurs</StatusPill>
                  <StatusPill ton="neutre">{fcfa(c.recompense)} / revendeur</StatusPill>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-suguba-brand" style={{ width: `${pct}%` }} /></div>
                <p className="text-[11px] text-slate-500">{c.avancementTotal} / {vise} au total · budget {fcfa(c.budget)}</p>
              </Card>
            );
          })}
        </div>
      )}
    </PageReseau>
  );
}
