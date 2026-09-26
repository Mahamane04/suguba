'use client';

import React, { useEffect, useState } from 'react';
import { Target, Loader2, Plus, Play, Pause, Square, Check, X, ExternalLink } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import ChoicePicker from '@/components/ui/ChoicePicker';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { TYPES_MISSION, libelleType, verbeType, type TypeMission } from '@/lib/reseau/missions';
import { estTypeResultat } from '@/lib/reseau/resultats-constantes';

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
  budget?: { engage: number; verse: number; restant: number; aValider: number; plafonne: boolean; recu: number; recuLe: string | null; reference: string | null };
  canal?: string;
}

interface Preuve {
  id: string; mission: string; revendeur: { nom: string; code: string | null };
  canal: string; lien: string | null; note: string | null; photo: string | null; envoyeeLe: string;
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;

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
  const [places, setPlaces] = useState('');
  const [preuves, setPreuves] = useState<Preuve[]>([]);

  const charger = React.useCallback(() => {
    fetch('/api/admin/missions/preuves', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then((j) => setPreuves(j?.preuves || [])).catch(() => {});
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
          maxParticipants: places ? Number(places) : null,
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
                <ChoicePicker id="type" valeur={type} onChange={(v) => setType(v as TypeMission)}
                  choix={TYPES_MISSION.filter((t) => !estTypeResultat(t.valeur)).map((t) => ({ valeur: t.valeur, libelle: t.libelle }))} />
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
              <Field label="Nombre de gagnants maximum" htmlFor="places" aide="Fixe le budget. Vide = sans plafond (budget ouvert).">
                <Input id="places" type="number" inputMode="numeric" min={1} value={places} onChange={(e) => setPlaces(e.target.value)} />
              </Field>
            </div>
            <p className="text-xs text-slate-700 bg-slate-50 rounded-2xl px-3 py-2">
              {places && Number(places) > 0
                ? <>Budget engagé : <strong>{fcfa((Number(recompense) || 0) * Number(places))}</strong> ({places} × {fcfa(Number(recompense) || 0)})</>
                : 'Budget ouvert : chaque participant qui atteint l’objectif peut être payé. Fixez un nombre de gagnants pour le plafonner.'}
            </p>
            <Button type="submit" disabled={envoi} fullWidth>
              {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Créer en brouillon
            </Button>
          </form>
        </Card>
      )}

      {preuves.length > 0 && <PreuvesAVerifier preuves={preuves} onMaj={charger} />}

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
                  <p className="text-sm font-bold text-slate-900 truncate">{m.titre}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {libelleType(m.type)} · objectif {m.objectif} {verbeType(m.type)} ·{' '}
                    {m.recompense.toLocaleString('fr-FR')} F{estTypeResultat(m.type) ? ' par résultat' : ''} · {m.participants} participant{m.participants > 1 ? 's' : ''}
                  </p>
                </div>
                <StatusPill ton={TON[m.statut] || 'neutre'}>{LIBELLE_STATUT[m.statut] || m.statut}</StatusPill>
              </div>
              {m.budget && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <p className="rounded-2xl bg-slate-50 px-3 py-2">Engagé<br /><strong className="text-slate-900">{m.budget.plafonne ? fcfa(m.budget.engage) : 'ouvert'}</strong></p>
                  <p className="rounded-2xl bg-slate-50 px-3 py-2">{estTypeResultat(m.type) ? 'Consommé' : 'Versé'}<br /><strong className="text-slate-900">{fcfa(m.budget.verse)}</strong></p>
                  <p className="rounded-2xl bg-slate-50 px-3 py-2">{m.budget.plafonne ? 'Restant' : 'À valider'}<br /><strong className="text-slate-900">{fcfa(m.budget.plafonne ? m.budget.restant : m.budget.aValider)}</strong></p>
                </div>
              )}
              {m.supplierId && <BudgetCampagne mission={m} onMaj={charger} />}

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

/**
 * Preuves de publication à vérifier (lot 2a, 2026-09-26) : seule une preuve
 * validée fait avancer une mission « partager » ou « publier ».
 */
function PreuvesAVerifier({ preuves, onMaj }: { preuves: Preuve[]; onMaj: () => void }) {
  const { toast } = useToast();
  const [refus, setRefus] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState<string | null>(null);

  const decider = async (preuveId: string, decision: 'valider' | 'refuser') => {
    setEnvoi(preuveId);
    try {
      const r = await fetch('/api/admin/missions/preuves', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preuveId, decision, motif }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { toast(j?.error || 'Action impossible.', { ton: 'erreur' }); return; }
      toast(decision === 'valider' ? (j.comptee ? 'Validée : elle compte pour la mission.' : 'Validée, mais la mission est terminée : elle ne compte pas.') : 'Refusée. Le revendeur voit le motif.', { ton: decision === 'valider' ? 'succes' : 'info' });
      setRefus(null); setMotif('');
      onMaj();
    } catch {
      toast('Connexion interrompue. Réessayez.', { ton: 'erreur' });
    } finally {
      setEnvoi(null);
    }
  };

  return (
    <section className="space-y-2.5">
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600 px-1">Preuves de publication à vérifier ({preuves.length})</h2>
      {preuves.map((p) => (
        <Card key={p.id} className="space-y-3">
          <div className="flex gap-3">
            {p.photo ? (
              <a href={p.photo} target="_blank" rel="noopener noreferrer" className="block w-24 h-40 shrink-0 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.photo} alt={`Capture envoyée par ${p.revendeur.nom}`} className="w-full h-full object-cover" />
              </a>
            ) : <div className="w-24 h-40 shrink-0 rounded-2xl bg-slate-100" />}
            <div className="min-w-0 text-xs text-slate-700 space-y-1">
              <p className="text-sm font-bold text-slate-900">{p.mission}</p>
              <p>{p.revendeur.nom}{p.revendeur.code ? ` · ${p.revendeur.code}` : ''}</p>
              <p>Publié sur : <strong>{p.canal}</strong></p>
              {p.lien && <a href={p.lien} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-suguba-profond underline break-all"><ExternalLink className="w-3 h-3" />Voir la publication</a>}
              {p.note && <p>« {p.note} »</p>}
              <p className="text-slate-500">Envoyée le {new Date(p.envoyeeLe).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">Vérifiez que la publication montre bien le produit ou le lien Suguba, et qu’elle est publique.</p>
          {refus === p.id ? (
            <div className="space-y-2">
              <Field label="Motif du refus (visible par le revendeur)" htmlFor={`motif-${p.id}`} requis>
                <Input id={`motif-${p.id}`} value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder="Ex : capture illisible, publication sans le lien" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={() => setRefus(null)}>Annuler</Button>
                <Button onClick={() => decider(p.id, 'refuser')} disabled={envoi === p.id || motif.trim().length < 3}>Refuser</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => { setRefus(p.id); setMotif(''); }}><X className="w-4 h-4" />Refuser</Button>
              <Button onClick={() => decider(p.id, 'valider')} disabled={envoi === p.id}><Check className="w-4 h-4" />Valider</Button>
            </div>
          )}
        </Card>
      ))}
    </section>
  );
}

/**
 * Budget d'une campagne fournisseur (lot 2b, 2026-09-26) : elle ne s'active
 * qu'une fois le budget (récompense × revendeurs) reçu en entier. L'admin note
 * le montant total reçu et sa référence.
 */
function BudgetCampagne({ mission, onMaj }: { mission: Mission; onMaj: () => void }) {
  const { toast } = useToast();
  // Campagne au résultat (lot 3) : prix d'un résultat × nombre de résultats achetés.
  const du = mission.recompense * (estTypeResultat(mission.type) ? mission.objectif : mission.maxParticipants || 0);
  const recu = mission.budget?.recu || 0;
  const [ouvert, setOuvert] = useState(false);
  const [montant, setMontant] = useState(String(du));
  const [reference, setReference] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const enregistrer = async () => {
    setEnvoi(true);
    try {
      const r = await fetch('/api/admin/missions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId: mission.id, action: 'budget', montant: Number(montant), reference }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { toast(j?.error || 'Enregistrement impossible.', { ton: 'erreur' }); return; }
      toast('Paiement enregistré.', { ton: 'succes' });
      setOuvert(false);
      onMaj();
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className={`rounded-2xl px-3 py-2 text-xs space-y-2 ${recu >= du ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
      <p className="font-bold">
        Campagne fournisseur · budget {fcfa(du)} ·{' '}
        {recu >= du ? `réglé${mission.budget?.recuLe ? ` le ${new Date(mission.budget.recuLe).toLocaleDateString('fr-FR')}` : ''}` : recu > 0 ? `${fcfa(recu)} reçus, reste ${fcfa(du - recu)}` : 'à encaisser avant activation'}
        {mission.budget?.reference ? ` (réf. ${mission.budget.reference})` : ''}
      </p>
      {mission.canal && mission.canal !== 'tous' && <p>Canal demandé : {mission.canal.replace('_', ' ')}</p>}
      {ouvert ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Montant total reçu (F)" htmlFor={`montant-${mission.id}`}>
              <Input id={`montant-${mission.id}`} type="number" inputMode="numeric" min={0} value={montant} onChange={(e) => setMontant(e.target.value)} />
            </Field>
            <Field label="Référence" htmlFor={`ref-${mission.id}`} aide="Reçu, transaction Mobile Money…">
              <Input id={`ref-${mission.id}`} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOuvert(false)}>Annuler</Button>
            <Button size="sm" onClick={enregistrer} disabled={envoi}>Enregistrer</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => { setOuvert(true); setMontant(String(Math.max(recu, du))); }}>
          {recu > 0 ? 'Modifier le paiement reçu' : 'Enregistrer le paiement reçu'}
        </Button>
      )}
    </div>
  );
}
