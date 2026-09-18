'use client';

import React, { useEffect, useState } from 'react';
import { Target, Loader2, Plus, Play, Pause, Square } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { TYPES_MISSION, libelleType, verbeType, type TypeMission } from '@/lib/reseau/missions';

/**
 * Administration des missions (§ 48 des écrans).
 *
 * Une mission créée ici naît en BROUILLON : elle n'est visible du réseau
 * qu'après une activation explicite. Une frappe malheureuse ne peut donc pas
 * promettre une récompense à tous les revendeurs d'un coup.
 */

interface Mission {
  id: string;
  titre: string;
  type: TypeMission;
  objectif: number;
  recompense: number;
  statut: 'draft' | 'active' | 'paused' | 'ended';
  participants: number;
  finitLe: string | null;
  supplierId: string | null;
  maxParticipants: number | null;
}

const TON: Record<string, 'succes' | 'attente' | 'neutre'> = {
  active: 'succes', draft: 'attente', paused: 'neutre', ended: 'neutre',
};
const LIBELLE_STATUT: Record<string, string> = {
  active: 'Active', draft: 'Brouillon', paused: 'En pause', ended: 'Terminée',
};

export default function MissionsAdminPage() {
  const { toast } = useToast();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);

  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TypeMission>('share');
  const [objectif, setObjectif] = useState('10');
  const [recompense, setRecompense] = useState('5000');
  const [finitLe, setFinitLe] = useState('');

  const charger = React.useCallback(() => {
    return fetch('/api/admin/missions')
      .then((r) => r.json())
      .then((data) => setMissions(data.missions || []))
      .catch(() => { /* état vide */ })
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const creer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    try {
      const reponse = await fetch('/api/admin/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre, description, type,
          objectif: Number(objectif), recompense: Number(recompense),
          finitLe: finitLe || null,
        }),
      });
      const data = await reponse.json();
      if (!reponse.ok) { toast(data.error || 'Création impossible.', { ton: 'erreur' }); return; }
      toast('Mission créée en brouillon. Activez-la pour la publier.', { ton: 'succes' });
      setTitre(''); setDescription(''); setFormulaireOuvert(false);
      await charger();
    } catch {
      toast('Création impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally {
      setEnvoi(false);
    }
  };

  const changerStatut = async (missionId: string, statut: string) => {
    const reponse = await fetch('/api/admin/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missionId, statut }),
    });
    if (!reponse.ok) {
      const data = await reponse.json();
      toast(data.error || 'Changement impossible.', { ton: 'erreur' });
      return;
    }
    await charger();
  };

  return (
    <PageReseau
      titre="Missions"
      sousTitre="Ce que Suguba demande au réseau, et ce que ça rapporte."
      retour={{ href: '/admin/backoffice', libelle: 'Back-office' }}
      large
      action={
        <Button size="sm" onClick={() => setFormulaireOuvert((v) => !v)}>
          <Plus className="w-4 h-4" />Nouvelle mission
        </Button>
      }
    >
      {formulaireOuvert && (
        <Card className="space-y-4">
          <form onSubmit={creer} className="space-y-3">
            <Field label="Titre" htmlFor="titre" requis>
              <Input id="titre" value={titre} onChange={(e) => setTitre(e.target.value)} required maxLength={120}
                placeholder="Partager 10 fois la promo Ramadan" />
            </Field>
            <Field label="Description" htmlFor="description" aide="Expliquez simplement ce qu’il faut faire.">
              <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type" htmlFor="type">
                <Select id="type" value={type} onChange={(e) => setType(e.target.value as TypeMission)}>
                  {TYPES_MISSION.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
                </Select>
              </Field>
              <Field label={`Objectif (${verbeType(type)})`} htmlFor="objectif">
                <Input id="objectif" type="number" inputMode="numeric" min={1} value={objectif} onChange={(e) => setObjectif(e.target.value)} />
              </Field>
              <Field label="Récompense (FCFA)" htmlFor="recompense">
                <Input id="recompense" type="number" inputMode="numeric" min={0} step={500} value={recompense} onChange={(e) => setRecompense(e.target.value)} />
              </Field>
              <Field label="Date de fin" htmlFor="fin" aide="Laissez vide pour une mission sans limite.">
                <Input id="fin" type="date" value={finitLe} onChange={(e) => setFinitLe(e.target.value)} />
              </Field>
            </div>
            <Button type="submit" disabled={envoi} fullWidth>
              {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Créer en brouillon
            </Button>
          </form>
        </Card>
      )}

      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : missions.length === 0 ? (
        <EmptyState
          icone={Target}
          titre="Aucune mission"
          texte="Créez une première mission : partager un produit, faire une vente, parrainer un revendeur."
          action={<Button onClick={() => setFormulaireOuvert(true)}>Créer une mission</Button>}
        />
      ) : (
        <div className="space-y-3">
          {missions.map((m) => (
            <Card key={m.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate">{m.titre}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {libelleType(m.type)} · objectif {m.objectif} {verbeType(m.type)} ·{' '}
                    {m.recompense.toLocaleString('fr-FR')} F · {m.participants} participant{m.participants > 1 ? 's' : ''}
                  </p>
                </div>
                <StatusPill ton={TON[m.statut] || 'neutre'}>{LIBELLE_STATUT[m.statut] || m.statut}</StatusPill>
              </div>
              {m.supplierId && (
                <p className="text-[11px] font-bold text-amber-800 bg-amber-50 rounded-2xl px-3 py-2">
                  Campagne fournisseur · budget {(m.recompense * (m.maxParticipants || 0)).toLocaleString('fr-FR')} F à encaisser avant activation
                </p>
              )}

              <div className="flex gap-2">
                {m.statut !== 'active' && (
                  <Button size="sm" variant="ghost" fullWidth onClick={() => changerStatut(m.id, 'active')}>
                    <Play className="w-3.5 h-3.5" />Activer
                  </Button>
                )}
                {m.statut === 'active' && (
                  <Button size="sm" variant="ghost" fullWidth onClick={() => changerStatut(m.id, 'paused')}>
                    <Pause className="w-3.5 h-3.5" />Mettre en pause
                  </Button>
                )}
                {m.statut !== 'ended' && (
                  <Button size="sm" variant="ghost" fullWidth onClick={() => changerStatut(m.id, 'ended')}>
                    <Square className="w-3.5 h-3.5" />Terminer
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageReseau>
  );
}
